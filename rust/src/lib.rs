use chrono::{Duration, NaiveDate, Utc};
use rand::RngCore;
use rusqlite::{
    Connection, params_from_iter,
    types::{Value as SqlValue, ValueRef},
};
use scrypt::{Params, scrypt};
use serde_json::{Value, json};
use std::{
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
};
use subtle::ConstantTimeEq;

pub struct Store {
    db: Mutex<Connection>,
    data_dir: PathBuf,
}
#[derive(Debug)]
pub struct ApiError {
    pub status: u16,
    pub message: String,
}
impl std::fmt::Display for ApiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}
impl std::error::Error for ApiError {}
type Result<T> = std::result::Result<T, ApiError>;
fn err(status: u16, message: impl Into<String>) -> ApiError {
    ApiError {
        status,
        message: message.into(),
    }
}
impl From<rusqlite::Error> for ApiError {
    fn from(e: rusqlite::Error) -> Self {
        let msg = e.to_string();
        if msg.contains("UNIQUE constraint failed") {
            if msg.contains("phones.imei1") || msg.contains("phones.imei2") {
                err(409, "A phone with this IMEI already exists")
            } else {
                err(
                    409,
                    "A record with this SKU, barcode or IMEI already exists",
                )
            }
        } else if msg.contains("FOREIGN KEY constraint failed") {
            err(400, "Referenced record is invalid")
        } else {
            eprintln!("database error: {msg}");
            err(500, "Database error")
        }
    }
}
impl From<std::io::Error> for ApiError {
    fn from(e: std::io::Error) -> Self {
        eprintln!("file error: {e}");
        err(500, "File error")
    }
}
fn sql_value(v: &Value) -> SqlValue {
    match v {
        Value::Null => SqlValue::Null,
        Value::Bool(b) => SqlValue::Integer(*b as i64),
        Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                SqlValue::Integer(i)
            } else {
                SqlValue::Real(n.as_f64().unwrap_or(0.0))
            }
        }
        Value::String(s) => SqlValue::Text(s.clone()),
        _ => SqlValue::Text(v.to_string()),
    }
}
fn query(db: &Connection, sql: &str, args: &[Value]) -> Result<Vec<Value>> {
    let params: Vec<SqlValue> = args.iter().map(sql_value).collect();
    let mut stmt = db.prepare(sql)?;
    let cols: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
    let rows = stmt.query_map(params_from_iter(params.iter()), |row| {
        let mut map = serde_json::Map::new();
        for (i, name) in cols.iter().enumerate() {
            let v = match row.get_ref(i)? {
                ValueRef::Null => Value::Null,
                ValueRef::Integer(n) => json!(n),
                ValueRef::Real(n) => json!(n),
                ValueRef::Text(t) => json!(String::from_utf8_lossy(t).to_string()),
                ValueRef::Blob(b) => json!(hex::encode(b)),
            };
            map.insert(name.clone(), v);
        }
        Ok(Value::Object(map))
    })?;
    rows.collect::<std::result::Result<Vec<_>, _>>()
        .map_err(Into::into)
}
fn one(db: &Connection, sql: &str, args: &[Value]) -> Result<Option<Value>> {
    Ok(query(db, sql, args)?.into_iter().next())
}
fn execute(db: &Connection, sql: &str, args: &[Value]) -> Result<i64> {
    let params: Vec<SqlValue> = args.iter().map(sql_value).collect();
    db.execute(sql, params_from_iter(params.iter()))?;
    Ok(db.last_insert_rowid())
}
fn count(db: &Connection, sql: &str, args: &[Value]) -> Result<usize> {
    let params: Vec<SqlValue> = args.iter().map(sql_value).collect();
    Ok(db.execute(sql, params_from_iter(params.iter()))?)
}
fn tx<F>(db: &Connection, func: F) -> Result<Value>
where
    F: FnOnce() -> Result<Value>,
{
    db.execute_batch("BEGIN IMMEDIATE")?;
    match func() {
        Ok(v) => {
            db.execute_batch("COMMIT")?;
            Ok(v)
        }
        Err(e) => {
            let _ = db.execute_batch("ROLLBACK");
            Err(e)
        }
    }
}
fn v<'a>(body: &'a Value, key: &str) -> &'a Value {
    body.get(key).unwrap_or(&Value::Null)
}
fn s(body: &Value, key: &str) -> String {
    match v(body, key) {
        Value::String(x) => x.clone(),
        Value::Null => String::new(),
        other => other.to_string(),
    }
}
fn n(body: &Value, key: &str) -> f64 {
    match v(body, key) {
        Value::Number(x) => x.as_f64().unwrap_or(0.0),
        Value::String(x) => x.parse().unwrap_or(0.0),
        _ => 0.0,
    }
}
fn id(body: &Value, key: &str) -> i64 {
    n(body, key) as i64
}
fn optional_id(body: &Value, key: &str) -> Value {
    let x = id(body, key);
    if x > 0 { json!(x) } else { Value::Null }
}
fn str_or(body: &Value, key: &str, default: &str) -> String {
    let x = s(body, key);
    if x.is_empty() { default.into() } else { x }
}
fn required(body: &Value, key: &str, label: &str) -> Result<String> {
    let x = s(body, key);
    if x.trim().is_empty() {
        Err(err(400, format!("{label} is required")))
    } else {
        Ok(x)
    }
}
fn money(x: f64, label: &str) -> Result<f64> {
    if !x.is_finite() || x < 0.0 {
        Err(err(400, format!("{label} must be a non-negative number")))
    } else {
        Ok((x * 100.0).round() / 100.0)
    }
}
fn positive(x: f64, label: &str) -> Result<f64> {
    let x = money(x, label)?;
    if x <= 0.0 {
        Err(err(400, format!("{label} must be greater than zero")))
    } else {
        Ok(x)
    }
}
fn quantity(x: f64) -> Result<i64> {
    if !x.is_finite() || x <= 0.0 || x.fract() != 0.0 {
        Err(err(400, "Quantity must be a positive integer"))
    } else {
        Ok(x as i64)
    }
}
fn required_row(db: &Connection, sql: &str, args: &[Value], message: &str) -> Result<Value> {
    one(db, sql, args)?.ok_or_else(|| err(404, message))
}
fn role_level(role: &str) -> i32 {
    match role {
        "owner" => 5,
        "manager" => 4,
        "cashier" => 3,
        "salesman" => 2,
        "technician" => 1,
        _ => 0,
    }
}
fn allow(user: &Value, role: &str) -> Result<()> {
    if role_level(&s(user, "role")) < role_level(role) {
        Err(err(403, "Your role cannot perform this action"))
    } else {
        Ok(())
    }
}
fn audit(
    db: &Connection,
    user: &Value,
    action: &str,
    entity: &str,
    entity_id: Value,
    details: Value,
) -> Result<()> {
    execute(
        db,
        "INSERT INTO audit(user_id,action,entity,entity_id,details) VALUES(?,?,?,?,?)",
        &[
            v(user, "id").clone(),
            json!(action),
            json!(entity),
            entity_id,
            json!(details.to_string()),
        ],
    )?;
    Ok(())
}
fn shop_settings(db: &Connection) -> Result<Value> {
    one(
        db,
        "SELECT shop_name,tagline,logo_data,phone,address,receipt_footer,updated_at FROM shop_settings WHERE id=1",
        &[],
    )?
    .ok_or_else(|| err(500, "Shop settings are missing"))
}
fn setting_text(body: &Value, key: &str, max_chars: usize, required_field: bool) -> Result<String> {
    let value = s(body, key).trim().to_string();
    if required_field && value.is_empty() {
        return Err(err(400, format!("{} is required", key.replace('_', " "))));
    }
    if value.chars().count() > max_chars {
        return Err(err(400, format!("{} is too long", key.replace('_', " "))));
    }
    Ok(value)
}
fn valid_logo_data(value: &str) -> bool {
    if value.is_empty() {
        return true;
    }
    if value.len() > 1_400_000 {
        return false;
    }
    let Some((kind, encoded)) = value.split_once(",") else {
        return false;
    };
    ["data:image/png;base64", "data:image/jpeg;base64", "data:image/webp;base64"]
        .contains(&kind)
        && encoded.len() >= 24
        && encoded.len() % 4 == 0
        && encoded.bytes().all(|byte| byte.is_ascii_alphanumeric() || byte == b'+' || byte == b'/' || byte == b'=')
}
fn contact(db: &Connection, contact_id: i64, kind: &str) -> Result<Option<Value>> {
    if contact_id <= 0 {
        return Ok(None);
    }
    let c = required_row(
        db,
        "SELECT * FROM contacts WHERE id=?",
        &[json!(contact_id)],
        "Contact not found",
    )?;
    if s(&c, "kind") != kind {
        return Err(err(400, format!("Invalid {kind}")));
    }
    Ok(Some(c))
}
fn product(db: &Connection, product_id: i64) -> Result<Value> {
    required_row(
        db,
        "SELECT * FROM products WHERE id=? AND active=1",
        &[json!(product_id)],
        "Product not found",
    )
}
fn validate_imei(db: &Connection, first: &str, second: &str) -> Result<()> {
    for imei in [first, second].into_iter().filter(|x| !x.is_empty()) {
        if imei.len() != 15 || !imei.bytes().all(|c| c.is_ascii_digit()) {
            return Err(err(400, "IMEI must contain exactly 15 digits"));
        }
        if one(
            db,
            "SELECT id FROM phones WHERE imei1=? OR imei2=?",
            &[json!(imei), json!(imei)],
        )?
        .is_some()
        {
            return Err(err(409, format!("IMEI already exists: {imei}")));
        }
    }
    if !second.is_empty() && first == second {
        return Err(err(400, "IMEI 1 and IMEI 2 must differ"));
    }
    Ok(())
}
#[allow(clippy::too_many_arguments)]
fn add_payment(
    db: &Connection,
    direction: &str,
    contact_id: Value,
    sale_id: Value,
    purchase_id: Value,
    repair_id: Value,
    method: &str,
    amount: f64,
    user: &Value,
    branch_id: i64,
    notes: &str,
) -> Result<()> {
    execute(
        db,
        "INSERT INTO payments(direction,contact_id,sale_id,purchase_id,repair_id,method,amount,branch_id,created_by,notes) VALUES(?,?,?,?,?,?,?,?,?,?)",
        &[
            json!(direction),
            contact_id,
            sale_id,
            purchase_id,
            repair_id,
            json!(method),
            json!(amount),
            json!(branch_id),
            v(user, "id").clone(),
            json!(notes),
        ],
    )?;
    Ok(())
}
fn stock(
    db: &Connection,
    p: &Value,
    delta: i64,
    reason: &str,
    reference: i64,
    user: &Value,
) -> Result<()> {
    if s(p, "category") == "phone" {
        return Ok(());
    }
    let changed = count(
        db,
        "UPDATE products SET quantity=quantity+? WHERE id=? AND quantity+?>=0",
        &[json!(delta), v(p, "id").clone(), json!(delta)],
    )?;
    if changed == 0 {
        return Err(err(400, format!("Not enough stock: {}", s(p, "name"))));
    }
    execute(
        db,
        "INSERT INTO stock_movements(product_id,delta,reason,reference_id,user_id) VALUES(?,?,?,?,?)",
        &[
            v(p, "id").clone(),
            json!(delta),
            json!(reason),
            json!(reference),
            v(user, "id").clone(),
        ],
    )?;
    Ok(())
}
fn strip(mut row: Value, keys: &[&str]) -> Value {
    if let Value::Object(ref mut map) = row {
        for key in keys {
            map.remove(*key);
        }
    }
    row
}
fn hash_password(password: &str) -> Result<String> {
    let mut salt = [0_u8; 16];
    rand::rng().fill_bytes(&mut salt);
    let params = Params::new(14, 8, 1, 64).map_err(|_| err(500, "Password setup failed"))?;
    let mut output = [0_u8; 64];
    scrypt(password.as_bytes(), &salt, &params, &mut output)
        .map_err(|_| err(500, "Password setup failed"))?;
    Ok(format!("{}:{}", hex::encode(salt), hex::encode(output)))
}
fn verify_password(password: &str, hash: &str) -> bool {
    let Some((salt_hex, key_hex)) = hash.split_once(':') else {
        return false;
    };
    let (Ok(salt), Ok(expected)) = (hex::decode(salt_hex), hex::decode(key_hex)) else {
        return false;
    };
    let Ok(params) = Params::new(14, 8, 1, expected.len()) else {
        return false;
    };
    let mut actual = vec![0_u8; expected.len()];
    if scrypt(password.as_bytes(), &salt, &params, &mut actual).is_err() {
        return false;
    }
    actual.ct_eq(&expected).into()
}
fn backup(db: &Connection, dir: &Path, name: &str) -> Result<PathBuf> {
    let to = dir.join(name);
    let pending = dir.join(format!(".{name}.pending"));
    let result=(||->Result<()> {db.backup("main",&pending,None)?;verify_database(&pending)?;fs::rename(&pending,&to)?;Ok(())})();
    if result.is_err(){let _=fs::remove_file(&pending);}
    result?;
    Ok(to)
}
fn verify_database(path: &Path) -> Result<()> {
    let candidate=Connection::open_with_flags(path,rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    let check=one(&candidate,"PRAGMA integrity_check",&[])?.ok_or_else(||err(400,"Backup integrity check failed"))?;
    if check.as_object().and_then(|m|m.values().next()).and_then(Value::as_str)!=Some("ok") {return Err(err(400,"Backup integrity check failed"));}
    candidate.prepare("SELECT id FROM users LIMIT 1")?;
    Ok(())
}
fn valid_backup_name(name: &str) -> bool {
    (name.starts_with("backup-")||name.starts_with("auto-")||name.starts_with("before-restore-"))
    && name.ends_with(".db")
    && name.chars().all(|c|c.is_ascii_alphanumeric()||"-_.".contains(c))
}
impl Store {
    pub fn open(data_dir: PathBuf) -> Result<Self> {
        fs::create_dir_all(&data_dir)?;
        let db = Connection::open(data_dir.join("shop.db"))?;
        db.execute_batch("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;")?;
        db.execute_batch(include_str!("../schema.sql"))?;
        let today = Utc::now().format("%Y-%m-%d").to_string();
        let name = format!("auto-{today}.db");
        if !data_dir.join(&name).exists() {
            backup(&db, &data_dir, &name)?;
        }
        Ok(Self {
            db: Mutex::new(db),
            data_dir,
        })
    }
    pub fn handle(&self, method: &str, path: &str, body: &Value, token: &str) -> Result<Value> {
        let mut guard = self
            .db
            .lock()
            .map_err(|_| err(500, "Database lock failed"))?;
        let (path, query) = path.split_once('?').unwrap_or((path, ""));
        let mut body = body.clone();
        for (k, val) in url::form_urlencoded::parse(query.as_bytes()) {
            body[k.as_ref()] = json!(val.as_ref())
        }
        self.route(&mut guard, method, path, &body, token)
    }
    pub fn run_scheduled_backup(&self) -> Result<bool> {
        let db=self.db.lock().map_err(|_|err(500,"Database lock failed"))?;
        let prefs=one(&db,"SELECT * FROM backup_preferences WHERE id=1",&[])?.ok_or_else(||err(500,"Backup preferences missing"))?;
        if id(&prefs,"enabled")!=1 || s(&prefs,"destination").is_empty(){return Ok(false);}
        let due=v(&prefs,"last_success").as_str().and_then(|x|chrono::DateTime::parse_from_rfc3339(x).ok()).is_none_or(|last|Utc::now().signed_duration_since(last.with_timezone(&Utc)).num_hours()>=id(&prefs,"interval_hours"));
        if !due{return Ok(false);}
        match self.write_external_backup(&db) {
            Ok(_)=>Ok(true),
            Err(e)=>{let _=execute(&db,"UPDATE backup_preferences SET last_error=? WHERE id=1",&[json!(e.message)]);Err(e)}
        }
    }
    fn route(
        &self,
        db: &mut Connection,
        method: &str,
        path: &str,
        body: &Value,
        token: &str,
    ) -> Result<Value> {
        if method == "GET" && path == "/api/status" {
            let branding = shop_settings(db)?;
            return Ok(
                json!({"setup":one(db,"SELECT id FROM users LIMIT 1",&[])?.is_none(),"app":"Mobile Shop ERP","branding":{"shop_name":branding["shop_name"],"tagline":branding["tagline"],"logo_data":branding["logo_data"]}}),
            );
        }
        if method == "POST" && path == "/api/setup" {
            if one(db, "SELECT id FROM users LIMIT 1", &[])?.is_some() {
                return Err(err(403, "Setup is complete"));
            }
            let name = required(body, "name", "Name")?;
            let username = required(body, "username", "Username")?;
            let password = required(body, "password", "Password")?;
            if password.len() < 8 {
                return Err(err(400, "Password must have at least 8 characters"));
            }
            execute(
                db,
                "INSERT INTO users(name,username,password_hash,role) VALUES(?,?,?,?)",
                &[
                    json!(name),
                    json!(username),
                    json!(hash_password(&password)?),
                    json!("owner"),
                ],
            )?;
            return Ok(json!({"ok":true}));
        }
        if method == "POST" && path == "/api/login" {
            let user = one(
                db,
                "SELECT * FROM users WHERE username=? AND active=1",
                &[json!(s(body, "username"))],
            )?;
            let Some(user) = user else {
                return Err(err(401, "Invalid credentials"));
            };
            if !verify_password(&s(body, "password"), &s(&user, "password_hash")) {
                return Err(err(401, "Invalid credentials"));
            }
            let mut bytes = [0_u8; 32];
            rand::rng().fill_bytes(&mut bytes);
            let token = hex::encode(bytes);
            let expires = (Utc::now() + Duration::days(30))
                .format("%Y-%m-%d %H:%M:%S")
                .to_string();
            execute(
                db,
                "INSERT INTO sessions(token,user_id,expires_at) VALUES(?,?,?)",
                &[json!(token), v(&user, "id").clone(), json!(expires)],
            )?;
            return Ok(
                json!({"token":token,"user":{"id":id(&user,"id"),"name":s(&user,"name"),"role":s(&user,"role")}}),
            );
        }
        let user=one(db,"SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>datetime('now') AND u.active=1",&[json!(token)])?.ok_or_else(||err(401,"Please sign in"))?;
        if method == "GET" && path == "/api/me" {
            return Ok(json!({"id":id(&user,"id"),"name":s(&user,"name"),"role":s(&user,"role")}));
        }
        if method == "POST" && path == "/api/logout" {
            execute(db, "DELETE FROM sessions WHERE token=?", &[json!(token)])?;
            return Ok(json!({"ok":true}));
        }
        self.route_auth(db, method, path, body, &user)
    }
    fn route_auth(
        &self,
        db: &mut Connection,
        method: &str,
        path: &str,
        body: &Value,
        user: &Value,
    ) -> Result<Value> {
        let parts: Vec<&str> = path.trim_start_matches("/api/").split('/').collect();
        match (method,parts.as_slice()) {
   ("GET",["settings"])=>shop_settings(db),
   ("PUT",["settings"])=>{
       allow(user,"owner")?;
       let name=setting_text(body,"shop_name",80,true)?;
       let tagline=setting_text(body,"tagline",80,false)?;
       let phone=setting_text(body,"phone",80,false)?;
       let address=setting_text(body,"address",250,false)?;
       let receipt_footer=setting_text(body,"receipt_footer",250,false)?;
       let logo_data=s(body,"logo_data");
       if !valid_logo_data(&logo_data){return Err(err(400,"Logo must be a PNG, JPEG or WebP image under 1 MB"))}
       execute(db,"UPDATE shop_settings SET shop_name=?,tagline=?,logo_data=?,phone=?,address=?,receipt_footer=?,updated_at=CURRENT_TIMESTAMP WHERE id=1",&[json!(name.clone()),json!(tagline),json!(logo_data),json!(phone),json!(address),json!(receipt_footer)])?;
       audit(db,user,"update","shop_settings",json!(1),json!({"shop_name":name,"logo_changed":body.get("logo_data").is_some()}))?;
       shop_settings(db)
   },
   ("GET",["dashboard"])=>{let scalar=|sql:&str|->Result<Value>{Ok(one(db,sql,&[])?.and_then(|r|r.get("value").cloned()).unwrap_or(json!(0)))};Ok(json!({"salesToday":scalar("SELECT COALESCE(SUM(total),0) value FROM sales WHERE date(date)=date('now','localtime') AND status='completed'")?,"salesMonth":scalar("SELECT COALESCE(SUM(total),0) value FROM sales WHERE strftime('%Y-%m',date)=strftime('%Y-%m','now','localtime') AND status='completed'")?,"outstanding":scalar("SELECT COALESCE(SUM(total-paid),0) value FROM sales WHERE status='completed'")?,"availablePhones":scalar("SELECT COUNT(*) value FROM phones WHERE status='available'")?,"lowStock":query(db,"SELECT id,name,quantity,reorder_level FROM (SELECT p.id,p.name,p.reorder_level,CASE WHEN p.category='phone' THEN (SELECT COUNT(*) FROM phones h WHERE h.product_id=p.id AND h.status='available') ELSE p.quantity END quantity FROM products p WHERE p.active=1 AND p.reorder_level>0) WHERE quantity<=reorder_level ORDER BY quantity LIMIT 10",&[])?,"recentSales":query(db,"SELECT s.id,s.invoice_no,s.total,s.paid,s.date,c.name customer FROM sales s LEFT JOIN contacts c ON c.id=s.customer_id ORDER BY s.id DESC LIMIT 7",&[])?,"repairsReady":scalar("SELECT COUNT(*) value FROM repairs WHERE status='Ready'")?,"overdue":scalar("SELECT COUNT(*) value FROM installments WHERE due_date<date('now','localtime') AND paid<amount")?,"chart":query(db,"SELECT date(date) day,ROUND(SUM(total),2) total FROM sales WHERE date>=date('now','-6 days') AND status='completed' GROUP BY date(date) ORDER BY day",&[])?}))}
   ("GET",["branches"])=>Ok(json!(query(db,"SELECT * FROM branches ORDER BY id",&[])?)),
   ("POST",["branches"])=>{allow(user,"owner")?;let x=execute(db,"INSERT INTO branches(name,address,phone) VALUES(?,?,?)",&[json!(required(body,"name","Branch name")?),json!(s(body,"address")),json!(s(body,"phone"))])?;audit(db,user,"create","branch",json!(x),json!({}))?;Ok(json!({"id":x}))}
   ("GET",["users"])=>{allow(user,"manager")?;Ok(json!(query(db,"SELECT id,name,username,role,active FROM users ORDER BY id",&[])?))}
   ("POST",["users"])=>{allow(user,"owner")?;let role=required(body,"role","Role")?;if role_level(&role)==0{return Err(err(400,"Invalid role"))}let password=required(body,"password","Password")?;if password.len()<8{return Err(err(400,"Password must have at least 8 characters"))}let x=execute(db,"INSERT INTO users(name,username,password_hash,role) VALUES(?,?,?,?)",&[json!(required(body,"name","Name")?),json!(required(body,"username","Username")?),json!(hash_password(&password)?),json!(role)])?;audit(db,user,"create","user",json!(x),json!({}))?;Ok(json!({"id":x}))}
   ("GET",["contacts"])=>Ok(json!(query(db,"SELECT * FROM contacts WHERE (? IS NULL OR kind=?) ORDER BY name",&[if s(body,"kind").is_empty(){Value::Null}else{v(body,"kind").clone()},if s(body,"kind").is_empty(){Value::Null}else{v(body,"kind").clone()}])?)),
   ("POST",["contacts"])=>{let kind=required(body,"kind","Contact type")?;if kind!="customer"&&kind!="supplier"{return Err(err(400,"Invalid contact type"))}let x=execute(db,"INSERT INTO contacts(kind,name,phone,address,notes) VALUES(?,?,?,?,?)",&[json!(kind),json!(required(body,"name","Name")?),json!(s(body,"phone")),json!(s(body,"address")),json!(s(body,"notes"))])?;audit(db,user,"create","contact",json!(x),json!({}))?;Ok(json!({"id":x}))}
   ("GET",["products"])=>Ok(json!(query(db,"SELECT p.*, (SELECT COUNT(*) FROM phones h WHERE h.product_id=p.id AND h.status='available') phone_quantity FROM products p WHERE active=1 ORDER BY p.id DESC",&[])?.into_iter().map(|p|if role_level(&s(user,"role"))>=4{p}else{strip(p,&["cost","min_price"])}).collect::<Vec<_>>())),
   ("POST",["products"])=>{allow(user,"manager")?;let category=required(body,"category","Category")?;if !["phone","charger","cable","handsfree","cover","glass","power_bank","smart_watch","memory_card","spare_part","other"].contains(&category.as_str()){return Err(err(400,"Invalid category"))}let x=execute(db,"INSERT INTO products(sku,barcode,name,category,brand,model,variant,color,storage,condition,compatible_models,cost,price,min_price,quantity,reorder_level,warranty_days,branch_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",&[if s(body,"sku").is_empty(){Value::Null}else{v(body,"sku").clone()},if s(body,"barcode").is_empty(){Value::Null}else{v(body,"barcode").clone()},json!(required(body,"name","Name")?),json!(category),json!(s(body,"brand")),json!(s(body,"model")),json!(s(body,"variant")),json!(s(body,"color")),json!(s(body,"storage")),json!(str_or(body,"condition","new")),json!(s(body,"compatible_models")),json!(money(n(body,"cost"),"Cost")?),json!(money(n(body,"price"),"Price")?),json!(money(n(body,"min_price"),"Minimum price")?),json!(0),json!(id(body,"reorder_level")),json!(id(body,"warranty_days")),json!(id(body,"branch_id").max(1))])?;audit(db,user,"create","product",json!(x),json!({}))?;Ok(json!({"id":x}))}
   ("PATCH",["products",product_id])=>{allow(user,"manager")?;let p=product(db,product_id.parse().unwrap_or(0))?;let allowed=["name","sku","barcode","brand","model","variant","color","storage","condition","compatible_models","cost","price","min_price","reorder_level","warranty_days"];let changes:Vec<_>=allowed.into_iter().filter(|k|body.get(*k).is_some()).collect();if changes.is_empty(){return Err(err(400,"No changes supplied"))}let mut params:Vec<Value>=Vec::new();for key in &changes{params.push(if ["cost","price","min_price"].contains(key){json!(money(n(body,key),key)?)}else{v(body,key).clone()});}params.push(v(&p,"id").clone());tx(db,||{execute(db,&format!("UPDATE products SET {} WHERE id=?",changes.iter().map(|k|format!("{k}=?")).collect::<Vec<_>>().join(",")),&params)?;if body.get("cost").is_some()||body.get("price").is_some(){execute(db,"INSERT INTO price_history(product_id,old_cost,new_cost,old_price,new_price,changed_by) VALUES(?,?,?,?,?,?)",&[v(&p,"id").clone(),v(&p,"cost").clone(),json!(if body.get("cost").is_some(){n(body,"cost")}else{n(&p,"cost")}),v(&p,"price").clone(),json!(if body.get("price").is_some(){n(body,"price")}else{n(&p,"price")}),v(user,"id").clone()])?;}audit(db,user,"update","product",v(&p,"id").clone(),body.clone())?;Ok(json!({"ok":true}))})}
   ("GET",["phones"])=>Ok(json!(query(db,"SELECT h.*,p.name product_name,p.brand,p.model,p.color,p.storage,s.name supplier_name FROM phones h JOIN products p ON p.id=h.product_id LEFT JOIN contacts s ON s.id=h.supplier_id ORDER BY h.id DESC",&[])?.into_iter().map(|h|if role_level(&s(user,"role"))>=4{h}else{strip(h,&["purchase_cost","prep_cost","supplier_id","supplier_name"])}).collect::<Vec<_>>())),
   _=>self.route_more(db,method,&parts,body,user)
  }
    }
    fn route_more(
        &self,
        db: &mut Connection,
        method: &str,
        parts: &[&str],
        body: &Value,
        user: &Value,
    ) -> Result<Value> {
        match (method, parts) {
            ("GET", ["purchases"]) => {
                allow(user, "manager")?;
                Ok(json!(query(
                    db,
                    "SELECT p.*,c.name supplier FROM purchases p LEFT JOIN contacts c ON c.id=p.supplier_id ORDER BY p.id DESC",
                    &[]
                )?))
            }
            ("POST", ["purchases"]) => self.create_purchase(db, body, user),
            ("GET", ["purchase-lines"]) => {
                allow(user, "manager")?;
                Ok(json!(query(
                    db,
                    "SELECT l.*,p.name product_name,h.imei1 FROM purchase_lines l JOIN products p ON p.id=l.product_id LEFT JOIN phones h ON h.id=l.phone_id WHERE l.purchase_id=?",
                    &[json!(id(body, "purchase_id"))]
                )?))
            }
            ("POST", ["purchase-returns"]) => self.purchase_return(db, body, user),
            ("GET", ["used-purchases"]) => {
                allow(user, "manager")?;
                Ok(json!(query(
                    db,
                    "SELECT u.*,c.name seller,h.imei1,p.name product_name FROM used_purchases u JOIN contacts c ON c.id=u.customer_id JOIN phones h ON h.id=u.phone_id JOIN products p ON p.id=h.product_id ORDER BY u.id DESC",
                    &[]
                )?))
            }
            ("POST", ["used-purchases"]) => self.used_purchase(db, body, user),
            ("POST", ["used-purchases", used_id, "pay"]) => {
                self.pay_used_purchase(db, used_id, body, user)
            }
            ("GET", ["sales"]) => Ok(json!(query(
                db,
                "SELECT s.*,c.name customer,c.phone customer_phone,u.name staff FROM sales s LEFT JOIN contacts c ON c.id=s.customer_id LEFT JOIN users u ON u.id=s.created_by ORDER BY s.id DESC",
                &[]
            )?)),
            ("GET", ["sales", sale_id]) => self.sale_details(db, sale_id, user),
            ("POST", ["sales"]) => self.create_sale(db, body, user),
            ("POST", ["sales", sale_id, "returns"]) => self.sale_return(db, sale_id, body, user),
            ("POST", ["sales", sale_id, "installments"]) => {
                self.schedule_installments(db, sale_id, body, user)
            }
            ("POST", ["payments"]) => self.record_payment(db, body, user),
            ("GET", ["payments"]) => {
                allow(user, "cashier")?;
                Ok(json!(query(
                    db,
                    "SELECT p.*,c.name contact_name FROM payments p LEFT JOIN contacts c ON c.id=p.contact_id ORDER BY p.id DESC LIMIT 200",
                    &[]
                )?))
            }
            ("GET", ["installments"]) => Ok(json!(query(
                db,
                "SELECT i.*,s.invoice_no,c.name customer,c.phone FROM installments i JOIN sales s ON s.id=i.sale_id LEFT JOIN contacts c ON c.id=s.customer_id ORDER BY i.due_date",
                &[]
            )?)),
            ("POST", ["installments", installment_id, "pay"]) => {
                self.pay_installment(db, installment_id, body, user)
            }
            ("GET", ["ledger"]) => self.ledger(db, body, user),
            ("GET", ["repairs"]) => Ok(json!(query(
                db,
                "SELECT r.*,c.name customer,c.phone,u.name technician FROM repairs r LEFT JOIN contacts c ON c.id=r.customer_id LEFT JOIN users u ON u.id=r.technician_id ORDER BY r.id DESC",
                &[]
            )?)),
            ("GET", ["repairs", repair_id]) => self.repair_details(db, repair_id, user),
            ("POST", ["repairs"]) => self.create_repair(db, body, user),
            ("PATCH", ["repairs", repair_id]) => self.update_repair(db, repair_id, body, user),
            ("POST", ["repairs", repair_id, "parts"]) => {
                self.consume_part(db, repair_id, body, user)
            }
            ("GET", ["warranties"]) => Ok(json!(query(
                db,
                "SELECT w.*,s.invoice_no,h.imei1,(SELECT date(s.date, '+' || sl.warranty_days || ' days') FROM sale_lines sl WHERE sl.sale_id=w.sale_id AND (w.phone_id IS NULL OR sl.phone_id=w.phone_id) ORDER BY sl.warranty_days DESC LIMIT 1) expiry_date FROM warranty_claims w LEFT JOIN sales s ON s.id=w.sale_id LEFT JOIN phones h ON h.id=w.phone_id ORDER BY w.id DESC",
                &[]
            )?)),
            ("POST", ["warranties"]) => self.create_warranty(db, body, user),
            ("PATCH", ["warranties", claim_id]) => self.update_warranty(db, claim_id, body, user),
            ("GET", ["expenses"]) => {
                allow(user, "cashier")?;
                Ok(json!(query(
                    db,
                    "SELECT * FROM expenses ORDER BY id DESC",
                    &[]
                )?))
            }
            ("POST", ["expenses"]) => self.create_expense(db, body, user),
            ("POST", ["drawings"]) => self.create_drawing(db, body, user),
            ("GET", ["drawings"]) => {
                allow(user, "owner")?;
                Ok(json!(query(
                    db,
                    "SELECT * FROM drawings ORDER BY id DESC",
                    &[]
                )?))
            }
            ("GET", ["cash"]) => {
                allow(user, "cashier")?;
                Ok(json!(query(
                    db,
                    "SELECT * FROM cash_sessions ORDER BY id DESC LIMIT 30",
                    &[]
                )?))
            }
            ("POST", ["cash", "open"]) => self.open_cash(db, body, user),
            ("POST", ["cash", "close"]) => self.close_cash(db, body, user),
            ("GET", ["cash", session_id, "report"]) => self.cash_report(db, session_id, user),
            ("GET", ["market-rates"]) => Ok(json!(query(
                db,
                "SELECT m.*,p.name FROM market_rates m JOIN products p ON p.id=m.product_id WHERE m.id IN (SELECT MAX(id) FROM market_rates GROUP BY product_id) ORDER BY m.id DESC",
                &[]
            )?)),
            ("POST", ["market-rates"]) => self.create_rate(db, body, user),
            ("GET", ["price-history"]) => {
                allow(user, "manager")?;
                Ok(json!(query(
                    db,
                    "SELECT h.*,p.name product_name,u.name changed_by_name FROM price_history h JOIN products p ON p.id=h.product_id LEFT JOIN users u ON u.id=h.changed_by ORDER BY h.id DESC LIMIT 100",
                    &[]
                )?))
            }
            ("GET", ["search"]) => self.search(db, body, user),
            ("GET", ["phone-history"]) => self.phone_history(db, body, user),
            ("GET", ["reports"]) => self.reports(db, body, user),
            ("GET", ["audit"]) => {
                allow(user, "owner")?;
                Ok(json!(query(
                    db,
                    "SELECT a.*,u.name user_name FROM audit a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 200",
                    &[]
                )?))
            }
            ("GET", ["backup"]) => self.list_backups(user),
            ("GET", ["backup", "external"]) => self.list_external_backups(db,user),
            ("POST", ["backup"]) => self.create_backup(db, user),
            ("GET", ["backup", "preferences"]) => self.backup_preferences(db, user),
            ("PUT", ["backup", "preferences"]) => self.set_backup_preferences(db, body, user),
            ("POST", ["backup", "external"]) => self.external_backup(db, user),
            ("POST", ["backup", "verify"]) => self.verify_backup(db, body, user),
            ("POST", ["restore"]) => self.restore(db, body, user),
            _ => Err(err(404, "Endpoint not found")),
        }
    }
    fn create_purchase(&self, db: &Connection, body: &Value, user: &Value) -> Result<Value> {
        allow(user, "manager")?;
        let supplier = contact(db, id(body, "supplier_id"), "supplier")?;
        let lines = v(body, "lines")
            .as_array()
            .ok_or_else(|| err(400, "Add at least one item"))?;
        if lines.is_empty() {
            return Err(err(400, "Add at least one item"));
        }
        let mut total = 0.0;
        for line in lines {
            let p = product(db, id(line, "product_id"))?;
            let cost = money(n(line, "unit_cost"), "Unit cost")?;
            if s(&p, "category") == "phone" {
                let imeis = v(line, "imeis")
                    .as_array()
                    .ok_or_else(|| err(400, "Phones require individual IMEIs"))?;
                if imeis.is_empty() {
                    return Err(err(400, "Phones require individual IMEIs"));
                }
                for imei in imeis {
                    validate_imei(db, &required(imei, "imei1", "IMEI 1")?, &s(imei, "imei2"))?;
                }
                total += cost * imeis.len() as f64;
            } else {
                total += cost * quantity(n(line, "quantity"))? as f64;
            }
        }
        total = money(total, "Total")?;
        let paid = money(n(body, "paid"), "Paid")?;
        if paid > total {
            return Err(err(400, "Paid amount exceeds purchase total"));
        }
        let branch = id(body, "branch_id").max(1);
        let supplier_id = supplier
            .as_ref()
            .map(|c| v(c, "id").clone())
            .unwrap_or(Value::Null);
        tx(db, || {
            let purchase_id = execute(
                db,
                "INSERT INTO purchases(supplier_id,reference,total,paid,payment_method,notes,branch_id,created_by) VALUES(?,?,?,?,?,?,?,?)",
                &[
                    supplier_id.clone(),
                    json!(s(body, "reference")),
                    json!(total),
                    json!(paid),
                    json!(str_or(body, "payment_method", "cash")),
                    json!(s(body, "notes")),
                    json!(branch),
                    v(user, "id").clone(),
                ],
            )?;
            for line in lines {
                let p = product(db, id(line, "product_id"))?;
                let cost = money(n(line, "unit_cost"), "Unit cost")?;
                if s(&p, "category") == "phone" {
                    for imei in v(line, "imeis").as_array().unwrap() {
                        let phone_id = execute(
                            db,
                            "INSERT INTO phones(product_id,imei1,imei2,pta_status,condition_grade,checklist,box_included,charger_included,purchase_cost,supplier_id,notes,branch_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
                            &[
                                v(&p, "id").clone(),
                                json!(s(imei, "imei1")),
                                if s(imei, "imei2").is_empty() {
                                    Value::Null
                                } else {
                                    v(imei, "imei2").clone()
                                },
                                json!(str_or(imei, "pta_status", "unknown")),
                                json!(s(imei, "condition_grade")),
                                json!(v(imei, "checklist").to_string()),
                                json!(v(imei, "box_included") == &json!(true)),
                                json!(v(imei, "charger_included") == &json!(true)),
                                json!(cost),
                                supplier_id.clone(),
                                json!(s(imei, "notes")),
                                json!(branch),
                            ],
                        )?;
                        execute(
                            db,
                            "INSERT INTO purchase_lines(purchase_id,product_id,phone_id,quantity,unit_cost) VALUES(?,?,?,?,?)",
                            &[
                                json!(purchase_id),
                                v(&p, "id").clone(),
                                json!(phone_id),
                                json!(1),
                                json!(cost),
                            ],
                        )?;
                        execute(
                            db,
                            "INSERT INTO stock_movements(product_id,phone_id,delta,reason,reference_id,user_id) VALUES(?,?,?,?,?,?)",
                            &[
                                v(&p, "id").clone(),
                                json!(phone_id),
                                json!(1),
                                json!("purchase"),
                                json!(purchase_id),
                                v(user, "id").clone(),
                            ],
                        )?;
                    }
                } else {
                    let qty = quantity(n(line, "quantity"))?;
                    stock(db, &p, qty, "purchase", purchase_id, user)?;
                    execute(
                        db,
                        "INSERT INTO purchase_lines(purchase_id,product_id,quantity,unit_cost) VALUES(?,?,?,?)",
                        &[
                            json!(purchase_id),
                            v(&p, "id").clone(),
                            json!(qty),
                            json!(cost),
                        ],
                    )?;
                }
            }
            if paid > 0.0 {
                add_payment(
                    db,
                    "out",
                    supplier_id.clone(),
                    Value::Null,
                    json!(purchase_id),
                    Value::Null,
                    &str_or(body, "payment_method", "cash"),
                    paid,
                    user,
                    branch,
                    "",
                )?;
            }
            audit(
                db,
                user,
                "create",
                "purchase",
                json!(purchase_id),
                json!({"total":total}),
            )?;
            Ok(json!({"id":purchase_id,"total":total}))
        })
    }
    fn used_purchase(&self, db: &Connection, body: &Value, user: &Value) -> Result<Value> {
        allow(user, "manager")?;
        let seller = contact(db, id(body, "customer_id"), "customer")?
            .ok_or_else(|| err(400, "Seller required"))?;
        let p = product(db, id(body, "product_id"))?;
        if s(&p, "category") != "phone" {
            return Err(err(400, "Select a phone model"));
        }
        let price = positive(n(body, "agreed_price"), "Agreed price")?;
        let paid = money(n(body, "paid"), "Paid")?;
        if paid > price {
            return Err(err(400, "Paid exceeds agreed price"));
        }
        let imei = required(body, "imei1", "IMEI 1")?;
        validate_imei(db, &imei, &s(body, "imei2"))?;
        let branch = id(body, "branch_id").max(1);
        tx(db, || {
            let phone_id = execute(
                db,
                "INSERT INTO phones(product_id,imei1,imei2,pta_status,condition_grade,checklist,box_included,charger_included,purchase_cost,notes,branch_id) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                &[
                    v(&p, "id").clone(),
                    json!(imei),
                    if s(body, "imei2").is_empty() {
                        Value::Null
                    } else {
                        v(body, "imei2").clone()
                    },
                    json!(str_or(body, "pta_status", "unknown")),
                    json!(s(body, "condition_grade")),
                    json!(v(body, "checklist").to_string()),
                    json!(v(body, "box_included") == &json!(true)),
                    json!(v(body, "charger_included") == &json!(true)),
                    json!(price),
                    json!(s(body, "testing_notes")),
                    json!(branch),
                ],
            )?;
            let x = execute(
                db,
                "INSERT INTO used_purchases(customer_id,phone_id,agreed_price,paid,testing_notes,branch_id,created_by) VALUES(?,?,?,?,?,?,?)",
                &[
                    v(&seller, "id").clone(),
                    json!(phone_id),
                    json!(price),
                    json!(paid),
                    json!(s(body, "testing_notes")),
                    json!(branch),
                    v(user, "id").clone(),
                ],
            )?;
            execute(
                db,
                "INSERT INTO stock_movements(product_id,phone_id,delta,reason,reference_id,user_id) VALUES(?,?,?,?,?,?)",
                &[
                    v(&p, "id").clone(),
                    json!(phone_id),
                    json!(1),
                    json!("used_purchase"),
                    json!(x),
                    v(user, "id").clone(),
                ],
            )?;
            if paid > 0.0 {
                add_payment(
                    db,
                    "out",
                    v(&seller, "id").clone(),
                    Value::Null,
                    Value::Null,
                    Value::Null,
                    &str_or(body, "method", "cash"),
                    paid,
                    user,
                    branch,
                    "Used phone purchase",
                )?;
            }
            audit(
                db,
                user,
                "create",
                "used_purchase",
                json!(x),
                json!({"phone":phone_id}),
            )?;
            Ok(json!({"id":x}))
        })
    }
    fn pay_used_purchase(
        &self,
        db: &Connection,
        purchase_id: &str,
        body: &Value,
        user: &Value,
    ) -> Result<Value> {
        allow(user, "manager")?;
        let u = required_row(
            db,
            "SELECT * FROM used_purchases WHERE id=?",
            &[json!(purchase_id.parse::<i64>().unwrap_or(0))],
            "Used purchase not found",
        )?;
        let amount = positive(n(body, "amount"), "Amount")?;
        if amount > n(&u, "agreed_price") - n(&u, "paid") + 0.001 {
            return Err(err(400, "Payment exceeds balance"));
        }
        tx(db, || {
            execute(
                db,
                "UPDATE used_purchases SET paid=paid+? WHERE id=?",
                &[json!(amount), v(&u, "id").clone()],
            )?;
            add_payment(
                db,
                "out",
                v(&u, "customer_id").clone(),
                Value::Null,
                Value::Null,
                Value::Null,
                &str_or(body, "method", "cash"),
                amount,
                user,
                id(&u, "branch_id"),
                "Used phone purchase balance",
            )?;
            audit(
                db,
                user,
                "payment",
                "used_purchase",
                v(&u, "id").clone(),
                json!({"amount":amount}),
            )?;
            Ok(json!({"ok":true}))
        })
    }
    fn purchase_return(&self, db: &Connection, body: &Value, user: &Value) -> Result<Value> {
        allow(user, "manager")?;
        let line = required_row(
            db,
            "SELECT l.*,p.category,p.name,p.quantity stock,pur.supplier_id,pur.total,pur.paid,pur.branch_id FROM purchase_lines l JOIN products p ON p.id=l.product_id JOIN purchases pur ON pur.id=l.purchase_id WHERE l.id=?",
            &[json!(id(body, "purchase_line_id"))],
            "Purchase line not found",
        )?;
        let previous = one(
            db,
            "SELECT COALESCE(SUM(quantity),0) n FROM purchase_returns WHERE purchase_line_id=?",
            &[v(&line, "id").clone()],
        )?
        .map(|r| id(&r, "n"))
        .unwrap_or(0);
        let qty = quantity(n(body, "quantity"))?;
        if qty > id(&line, "quantity") - previous {
            return Err(err(400, "Return exceeds purchased quantity"));
        }
        if !v(&line, "phone_id").is_null() {
            let h = required_row(
                db,
                "SELECT status FROM phones WHERE id=?",
                &[v(&line, "phone_id").clone()],
                "Phone not found",
            )?;
            if s(&h, "status") != "available" {
                return Err(err(400, "Phone is no longer available"));
            }
        } else if id(&line, "stock") < qty {
            return Err(err(400, "Not enough stock to return"));
        }
        let refund = money(
            if body.get("refund").is_some() {
                n(body, "refund")
            } else {
                n(&line, "unit_cost") * qty as f64
            },
            "Refund",
        )?;
        if refund > n(&line, "total") {
            return Err(err(400, "Refund exceeds purchase total"));
        }
        tx(db, || {
            let x = execute(
                db,
                "INSERT INTO purchase_returns(purchase_line_id,quantity,refund,reason,created_by) VALUES(?,?,?,?,?)",
                &[
                    v(&line, "id").clone(),
                    json!(qty),
                    json!(refund),
                    json!(s(body, "reason")),
                    v(user, "id").clone(),
                ],
            )?;
            if !v(&line, "phone_id").is_null() {
                execute(
                    db,
                    "UPDATE phones SET status='supplier_return' WHERE id=?",
                    &[v(&line, "phone_id").clone()],
                )?;
                execute(
                    db,
                    "INSERT INTO stock_movements(product_id,phone_id,delta,reason,reference_id,user_id) VALUES(?,?,?,?,?,?)",
                    &[
                        v(&line, "product_id").clone(),
                        v(&line, "phone_id").clone(),
                        json!(-1),
                        json!("purchase_return"),
                        json!(x),
                        v(user, "id").clone(),
                    ],
                )?;
            } else {
                stock(
                    db,
                    &product(db, id(&line, "product_id"))?,
                    -qty,
                    "purchase_return",
                    x,
                    user,
                )?;
            }
            execute(
                db,
                "UPDATE purchases SET total=total-? WHERE id=?",
                &[json!(refund), v(&line, "purchase_id").clone()],
            )?;
            let current = required_row(
                db,
                "SELECT total,paid FROM purchases WHERE id=?",
                &[v(&line, "purchase_id").clone()],
                "Purchase not found",
            )?;
            if n(&current, "paid") > n(&current, "total") {
                let received = money(n(&current, "paid") - n(&current, "total"), "Refund")?;
                execute(
                    db,
                    "UPDATE purchases SET paid=paid-? WHERE id=?",
                    &[json!(received), v(&line, "purchase_id").clone()],
                )?;
                add_payment(
                    db,
                    "in",
                    v(&line, "supplier_id").clone(),
                    Value::Null,
                    v(&line, "purchase_id").clone(),
                    Value::Null,
                    &str_or(body, "method", "cash"),
                    received,
                    user,
                    id(&line, "branch_id"),
                    "Supplier return refund",
                )?;
            }
            audit(
                db,
                user,
                "return",
                "purchase",
                v(&line, "purchase_id").clone(),
                json!({"line":id(&line,"id"),"qty":qty,"refund":refund}),
            )?;
            Ok(json!({"id":x}))
        })
    }

    fn sale_details(&self, db: &Connection, sale_id: &str, user: &Value) -> Result<Value> {
        let mut sale = required_row(
            db,
            "SELECT s.*,c.name customer,c.phone customer_phone FROM sales s LEFT JOIN contacts c ON c.id=s.customer_id WHERE s.id=?",
            &[json!(sale_id.parse::<i64>().unwrap_or(0))],
            "Sale not found",
        )?;
        let sid = v(&sale, "id").clone();
        let lines = query(
            db,
            "SELECT l.*,h.imei1,h.imei2 FROM sale_lines l LEFT JOIN phones h ON h.id=l.phone_id WHERE l.sale_id=?",
            std::slice::from_ref(&sid),
        )?;
        sale["lines"] = json!(
            lines
                .into_iter()
                .map(|l| if role_level(&s(user, "role")) >= 4 {
                    l
                } else {
                    strip(l, &["unit_cost"])
                })
                .collect::<Vec<_>>()
        );
        sale["payments"] = json!(query(
            db,
            "SELECT * FROM payments WHERE sale_id=? ORDER BY id",
            std::slice::from_ref(&sid)
        )?);
        sale["installments"] = json!(query(
            db,
            "SELECT * FROM installments WHERE sale_id=? ORDER BY due_date",
            &[sid]
        )?);
        sale["returns"] = json!(query(db,
            "SELECT r.*,l.description,h.imei1 FROM sale_returns r JOIN sale_lines l ON l.id=r.sale_line_id LEFT JOIN phones h ON h.id=l.phone_id WHERE r.sale_id=? ORDER BY r.id",
            &[v(&sale,"id").clone()])?);
        Ok(sale)
    }
    fn sale_return(&self, db: &Connection, sale_id: &str, body: &Value, user: &Value) -> Result<Value> {
        allow(user, "manager")?;
        let sale = required_row(db, "SELECT * FROM sales WHERE id=? AND status='completed'", &[json!(sale_id.parse::<i64>().unwrap_or(0))], "Sale not found")?;
        if !v(&sale,"trade_in_phone_id").is_null() {
            return Err(err(400,"Trade-in sales require a separate trade-in reversal before returning"));
        }
        let line = required_row(db, "SELECT * FROM sale_lines WHERE id=? AND sale_id=?", &[json!(id(body,"sale_line_id")),v(&sale,"id").clone()], "Sale item not found")?;
        let prior = one(db,"SELECT COALESCE(SUM(quantity),0) n FROM sale_returns WHERE sale_line_id=?",&[v(&line,"id").clone()])?.map(|x|id(&x,"n")).unwrap_or(0);
        let qty = quantity(n(body,"quantity"))?;
        if prior + qty > id(&line,"quantity") { return Err(err(400,"Return exceeds sold quantity")); }
        let restock = body.get("restock").and_then(Value::as_bool).unwrap_or(true);
        if !v(&line,"phone_id").is_null() {
            let phone=required_row(db,"SELECT status,sale_id FROM phones WHERE id=?",&[v(&line,"phone_id").clone()],"Phone not found")?;
            if s(&phone,"status")!="sold" || id(&phone,"sale_id")!=id(&sale,"id") { return Err(err(400,"Phone is no longer linked to this sale")); }
        }
        let gross=n(&line,"unit_price")*qty as f64;
        let discount_share=if n(&sale,"subtotal")>0.0 { n(&sale,"discount")*gross/n(&sale,"subtotal") } else {0.0};
        let amount=money((gross-discount_share).min(n(&sale,"total")),"Return amount")?;
        let new_total=money((n(&sale,"total")-amount).max(0.0),"Sale total")?;
        let refund=money((n(&sale,"paid")-new_total).max(0.0),"Refund")?;
        let new_paid=money(n(&sale,"paid")-refund,"Paid")?;
        let credit_reduction=money(amount-refund,"Credit reduction")?;
        let method=str_or(body,"refund_method","cash");
        if !["cash","card","bank_transfer","easypaisa","jazzcash"].contains(&method.as_str()) { return Err(err(400,"Invalid refund method")); }
        tx(db,||{
            let return_id=execute(db,"INSERT INTO sale_returns(sale_id,sale_line_id,quantity,amount,refund,refund_method,restock,reason,created_by) VALUES(?,?,?,?,?,?,?,?,?)",&[v(&sale,"id").clone(),v(&line,"id").clone(),json!(qty),json!(amount),json!(refund),json!(method),json!(restock),json!(s(body,"reason")),v(user,"id").clone()])?;
            execute(db,"UPDATE sales SET total=?,paid=?,status=CASE WHEN ?=0 THEN 'returned' ELSE 'completed' END WHERE id=?",&[json!(new_total),json!(new_paid),json!(new_total),v(&sale,"id").clone()])?;
            if !v(&line,"phone_id").is_null() {
                execute(db,"UPDATE phones SET status=?,sale_id=NULL WHERE id=?",&[json!(if restock{"available"}else{"returned"}),v(&line,"phone_id").clone()])?;
                if restock { execute(db,"INSERT INTO stock_movements(product_id,phone_id,delta,reason,reference_id,user_id) VALUES(?,?,?,?,?,?)",&[v(&line,"product_id").clone(),v(&line,"phone_id").clone(),json!(1),json!("sale_return"),json!(return_id),v(user,"id").clone()])?; }
            } else if restock {
                let p=product(db,id(&line,"product_id"))?;
                stock(db,&p,qty,"sale_return",return_id,user)?;
            }
            if refund>0.0 { add_payment(db,"out",v(&sale,"customer_id").clone(),v(&sale,"id").clone(),Value::Null,Value::Null,&method,refund,user,id(&sale,"branch_id"),&format!("Refund for return #{return_id}"))?; }
            let mut remaining=credit_reduction;
            for installment in query(db,"SELECT * FROM installments WHERE sale_id=? ORDER BY due_date DESC,id DESC",&[v(&sale,"id").clone()])? {
                if remaining<=0.0 {break;}
                let unpaid=money(n(&installment,"amount")-n(&installment,"paid"),"Unpaid installment")?;
                let reduced=remaining.min(unpaid);
                if reduced>0.0 {
                    if (n(&installment,"amount")-reduced).abs()<0.001 {
                        execute(db,"DELETE FROM installments WHERE id=?",&[v(&installment,"id").clone()])?;
                    } else {
                        execute(db,"UPDATE installments SET amount=amount-? WHERE id=?",&[json!(reduced),v(&installment,"id").clone()])?;
                    }
                    remaining=money(remaining-reduced,"Remaining credit")?;
                }
            }
            if remaining>0.01 && one(db,"SELECT id FROM installments WHERE sale_id=?",&[v(&sale,"id").clone()])?.is_some(){return Err(err(400,"Installment schedule cannot absorb this return"));}
            execute(db,"DELETE FROM installments WHERE sale_id=? AND amount<=0",&[v(&sale,"id").clone()])?;
            audit(db,user,"return","sale",v(&sale,"id").clone(),json!({"return_id":return_id,"sale_line_id":id(&line,"id"),"quantity":qty,"amount":amount,"refund":refund,"restock":restock}))?;
            Ok(json!({"id":return_id,"amount":amount,"refund":refund,"new_total":new_total,"new_paid":new_paid}))
        })
    }
    fn create_sale(&self, db: &Connection, body: &Value, user: &Value) -> Result<Value> {
        allow(user, "salesman")?;
        let customer = contact(db, id(body, "customer_id"), "customer")?;
        let lines = v(body, "lines")
            .as_array()
            .filter(|a| !a.is_empty())
            .ok_or_else(|| err(400, "Add at least one item"))?;
        let mut checked = Vec::new();
        let mut subtotal = 0.0;
        let mut selected = std::collections::HashSet::new();
        for line in lines {
            let p = product(db, id(line, "product_id"))?;
            let phone = s(&p, "category") == "phone";
            let qty = if phone {
                1
            } else {
                quantity(n(line, "quantity"))?
            };
            let price = money(n(line, "unit_price"), "Sale price")?;
            if price < n(&p, "min_price") && role_level(&s(user, "role")) < 4 {
                return Err(err(400, format!("Price below minimum: {}", s(&p, "name"))));
            }
            let h = if phone {
                let h = required_row(
                    db,
                    "SELECT * FROM phones WHERE id=? AND product_id=? AND status='available'",
                    &[json!(id(line, "phone_id")), v(&p, "id").clone()],
                    "Phone unavailable",
                )?;
                if !selected.insert(id(&h, "id")) {
                    return Err(err(400, "The same phone cannot be sold twice"));
                }
                Some(h)
            } else {
                if id(&p, "quantity") < qty {
                    return Err(err(400, format!("Not enough stock: {}", s(&p, "name"))));
                }
                None
            };
            subtotal += price * qty as f64;
            checked.push((p, h, qty, price));
        }
        subtotal = money(subtotal, "Subtotal")?;
        let discount = money(n(body, "discount"), "Discount")?;
        if discount > subtotal {
            return Err(err(400, "Discount exceeds subtotal"));
        }
        if role_level(&s(user, "role")) < 4
            && checked
                .iter()
                .any(|(p, _, _, price)| price * (1.0 - discount / subtotal) < n(p, "min_price"))
        {
            return Err(err(
                400,
                "Manager approval required below minimum sale price",
            ));
        }
        if discount > subtotal * 0.1 && role_level(&s(user, "role")) < 4 {
            return Err(err(400, "Manager approval required for discounts over 10%"));
        }
        let trade_value = money(n(body, "trade_in_value"), "Trade-in value")?;
        let trade = v(body, "trade_in");
        if trade_value > 0.0 {
            if customer.is_none() {
                return Err(err(400, "Trade-in requires a customer"));
            }
            validate_imei(
                db,
                &required(trade, "imei1", "Trade-in IMEI")?,
                &s(trade, "imei2"),
            )?;
            let tp = product(db, id(trade, "product_id"))?;
            if s(&tp, "category") != "phone" {
                return Err(err(400, "Trade-in product must be a phone"));
            }
        }
        if trade_value > subtotal - discount {
            return Err(err(400, "Trade-in value exceeds sale"));
        }
        let total = money(subtotal - discount - trade_value, "Total")?;
        let payments = v(body, "payments").as_array().cloned().unwrap_or_default();
        let mut paid = 0.0;
        for p in &payments {
            paid += positive(n(p, "amount"), "Payment")?;
        }
        paid = money(paid, "Paid")?;
        if paid > total {
            return Err(err(400, "Payments exceed amount due"));
        }
        if paid < total && customer.is_none() {
            return Err(err(400, "Credit sale requires a customer"));
        }
        let installments = v(body, "installments").as_array();
        if let Some(entries) = installments {
            let mut sum = 0.0;
            for entry in entries {
                required(entry, "due_date", "Due date")?;
                sum += positive(n(entry, "amount"), "Installment")?;
            }
            if (sum - (total - paid)).abs() > 0.01 {
                return Err(err(
                    400,
                    "Installment schedule must equal outstanding balance",
                ));
            }
        }
        let branch = id(body, "branch_id").max(1);
        let customer_id = customer
            .as_ref()
            .map(|c| v(c, "id").clone())
            .unwrap_or(Value::Null);
        tx(db, || {
            let next = one(db, "SELECT COALESCE(MAX(id),0)+1 n FROM sales", &[])?
                .map(|x| id(&x, "n"))
                .unwrap_or(1);
            let inv = format!("INV-{}-{next:05}", Utc::now().format("%Y%m%d"));
            let sale_id = execute(
                db,
                "INSERT INTO sales(invoice_no,customer_id,subtotal,discount,total,paid,trade_in_value,notes,branch_id,created_by) VALUES(?,?,?,?,?,?,?,?,?,?)",
                &[
                    json!(inv),
                    customer_id.clone(),
                    json!(subtotal),
                    json!(discount),
                    json!(total),
                    json!(paid),
                    json!(trade_value),
                    json!(s(body, "notes")),
                    json!(branch),
                    v(user, "id").clone(),
                ],
            )?;
            for (p, h, qty, price) in &checked {
                let cost = h
                    .as_ref()
                    .map(|h| n(h, "purchase_cost") + n(h, "prep_cost"))
                    .unwrap_or(n(p, "cost"));
                let phone_id = h
                    .as_ref()
                    .map(|h| v(h, "id").clone())
                    .unwrap_or(Value::Null);
                execute(
                    db,
                    "INSERT INTO sale_lines(sale_id,product_id,phone_id,description,quantity,unit_price,unit_cost,warranty_days) VALUES(?,?,?,?,?,?,?,?)",
                    &[
                        json!(sale_id),
                        v(p, "id").clone(),
                        phone_id.clone(),
                        v(p, "name").clone(),
                        json!(qty),
                        json!(price),
                        json!(cost),
                        v(p, "warranty_days").clone(),
                    ],
                )?;
                if h.is_some() {
                    execute(
                        db,
                        "UPDATE phones SET status='sold',sale_id=? WHERE id=?",
                        &[json!(sale_id), phone_id.clone()],
                    )?;
                    execute(
                        db,
                        "INSERT INTO stock_movements(product_id,phone_id,delta,reason,reference_id,user_id) VALUES(?,?,?,?,?,?)",
                        &[
                            v(p, "id").clone(),
                            phone_id,
                            json!(-1),
                            json!("sale"),
                            json!(sale_id),
                            v(user, "id").clone(),
                        ],
                    )?;
                } else {
                    stock(db, p, -qty, "sale", sale_id, user)?;
                }
            }
            for p in &payments {
                add_payment(
                    db,
                    "in",
                    customer_id.clone(),
                    json!(sale_id),
                    Value::Null,
                    Value::Null,
                    &str_or(p, "method", "cash"),
                    positive(n(p, "amount"), "Payment")?,
                    user,
                    branch,
                    "",
                )?;
            }
            if trade_value > 0.0 {
                let tp = product(db, id(trade, "product_id"))?;
                let phone_id = execute(
                    db,
                    "INSERT INTO phones(product_id,imei1,imei2,pta_status,condition_grade,checklist,box_included,charger_included,purchase_cost,notes,branch_id) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                    &[
                        v(&tp, "id").clone(),
                        v(trade, "imei1").clone(),
                        if s(trade, "imei2").is_empty() {
                            Value::Null
                        } else {
                            v(trade, "imei2").clone()
                        },
                        json!(str_or(trade, "pta_status", "unknown")),
                        json!(s(trade, "condition_grade")),
                        json!(v(trade, "checklist").to_string()),
                        json!(v(trade, "box_included") == &json!(true)),
                        json!(v(trade, "charger_included") == &json!(true)),
                        json!(trade_value),
                        json!(s(trade, "notes")),
                        json!(branch),
                    ],
                )?;
                execute(
                    db,
                    "UPDATE sales SET trade_in_phone_id=? WHERE id=?",
                    &[json!(phone_id), json!(sale_id)],
                )?;
                execute(
                    db,
                    "INSERT INTO stock_movements(product_id,phone_id,delta,reason,reference_id,user_id) VALUES(?,?,?,?,?,?)",
                    &[
                        v(&tp, "id").clone(),
                        json!(phone_id),
                        json!(1),
                        json!("trade_in"),
                        json!(sale_id),
                        v(user, "id").clone(),
                    ],
                )?;
            }
            if let Some(entries) = installments {
                for entry in entries {
                    execute(
                        db,
                        "INSERT INTO installments(sale_id,due_date,amount) VALUES(?,?,?)",
                        &[
                            json!(sale_id),
                            v(entry, "due_date").clone(),
                            json!(positive(n(entry, "amount"), "Installment")?),
                        ],
                    )?;
                }
            }
            audit(
                db,
                user,
                "create",
                "sale",
                json!(sale_id),
                json!({"invoice":inv,"total":total}),
            )?;
            Ok(json!({"id":sale_id,"invoice_no":inv,"total":total}))
        })
    }
    fn schedule_installments(
        &self,
        db: &Connection,
        sale_id: &str,
        body: &Value,
        user: &Value,
    ) -> Result<Value> {
        allow(user, "cashier")?;
        let sale = required_row(
            db,
            "SELECT * FROM sales WHERE id=?",
            &[json!(sale_id.parse::<i64>().unwrap_or(0))],
            "Sale not found",
        )?;
        if v(&sale, "customer_id").is_null() {
            return Err(err(400, "Installments require a customer"));
        }
        if one(
            db,
            "SELECT id FROM installments WHERE sale_id=? LIMIT 1",
            &[v(&sale, "id").clone()],
        )?
        .is_some()
        {
            return Err(err(400, "Installments already scheduled"));
        }
        let entries = v(body, "entries")
            .as_array()
            .filter(|x| !x.is_empty())
            .ok_or_else(|| err(400, "Add at least one installment"))?;
        let mut sum = 0.0;
        for entry in entries {
            required(entry, "due_date", "Due date")?;
            sum += positive(n(entry, "amount"), "Installment")?;
        }
        if (money(sum, "Schedule")? - (n(&sale, "total") - n(&sale, "paid"))).abs() > 0.01 {
            return Err(err(400, "Schedule must equal remaining balance"));
        }
        tx(db, || {
            for entry in entries {
                execute(
                    db,
                    "INSERT INTO installments(sale_id,due_date,amount) VALUES(?,?,?)",
                    &[
                        v(&sale, "id").clone(),
                        v(entry, "due_date").clone(),
                        json!(positive(n(entry, "amount"), "Installment")?),
                    ],
                )?;
            }
            audit(
                db,
                user,
                "schedule",
                "sale",
                v(&sale, "id").clone(),
                json!({"count":entries.len()}),
            )?;
            Ok(json!({"ok":true}))
        })
    }
    fn record_payment(&self, db: &Connection, body: &Value, user: &Value) -> Result<Value> {
        allow(user, "cashier")?;
        let amount = positive(n(body, "amount"), "Amount")?;
        let method = required(body, "method", "Payment method")?;
        let targets = [
            ("sale_id", "sales", "Sale"),
            ("purchase_id", "purchases", "Purchase"),
            ("repair_id", "repairs", "Repair"),
        ];
        let chosen: Vec<_> = targets
            .iter()
            .filter(|(key, _, _)| id(body, key) > 0)
            .collect();
        if chosen.len() != 1 {
            return Err(err(
                400,
                "Payment must reference one sale, purchase, or repair",
            ));
        }
        let (field, table, label) = chosen[0];
        let row = required_row(
            db,
            &format!("SELECT * FROM {table} WHERE id=?"),
            &[json!(id(body, field))],
            &format!("{label} not found"),
        )?;
        let balance = if *field == "repair_id" {
            n(&row, "labor_charge") + n(&row, "parts_cost") - n(&row, "paid")
        } else {
            n(&row, "total") - n(&row, "paid")
        };
        if amount > balance + 0.001 {
            return Err(err(400, "Payment exceeds balance"));
        }
        tx(db, || {
            execute(
                db,
                &format!("UPDATE {table} SET paid=paid+? WHERE id=?"),
                &[json!(amount), v(&row, "id").clone()],
            )?;
            let direction = if *field == "purchase_id" { "out" } else { "in" };
            let contact_id = if *field == "purchase_id" {
                v(&row, "supplier_id").clone()
            } else {
                v(&row, "customer_id").clone()
            };
            add_payment(
                db,
                direction,
                contact_id,
                if *field == "sale_id" {
                    v(&row, "id").clone()
                } else {
                    Value::Null
                },
                if *field == "purchase_id" {
                    v(&row, "id").clone()
                } else {
                    Value::Null
                },
                if *field == "repair_id" {
                    v(&row, "id").clone()
                } else {
                    Value::Null
                },
                &method,
                amount,
                user,
                id(&row, "branch_id"),
                &s(body, "notes"),
            )?;
            audit(
                db,
                user,
                "payment",
                &table[..table.len() - 1],
                v(&row, "id").clone(),
                json!({"amount":amount}),
            )?;
            Ok(json!({"ok":true}))
        })
    }
    fn pay_installment(
        &self,
        db: &Connection,
        installment_id: &str,
        body: &Value,
        user: &Value,
    ) -> Result<Value> {
        allow(user, "cashier")?;
        let i = required_row(
            db,
            "SELECT * FROM installments WHERE id=?",
            &[json!(installment_id.parse::<i64>().unwrap_or(0))],
            "Installment not found",
        )?;
        let amount = positive(n(body, "amount"), "Amount")?;
        if amount > n(&i, "amount") - n(&i, "paid") + 0.001 {
            return Err(err(400, "Payment exceeds installment balance"));
        }
        let sale = required_row(
            db,
            "SELECT * FROM sales WHERE id=?",
            &[v(&i, "sale_id").clone()],
            "Sale not found",
        )?;
        if amount > n(&sale, "total") - n(&sale, "paid") + 0.001 {
            return Err(err(400, "Payment exceeds sale balance"));
        }
        tx(db, || {
            execute(
                db,
                "UPDATE installments SET paid=paid+?,paid_at=CURRENT_TIMESTAMP WHERE id=?",
                &[json!(amount), v(&i, "id").clone()],
            )?;
            execute(
                db,
                "UPDATE sales SET paid=paid+? WHERE id=?",
                &[json!(amount), v(&sale, "id").clone()],
            )?;
            add_payment(
                db,
                "in",
                v(&sale, "customer_id").clone(),
                v(&sale, "id").clone(),
                Value::Null,
                Value::Null,
                &str_or(body, "method", "cash"),
                amount,
                user,
                id(&sale, "branch_id"),
                "",
            )?;
            audit(
                db,
                user,
                "payment",
                "installment",
                v(&i, "id").clone(),
                json!({"amount":amount}),
            )?;
            Ok(json!({"ok":true}))
        })
    }
    fn ledger(&self, db: &Connection, body: &Value, user: &Value) -> Result<Value> {
        let kind = required(body, "kind", "Contact type")?;
        let c = contact(db, id(body, "contact_id"), &kind)?
            .ok_or_else(|| err(400, "Contact required"))?;
        if kind == "supplier" {
            allow(user, "manager")?
        }
        let mut transactions = if kind == "customer" {
            let mut x = query(
                db,
                "SELECT date,invoice_no reference,total amount,paid,'sale' type FROM sales WHERE customer_id=?",
                &[v(&c, "id").clone()],
            )?;
            x.extend(query(db,"SELECT date,job_no reference,labor_charge+parts_cost amount,paid,'repair' type FROM repairs WHERE customer_id=?",&[v(&c,"id").clone()])?);
            x.extend(query(db,"SELECT u.date, ('USED-' || u.id) reference, u.agreed_price amount, u.paid, 'used_purchase' type FROM used_purchases u WHERE u.customer_id=?",&[v(&c,"id").clone()])?);
            x
        } else {
            query(
                db,
                "SELECT date,reference,total amount,paid,'purchase' type FROM purchases WHERE supplier_id=?",
                &[v(&c, "id").clone()],
            )?
        };
        transactions.sort_by_key(|b| std::cmp::Reverse(s(b, "date")));
        let balance = if kind == "customer" {
            let sales_repairs_unpaid: f64 = transactions
                .iter()
                .filter(|t| s(t, "type") != "used_purchase")
                .map(|t| n(t, "amount") - n(t, "paid"))
                .sum();
            let used_unpaid: f64 = transactions
                .iter()
                .filter(|t| s(t, "type") == "used_purchase")
                .map(|t| n(t, "amount") - n(t, "paid"))
                .sum();
            let net = if sales_repairs_unpaid == 0.0 && used_unpaid > 0.0 {
                used_unpaid
            } else {
                sales_repairs_unpaid - used_unpaid
            };
            money(net, "Balance")?
        } else {
            money(
                transactions
                    .iter()
                    .map(|t| n(t, "amount") - n(t, "paid"))
                    .sum(),
                "Balance",
            )?
        };
        Ok(
            json!({"contact":c,"transactions":transactions,"balance":balance,"payments":query(db,"SELECT * FROM payments WHERE contact_id=? ORDER BY id DESC",&[v(&c,"id").clone()])?}),
        )
    }
    fn repair_details(&self, db: &Connection, repair_id: &str, _user: &Value) -> Result<Value> {
        let mut repair = required_row(
            db,
            "SELECT r.*,c.name customer,c.phone,u.name technician FROM repairs r LEFT JOIN contacts c ON c.id=r.customer_id LEFT JOIN users u ON u.id=r.technician_id WHERE r.id=?",
            &[json!(repair_id.parse::<i64>().unwrap_or(0))],
            "Repair not found",
        )?;
        let parts = query(
            db,
            "SELECT rp.*, p.name product_name, p.sku FROM repair_parts rp JOIN products p ON p.id=rp.product_id WHERE rp.repair_id=? ORDER BY rp.id",
            &[v(&repair, "id").clone()],
        )?;
        repair["parts"] = json!(parts);
        Ok(repair)
    }
    fn create_repair(&self, db: &Connection, body: &Value, user: &Value) -> Result<Value> {
        let c = contact(db, id(body, "customer_id"), "customer")?
            .ok_or_else(|| err(400, "Customer required"))?;
        let next = one(db, "SELECT COALESCE(MAX(id),0)+1 n FROM repairs", &[])?
            .map(|x| id(&x, "n"))
            .unwrap_or(1);
        let job = format!("JOB-{next:05}");
        let x = execute(
            db,
            "INSERT INTO repairs(job_no,customer_id,model,imei,fault,condition_notes,received_accessories,expected_date,technician_id,labor_charge,other_cost,branch_id,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
            &[
                json!(job),
                v(&c, "id").clone(),
                json!(required(body, "model", "Model")?),
                json!(s(body, "imei")),
                json!(required(body, "fault", "Fault")?),
                json!(s(body, "condition_notes")),
                json!(s(body, "received_accessories")),
                json!(s(body, "expected_date")),
                optional_id(body, "technician_id"),
                json!(money(n(body, "labor_charge"), "Labor charge")?),
                json!(money(n(body, "other_cost"), "Other cost")?),
                json!(id(body, "branch_id").max(1)),
                v(user, "id").clone(),
            ],
        )?;
        audit(db, user, "create", "repair", json!(x), json!({}))?;
        Ok(json!({"id":x,"job_no":job}))
    }
    fn update_repair(
        &self,
        db: &Connection,
        repair_id: &str,
        body: &Value,
        user: &Value,
    ) -> Result<Value> {
        let r = required_row(
            db,
            "SELECT * FROM repairs WHERE id=?",
            &[json!(repair_id.parse::<i64>().unwrap_or(0))],
            "Repair not found",
        )?;
        let allowed = [
            "status",
            "technician_id",
            "labor_charge",
            "other_cost",
            "expected_date",
            "condition_notes",
        ];
        let changes: Vec<_> = allowed
            .iter()
            .filter(|k| body.get(**k).is_some())
            .copied()
            .collect();
        if changes.is_empty() {
            return Err(err(400, "No changes"));
        }
        if changes.contains(&"status")
            && ![
                "Received",
                "Checking",
                "Waiting for Part",
                "In Repair",
                "Ready",
                "Delivered",
            ]
            .contains(&s(body, "status").as_str())
        {
            return Err(err(400, "Invalid status"));
        }
        let mut params = Vec::new();
        for key in &changes {
            params.push(if ["labor_charge", "other_cost"].contains(key) {
                json!(money(n(body, key), key)?)
            } else {
                v(body, key).clone()
            });
        }
        params.push(v(&r, "id").clone());
        let delivered = s(body, "status") == "Delivered";
        execute(
            db,
            &format!(
                "UPDATE repairs SET {}{} WHERE id=?",
                changes
                    .iter()
                    .map(|x| format!("{x}=?"))
                    .collect::<Vec<_>>()
                    .join(","),
                if delivered {
                    ",delivered_at=CURRENT_TIMESTAMP"
                } else {
                    ""
                }
            ),
            &params,
        )?;
        audit(
            db,
            user,
            "update",
            "repair",
            v(&r, "id").clone(),
            body.clone(),
        )?;
        Ok(json!({"ok":true}))
    }
    fn consume_part(
        &self,
        db: &Connection,
        repair_id: &str,
        body: &Value,
        user: &Value,
    ) -> Result<Value> {
        let r = required_row(
            db,
            "SELECT * FROM repairs WHERE id=?",
            &[json!(repair_id.parse::<i64>().unwrap_or(0))],
            "Repair not found",
        )?;
        let p = product(db, id(body, "product_id"))?;
        if s(&p, "category") != "spare_part" {
            return Err(err(400, "Select a spare part"));
        }
        let qty = quantity(n(body, "quantity"))?;
        tx(db, || {
            stock(db, &p, -qty, "repair", id(&r, "id"), user)?;
            execute(
                db,
                "INSERT INTO repair_parts(repair_id,product_id,quantity,unit_cost) VALUES(?,?,?,?)",
                &[
                    v(&r, "id").clone(),
                    v(&p, "id").clone(),
                    json!(qty),
                    v(&p, "cost").clone(),
                ],
            )?;
            execute(
                db,
                "UPDATE repairs SET parts_cost=parts_cost+? WHERE id=?",
                &[
                    json!(money(n(&p, "cost") * qty as f64, "Part cost")?),
                    v(&r, "id").clone(),
                ],
            )?;
            audit(
                db,
                user,
                "consume_part",
                "repair",
                v(&r, "id").clone(),
                json!({"product":id(&p,"id"),"qty":qty}),
            )?;
            Ok(json!({"ok":true}))
        })
    }
    fn create_warranty(&self, db: &Connection, body: &Value, user: &Value) -> Result<Value> {
        let sale = required_row(
            db,
            "SELECT * FROM sales WHERE id=?",
            &[json!(id(body, "sale_id"))],
            "Sale not found",
        )?;
        if id(body, "phone_id") > 0
            && one(
                db,
                "SELECT id FROM sale_lines WHERE sale_id=? AND phone_id=?",
                &[v(&sale, "id").clone(), json!(id(body, "phone_id"))],
            )?
            .is_none()
        {
            return Err(err(400, "Phone does not belong to this sale"));
        }
        let x = execute(
            db,
            "INSERT INTO warranty_claims(sale_id,phone_id,issue,action,result,created_by) VALUES(?,?,?,?,?,?)",
            &[
                v(&sale, "id").clone(),
                optional_id(body, "phone_id"),
                json!(required(body, "issue", "Issue")?),
                json!(s(body, "action")),
                json!(s(body, "result")),
                v(user, "id").clone(),
            ],
        )?;
        audit(db, user, "create", "warranty", json!(x), json!({}))?;
        Ok(json!({"id":x}))
    }
    fn update_warranty(
        &self,
        db: &Connection,
        claim_id: &str,
        body: &Value,
        user: &Value,
    ) -> Result<Value> {
        let x = required_row(
            db,
            "SELECT * FROM warranty_claims WHERE id=?",
            &[json!(claim_id.parse::<i64>().unwrap_or(0))],
            "Claim not found",
        )?;
        let status = required(body, "status", "Status")?;
        if !["open", "approved", "rejected", "resolved"].contains(&status.as_str()) {
            return Err(err(400, "Invalid status"));
        }
        execute(
            db,
            "UPDATE warranty_claims SET status=?,action=?,result=?,closed_at=CASE WHEN ?='resolved' THEN CURRENT_TIMESTAMP ELSE closed_at END WHERE id=?",
            &[
                json!(status),
                json!(s(body, "action")),
                json!(s(body, "result")),
                json!(status),
                v(&x, "id").clone(),
            ],
        )?;
        audit(
            db,
            user,
            "update",
            "warranty",
            v(&x, "id").clone(),
            body.clone(),
        )?;
        Ok(json!({"ok":true}))
    }
    fn create_expense(&self, db: &Connection, body: &Value, user: &Value) -> Result<Value> {
        allow(user, "cashier")?;
        let x = execute(
            db,
            "INSERT INTO expenses(category,description,amount,method,branch_id,created_by) VALUES(?,?,?,?,?,?)",
            &[
                json!(required(body, "category", "Category")?),
                json!(s(body, "description")),
                json!(positive(n(body, "amount"), "Amount")?),
                json!(str_or(body, "method", "cash")),
                json!(id(body, "branch_id").max(1)),
                v(user, "id").clone(),
            ],
        )?;
        audit(db, user, "create", "expense", json!(x), json!({}))?;
        Ok(json!({"id":x}))
    }
    fn create_drawing(&self, db: &Connection, body: &Value, user: &Value) -> Result<Value> {
        allow(user, "owner")?;
        let x = execute(
            db,
            "INSERT INTO drawings(amount,notes,branch_id,created_by) VALUES(?,?,?,?)",
            &[
                json!(positive(n(body, "amount"), "Amount")?),
                json!(s(body, "notes")),
                json!(id(body, "branch_id").max(1)),
                v(user, "id").clone(),
            ],
        )?;
        audit(db, user, "create", "drawing", json!(x), json!({}))?;
        Ok(json!({"id":x}))
    }
    fn open_cash(&self, db: &Connection, body: &Value, user: &Value) -> Result<Value> {
        allow(user, "cashier")?;
        let branch = id(body, "branch_id").max(1);
        if one(
            db,
            "SELECT id FROM cash_sessions WHERE branch_id=? AND closed_at IS NULL",
            &[json!(branch)],
        )?
        .is_some()
        {
            return Err(err(400, "Cash session already open"));
        }
        let x = execute(
            db,
            "INSERT INTO cash_sessions(opening,branch_id,opened_by) VALUES(?,?,?)",
            &[
                json!(money(n(body, "opening"), "Opening")?),
                json!(branch),
                v(user, "id").clone(),
            ],
        )?;
        audit(db, user, "open", "cash", json!(x), json!({}))?;
        Ok(json!({"id":x}))
    }
    fn close_cash(&self, db: &Connection, body: &Value, user: &Value) -> Result<Value> {
        allow(user, "cashier")?;
        let c = required_row(
            db,
            "SELECT * FROM cash_sessions WHERE id=? AND closed_at IS NULL",
            &[json!(id(body, "id"))],
            "Open session not found",
        )?;
        let scalar = |sql: &str| -> Result<f64> {
            Ok(one(
                db,
                sql,
                &[v(&c, "branch_id").clone(), v(&c, "opened_at").clone()],
            )?
            .map(|r| n(&r, "n"))
            .unwrap_or(0.0))
        };
        let ins = scalar(
            "SELECT COALESCE(SUM(amount),0) n FROM payments WHERE method='cash' AND direction='in' AND branch_id=? AND date>=?",
        )?;
        let outs = scalar(
            "SELECT COALESCE(SUM(amount),0) n FROM payments WHERE method='cash' AND direction='out' AND branch_id=? AND date>=?",
        )?;
        let expenses = scalar(
            "SELECT COALESCE(SUM(amount),0) n FROM expenses WHERE method='cash' AND branch_id=? AND date>=?",
        )?;
        let draws =
            scalar("SELECT COALESCE(SUM(amount),0) n FROM drawings WHERE branch_id=? AND date>=?")?;
        let expected = money(
            n(&c, "opening") + ins - outs - expenses - draws,
            "Expected closing",
        )?;
        let actual = money(n(body, "actual_closing"), "Actual closing")?;
        execute(
            db,
            "UPDATE cash_sessions SET closed_at=CURRENT_TIMESTAMP,expected_closing=?,actual_closing=? WHERE id=?",
            &[json!(expected), json!(actual), v(&c, "id").clone()],
        )?;
        audit(
            db,
            user,
            "close",
            "cash",
            v(&c, "id").clone(),
            json!({"expected":expected}),
        )?;
        Ok(json!({"expected":expected,"variance":((actual-expected)*100.0).round()/100.0}))
    }
    fn cash_report(&self, db: &Connection, session_id: &str, user: &Value) -> Result<Value> {
        allow(user,"cashier")?;
        let session=required_row(db,"SELECT c.*,u.name opened_by_name FROM cash_sessions c LEFT JOIN users u ON u.id=c.opened_by WHERE c.id=?",&[json!(session_id.parse::<i64>().unwrap_or(0))],"Cash session not found")?;
        let args=[v(&session,"branch_id").clone(),v(&session,"opened_at").clone(),v(&session,"closed_at").clone()];
        let payments=query(db,"SELECT method,direction,ROUND(SUM(amount),2) amount,COUNT(*) count FROM payments WHERE branch_id=? AND date>=? AND (? IS NULL OR date<=?) GROUP BY method,direction ORDER BY method,direction",&[args[0].clone(),args[1].clone(),args[2].clone(),args[2].clone()])?;
        let expenses=query(db,"SELECT category,method,ROUND(SUM(amount),2) amount FROM expenses WHERE branch_id=? AND date>=? AND (? IS NULL OR date<=?) GROUP BY category,method ORDER BY category",&[args[0].clone(),args[1].clone(),args[2].clone(),args[2].clone()])?;
        let drawings=one(db,"SELECT COALESCE(SUM(amount),0) amount FROM drawings WHERE branch_id=? AND date>=? AND (? IS NULL OR date<=?)",&[args[0].clone(),args[1].clone(),args[2].clone(),args[2].clone()])?.map(|r|n(&r,"amount")).unwrap_or(0.0);
        let refunds=query(db,"SELECT r.id,r.date,s.invoice_no,r.amount,r.refund,r.refund_method,r.reason FROM sale_returns r JOIN sales s ON s.id=r.sale_id WHERE s.branch_id=? AND r.date>=? AND (? IS NULL OR r.date<=?) ORDER BY r.id",&[args[0].clone(),args[1].clone(),args[2].clone(),args[2].clone()])?;
        let cash_in: f64=payments.iter().filter(|p|s(p,"method")=="cash"&&s(p,"direction")=="in").map(|p|n(p,"amount")).sum();
        let cash_out: f64=payments.iter().filter(|p|s(p,"method")=="cash"&&s(p,"direction")=="out").map(|p|n(p,"amount")).sum();
        let cash_expenses: f64=expenses.iter().filter(|e|s(e,"method")=="cash").map(|e|n(e,"amount")).sum();
        let expected=money(n(&session,"opening")+cash_in-cash_out-cash_expenses-drawings,"Expected cash")?;
        let variance=if v(&session,"actual_closing").is_null(){Value::Null}else{json!(money((n(&session,"actual_closing")-expected).abs(),"Variance")? * if n(&session,"actual_closing")>=expected {1.0}else{-1.0})};
        Ok(json!({"session":session,"payments":payments,"expenses":expenses,"drawings":drawings,"refunds":refunds,"cash_in":cash_in,"cash_out":cash_out,"cash_expenses":cash_expenses,"expected":expected,"variance":variance}))
    }
    fn create_rate(&self, db: &Connection, body: &Value, user: &Value) -> Result<Value> {
        allow(user, "manager")?;
        product(db, id(body, "product_id"))?;
        let x = execute(
            db,
            "INSERT INTO market_rates(product_id,buy_rate,sell_rate,user_id) VALUES(?,?,?,?)",
            &[
                json!(id(body, "product_id")),
                json!(money(n(body, "buy_rate"), "Buy rate")?),
                json!(money(n(body, "sell_rate"), "Sell rate")?),
                v(user, "id").clone(),
            ],
        )?;
        audit(db, user, "create", "market_rate", json!(x), json!({}))?;
        Ok(json!({"id":x}))
    }
    fn search(&self, db: &Connection, body: &Value, user: &Value) -> Result<Value> {
        let term = format!("%{}%", s(body, "q").chars().take(100).collect::<String>());
        let a = vec![json!(term); 3];
        let phones=query(db,"SELECT h.*,p.name product_name FROM phones h JOIN products p ON p.id=h.product_id WHERE h.imei1 LIKE ? OR h.imei2 LIKE ? OR p.name LIKE ? LIMIT 30",&a)?.into_iter().map(|x|if role_level(&s(user,"role"))>=4{x}else{strip(x,&["purchase_cost","prep_cost","supplier_id"])}).collect::<Vec<_>>();
        let sales = query(
            db,
            "SELECT s.*,c.name customer FROM sales s LEFT JOIN contacts c ON c.id=s.customer_id WHERE s.invoice_no LIKE ? OR c.name LIKE ? OR c.phone LIKE ? LIMIT 30",
            &a,
        )?;
        let products=query(db,"SELECT * FROM products WHERE name LIKE ? OR model LIKE ? OR color LIKE ? OR storage LIKE ? OR barcode LIKE ? OR sku LIKE ? OR compatible_models LIKE ? LIMIT 30",&vec![json!(term);7])?.into_iter().map(|x|if role_level(&s(user,"role"))>=4{x}else{strip(x,&["cost","min_price"])}).collect::<Vec<_>>();
        let contacts = query(
            db,
            "SELECT id,kind,name,phone,address FROM contacts WHERE name LIKE ? OR phone LIKE ? LIMIT 30",
            &vec![json!(term); 2],
        )?;
        Ok(json!({"phones":phones,"sales":sales,"products":products,"contacts":contacts}))
    }
    fn phone_history(&self, db: &Connection, body: &Value, user: &Value) -> Result<Value> {
        let imei = required(body, "imei", "IMEI")?;
        let h = required_row(
            db,
            "SELECT h.*,p.name product_name,s.name supplier_name FROM phones h JOIN products p ON p.id=h.product_id LEFT JOIN contacts s ON s.id=h.supplier_id WHERE h.imei1=? OR h.imei2=?",
            &[json!(imei), json!(imei)],
            "IMEI not found",
        )?;
        let sale = if id(&h, "sale_id") > 0 {
            one(
                db,
                "SELECT s.*,c.name customer,c.phone customer_phone FROM sales s LEFT JOIN contacts c ON c.id=s.customer_id WHERE s.id=?",
                &[v(&h, "sale_id").clone()],
            )?
        } else {
            None
        };
        let warranty = query(
            db,
            "SELECT * FROM warranty_claims WHERE phone_id=? OR sale_id=? ORDER BY id DESC",
            &[
                v(&h, "id").clone(),
                if id(&h, "sale_id") > 0 {
                    v(&h, "sale_id").clone()
                } else {
                    json!(-1)
                },
            ],
        )?;
        let repairs = query(
            db,
            "SELECT * FROM repairs WHERE imei=? ORDER BY id DESC",
            &[json!(imei)],
        )?;
        let movements = query(
            db,
            "SELECT * FROM stock_movements WHERE phone_id=? ORDER BY id",
            &[v(&h, "id").clone()],
        )?;
        Ok(
            json!({"phone":if role_level(&s(user,"role"))>=4{h}else{strip(h,&["purchase_cost","prep_cost","supplier_id","supplier_name"])},"sale":sale,"warranty":warranty,"repairs":repairs,"movements":movements}),
        )
    }
    fn reports(&self, db: &Connection, body: &Value, user: &Value) -> Result<Value> {
        allow(user, "manager")?;
        let today = Utc::now().date_naive();
        let from = str_or(body, "from", &(today - Duration::days(30)).to_string());
        let to = str_or(body, "to", &today.to_string());
        let from_date = NaiveDate::parse_from_str(&from, "%Y-%m-%d")
            .map_err(|_| err(400, "Invalid from date"))?;
        let to_date =
            NaiveDate::parse_from_str(&to, "%Y-%m-%d").map_err(|_| err(400, "Invalid to date"))?;
        if from_date > to_date {
            return Err(err(400, "From date must be before to date"));
        }
        let dates = [json!(from), json!(to)];
        Ok(json!({
            "from": from,
            "to": to,
            "sales": query(db, "SELECT date(date) day,COUNT(*) count,SUM(total) revenue,SUM(discount) discounts FROM sales WHERE date(date) BETWEEN ? AND ? AND status='completed' GROUP BY date(date) ORDER BY day", &dates)?,
            "categories": query(db, "SELECT p.category,SUM(l.quantity-COALESCE((SELECT SUM(r.quantity) FROM sale_returns r WHERE r.sale_line_id=l.id),0)) units,ROUND(SUM((l.quantity-COALESCE((SELECT SUM(r.quantity) FROM sale_returns r WHERE r.sale_line_id=l.id),0))*l.unit_price),2) revenue,ROUND(SUM((l.quantity-COALESCE((SELECT SUM(r.quantity) FROM sale_returns r WHERE r.sale_line_id=l.id),0))*(l.unit_price-l.unit_cost)),2) gross_profit FROM sale_lines l JOIN products p ON p.id=l.product_id JOIN sales s ON s.id=l.sale_id WHERE date(s.date) BETWEEN ? AND ? AND s.status='completed' GROUP BY p.category ORDER BY revenue DESC", &dates)?,
            "staff": query(db, "SELECT u.name,COALESCE((SELECT COUNT(*) FROM sales s WHERE s.created_by=u.id AND date(s.date) BETWEEN ? AND ?),0) sales,COALESCE((SELECT SUM(s.total) FROM sales s WHERE s.created_by=u.id AND date(s.date) BETWEEN ? AND ?),0) revenue,COALESCE((SELECT SUM(s.discount) FROM sales s WHERE s.created_by=u.id AND date(s.date) BETWEEN ? AND ?),0) discounts,COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.created_by=u.id AND p.direction='in' AND date(p.date) BETWEEN ? AND ?),0) collections FROM users u ORDER BY revenue DESC", &vec![json!(from),json!(to),json!(from),json!(to),json!(from),json!(to),json!(from),json!(to)])?,
            "stock": one(db, "SELECT COALESCE(SUM(CASE WHEN category!='phone' THEN quantity*cost ELSE 0 END),0) accessory_cost,COALESCE(SUM(CASE WHEN category!='phone' THEN quantity*price ELSE 0 END),0) accessory_value FROM products WHERE active=1", &[])?,
            "phoneStock": one(db, "SELECT COALESCE(SUM(h.purchase_cost+h.prep_cost),0) cost,COUNT(*) count FROM phones h WHERE status='available'", &[])?,
            "expenses": one(db, "SELECT COALESCE(SUM(amount),0) total FROM expenses WHERE date(date) BETWEEN ? AND ?", &dates)?,
            "repairs": one(db, "SELECT COALESCE(SUM(labor_charge-other_cost),0) profit FROM repairs WHERE date(date) BETWEEN ? AND ?", &dates)?,
            "fast": query(db, "SELECT p.id,p.name,SUM(l.quantity-COALESCE((SELECT SUM(r.quantity) FROM sale_returns r WHERE r.sale_line_id=l.id),0)) units_sold,ROUND(SUM((l.quantity-COALESCE((SELECT SUM(r.quantity) FROM sale_returns r WHERE r.sale_line_id=l.id),0))*l.unit_price),2) revenue FROM sale_lines l JOIN products p ON p.id=l.product_id JOIN sales s ON s.id=l.sale_id WHERE date(s.date) BETWEEN ? AND ? AND s.status='completed' GROUP BY p.id HAVING units_sold>0 ORDER BY units_sold DESC,revenue DESC LIMIT 20", &dates)?,
            "slow": query(db, "SELECT p.id,p.name,p.quantity,MAX(s.date) last_sale FROM products p LEFT JOIN sale_lines l ON l.product_id=p.id LEFT JOIN sales s ON s.id=l.sale_id WHERE p.active=1 GROUP BY p.id ORDER BY COALESCE(last_sale,'') ASC LIMIT 20", &[])?,
            "phoneProfit": query(db, "SELECT s.invoice_no,s.date,h.imei1,p.name product_name,l.unit_price,h.purchase_cost,h.prep_cost,ROUND(l.unit_price-s.discount*(l.unit_price/NULLIF(s.subtotal,0))-h.purchase_cost-h.prep_cost,2) profit FROM sale_lines l JOIN phones h ON h.id=l.phone_id JOIN products p ON p.id=l.product_id JOIN sales s ON s.id=l.sale_id WHERE date(s.date) BETWEEN ? AND ? AND NOT EXISTS(SELECT 1 FROM sale_returns r WHERE r.sale_line_id=l.id) ORDER BY s.id DESC LIMIT 100", &dates)?,
            "returns": query(db, "SELECT r.date,s.invoice_no,l.description,r.quantity,r.amount,r.refund,r.refund_method,r.restock FROM sale_returns r JOIN sales s ON s.id=r.sale_id JOIN sale_lines l ON l.id=r.sale_line_id WHERE date(r.date) BETWEEN ? AND ? ORDER BY r.id DESC", &dates)?
        }))
    }
    fn backup_preferences(&self, db: &Connection, user: &Value) -> Result<Value> {
        allow(user,"owner")?;
        Ok(one(db,"SELECT * FROM backup_preferences WHERE id=1",&[])?.unwrap_or(Value::Null))
    }
    fn set_backup_preferences(&self, db: &Connection, body: &Value, user: &Value) -> Result<Value> {
        allow(user,"owner")?;
        let destination=s(body,"destination");
        let enabled=v(body,"enabled").as_bool().unwrap_or(false);
        let hours=id(body,"interval_hours");
        if !(1..=720).contains(&hours){return Err(err(400,"Backup interval must be 1 to 720 hours"));}
        if enabled && destination.is_empty(){return Err(err(400,"Choose a backup destination"));}
        if !destination.is_empty(){
            let target=fs::canonicalize(&destination).map_err(|_|err(400,"Backup destination is unavailable"))?;
            if !target.is_dir(){return Err(err(400,"Backup destination must be a folder"));}
            let local=fs::canonicalize(&self.data_dir)?;
            if target==local || target.starts_with(&local){return Err(err(400,"Choose a folder outside the app data directory"));}
        }
        execute(db,"UPDATE backup_preferences SET destination=?,enabled=?,interval_hours=?,last_error='' WHERE id=1",&[json!(destination),json!(enabled),json!(hours)])?;
        audit(db,user,"update","backup_preferences",json!(1),json!({"enabled":enabled,"interval_hours":hours,"destination":destination}))?;
        self.backup_preferences(db,user)
    }
    fn write_external_backup(&self, db: &Connection) -> Result<Value> {
        let prefs=one(db,"SELECT destination FROM backup_preferences WHERE id=1",&[])?.ok_or_else(||err(500,"Backup preferences missing"))?;
        let destination=s(&prefs,"destination");
        if destination.is_empty(){return Err(err(400,"Choose a backup destination"));}
        let dir=fs::canonicalize(&destination).map_err(|_|err(400,"Backup destination is unavailable"))?;
        if !dir.is_dir(){return Err(err(400,"Backup destination must be a folder"));}
        let name=format!("backup-{}-{}.db",Utc::now().format("%Y-%m-%dT%H-%M-%S-%f"),std::process::id());
        let pending=dir.join(format!(".{name}.pending"));
        let final_path=dir.join(&name);
        let outcome=(||->Result<()> {db.backup("main",&pending,None)?;verify_database(&pending)?;fs::rename(&pending,&final_path)?;Ok(())})();
        if outcome.is_err(){let _=fs::remove_file(&pending);}
        outcome?;
        execute(db,"UPDATE backup_preferences SET last_success=?,last_error='' WHERE id=1",&[json!(Utc::now().to_rfc3339())])?;
        Ok(json!({"name":name,"path":final_path,"verified":true}))
    }
    fn external_backup(&self, db: &Connection, user: &Value) -> Result<Value> {
        allow(user,"owner")?;
        let result=self.write_external_backup(db)?;
        audit(db,user,"create","external_backup",Value::Null,result.clone())?;
        Ok(result)
    }
    fn verify_backup(&self, db: &Connection, body: &Value, user: &Value) -> Result<Value> {
        allow(user,"owner")?;
        let name=required(body,"name","Backup name")?;
        if !valid_backup_name(&name){return Err(err(400,"Invalid backup name"));}
        let path=self.backup_path(db,&name,&s(body,"location"))?;
        if !path.is_file(){return Err(err(404,"Backup not found"));}
        verify_database(&path)?;
        Ok(json!({"ok":true,"name":name,"path":path}))
    }
    fn backup_path(&self, db: &Connection, name: &str, location: &str) -> Result<PathBuf> {
        if location=="external" {
            let prefs=one(db,"SELECT destination FROM backup_preferences WHERE id=1",&[])?.ok_or_else(||err(400,"Backup destination missing"))?;
            let dir=fs::canonicalize(s(&prefs,"destination")).map_err(|_|err(400,"Backup destination is unavailable"))?;
            let path=dir.join(name);
            if path.exists() && fs::symlink_metadata(&path)?.file_type().is_symlink(){return Err(err(400,"Backup symlinks are not allowed"));}
            Ok(path)
        } else if location.is_empty() || location=="local" {Ok(self.data_dir.join(name))}
        else {Err(err(400,"Invalid backup location"))}
    }
    fn list_external_backups(&self, db: &Connection, user: &Value) -> Result<Value> {
        allow(user,"owner")?;
        let prefs=one(db,"SELECT destination FROM backup_preferences WHERE id=1",&[])?.unwrap_or(Value::Null);
        if s(&prefs,"destination").is_empty(){return Ok(json!([]));}
        let dir=fs::canonicalize(s(&prefs,"destination")).map_err(|_|err(400,"Backup destination is unavailable"))?;
        let mut names=Vec::new();
        for file in fs::read_dir(dir)? {let name=file?.file_name().to_string_lossy().to_string();if valid_backup_name(&name){names.push(name);}}
        names.sort();names.reverse();Ok(json!(names))
    }
    fn list_backups(&self, user: &Value) -> Result<Value> {
        allow(user, "owner")?;
        let mut names = Vec::new();
        for file in fs::read_dir(&self.data_dir)? {
            let name = file?.file_name().to_string_lossy().to_string();
            if (name.starts_with("backup-")
                || name.starts_with("auto-")
                || name.starts_with("before-restore-"))
                && name.ends_with(".db")
            {
                names.push(name)
            }
        }
        names.sort();
        names.reverse();
        Ok(json!(names))
    }
    fn create_backup(&self, db: &Connection, user: &Value) -> Result<Value> {
        allow(user, "owner")?;
        let name = format!("backup-{}.db", Utc::now().format("%Y-%m-%dT%H-%M-%S-%f"));
        let path = backup(db, &self.data_dir, &name)?;
        audit(
            db,
            user,
            "create",
            "backup",
            Value::Null,
            json!({"name":name}),
        )?;
        Ok(json!({"name":name,"path":path}))
    }
    fn restore(&self, db: &mut Connection, body: &Value, user: &Value) -> Result<Value> {
        allow(user, "owner")?;
        let name = required(body, "name", "Backup name")?;
        if !valid_backup_name(&name) {
            return Err(err(400, "Invalid backup name"));
        }
        let source = self.backup_path(db,&name,&s(body,"location"))?;
        if !source.is_file() {
            return Err(err(404, "Backup not found"));
        }
        verify_database(&source)?;
        let safety = format!("before-restore-{}.db", Utc::now().timestamp_millis());
        backup(db, &self.data_dir, &safety)?;
        db.restore("main", &source, None::<fn(rusqlite::backup::Progress)>)?;
        db.execute_batch("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;")?;
        db.execute_batch(include_str!("../schema.sql"))?;
        audit(
            db,
            user,
            "restore",
            "backup",
            Value::Null,
            json!({"name":name,"safety":safety}),
        )?;
        Ok(json!({"ok":true,"safety":safety}))
    }
}
