use mobile_shop_backend::Store;
use rusqlite::Connection;
use serde_json::{Value, json};
use std::path::PathBuf;

fn make_store() -> (Store, String, PathBuf) {
    let dir = std::env::temp_dir().join(format!(
        "shop-full-test-{}-{}",
        std::process::id(),
        rand::random::<u64>()
    ));
    let store = Store::open(dir.clone()).unwrap();
    call(
        &store,
        "",
        "POST",
        "/api/setup",
        json!({"name":"Owner","username":"owner","password":"StrongPass123"}),
    );
    let session = call(
        &store,
        "",
        "POST",
        "/api/login",
        json!({"username":"owner","password":"StrongPass123"}),
    );
    (store, session["token"].as_str().unwrap().to_string(), dir)
}

#[test]
fn shop_settings_persist_and_only_owner_can_change_branding() {
    let (store, owner_token, dir) = make_store();
    let original = call(&store, &owner_token, "GET", "/api/settings", json!({}));
    assert_eq!(original["shop_name"], "Mobile Shop");
    assert_eq!(original["tagline"], "Desktop ERP");
    let logo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl5mQAAAABJRU5ErkJggg==";
    let changed = call(&store, &owner_token, "PUT", "/api/settings", json!({
        "shop_name":"Saad Mobile Center", "tagline":"Phones and accessories",
        "logo_data":logo, "phone":"0300-1234567", "address":"Main Market",
        "receipt_footer":"Visit again"
    }));
    assert_eq!(changed["shop_name"], "Saad Mobile Center");
    assert_eq!(changed["logo_data"], logo);
    assert_eq!(call(&store, "", "GET", "/api/status", json!({}))["branding"]["shop_name"], "Saad Mobile Center");
    assert_error(&store, &owner_token, "PUT", "/api/settings", json!({
        "shop_name":"", "tagline":"", "logo_data":""
    }), 400);
    assert_error(&store, &owner_token, "PUT", "/api/settings", json!({
        "shop_name":"Wrong logo", "tagline":"", "logo_data":"data:image/svg+xml;base64,AAAA"
    }), 400);
    let staff = call(&store, &owner_token, "POST", "/api/users", json!({
        "name":"Cashier", "username":"cashier-settings", "password":"StrongPass123", "role":"cashier"
    }));
    assert!(staff["id"].as_i64().is_some());
    let login = call(&store, "", "POST", "/api/login", json!({
        "username":"cashier-settings", "password":"StrongPass123"
    }));
    let cashier_token = login["token"].as_str().unwrap();
    assert_eq!(call(&store, cashier_token, "GET", "/api/settings", json!({}))["shop_name"], "Saad Mobile Center");
    assert_error(&store, cashier_token, "PUT", "/api/settings", changed, 403);
    drop(store);
    let reopened = Store::open(dir).unwrap();
    assert_eq!(call(&reopened, &owner_token, "GET", "/api/settings", json!({}))["shop_name"], "Saad Mobile Center");
}
fn call(store: &Store, token: &str, method: &str, path: &str, body: Value) -> Value {
    store
        .handle(method, path, &body, token)
        .unwrap_or_else(|e| panic!("{method} {path}: {e}"))
}
fn assert_error(store: &Store, token: &str, method: &str, path: &str, body: Value, status: u16) {
    let e = store.handle(method, path, &body, token).unwrap_err();
    assert_eq!(e.status, status, "{method} {path}: {e}");
}
fn seeded() -> (Store, String, PathBuf) {
    let (store, token, dir) = make_store();
    let db = Connection::open(dir.join("shop.db")).unwrap();
    db.execute_batch("PRAGMA foreign_keys=ON;").unwrap();
    let fixture = include_str!("../../scripts/demo-seed.sql");
    db.execute_batch(fixture).unwrap();
    db.execute_batch(fixture).unwrap();
    assert_eq!(
        db.query_row("PRAGMA integrity_check", [], |r| r.get::<_, String>(0))
            .unwrap(),
        "ok"
    );
    assert_eq!(
        db.query_row("SELECT count(*) FROM pragma_foreign_key_check", [], |r| r
            .get::<_, i64>(
            0
        ))
        .unwrap(),
        0
    );
    (store, token, dir)
}
#[test]
fn demo_sql_is_repeatable_and_every_read_screen_opens() {
    let (store, t, _) = seeded();
    let paths = [
        "/api/status",
        "/api/me",
        "/api/dashboard",
        "/api/branches",
        "/api/users",
        "/api/contacts",
        "/api/contacts?kind=customer",
        "/api/contacts?kind=supplier",
        "/api/products",
        "/api/phones",
        "/api/purchases",
        "/api/used-purchases",
        "/api/sales",
        "/api/payments",
        "/api/installments",
        "/api/repairs",
        "/api/warranties",
        "/api/expenses",
        "/api/drawings",
        "/api/cash",
        "/api/market-rates",
        "/api/price-history",
        "/api/search?q=A55",
        "/api/phone-history?imei=900000000000001",
        "/api/reports",
        "/api/audit",
        "/api/backup",
        "/api/settings",
    ];
    for path in paths {
        let r = call(&store, &t, "GET", path, json!({}));
        assert!(!r.is_null(), "{path}");
    }
    let purchases = call(&store, &t, "GET", "/api/purchases", json!({}));
    let purchase_id = purchases[0]["id"].as_i64().unwrap();
    let lines = call(
        &store,
        &t,
        "GET",
        &format!("/api/purchase-lines?purchase_id={purchase_id}"),
        json!({}),
    );
    assert_eq!(lines.as_array().unwrap().len(), 6);
    let sales = call(&store, &t, "GET", "/api/sales", json!({}));
    let sale_id = sales[0]["id"].as_i64().unwrap();
    let invoice = call(
        &store,
        &t,
        "GET",
        &format!("/api/sales/{sale_id}"),
        json!({}),
    );
    assert_eq!(invoice["lines"].as_array().unwrap().len(), 3);
    assert_eq!(invoice["total"].as_f64(), Some(87200.0));
    let customers = call(&store, &t, "GET", "/api/contacts?kind=customer", json!({}));
    let customer_id = customers
        .as_array()
        .unwrap()
        .iter()
        .find(|c| c["name"] == "DEMO Ayesha Malik")
        .unwrap()["id"]
        .as_i64()
        .unwrap();
    let ledger = call(
        &store,
        &t,
        "GET",
        &format!("/api/ledger?kind=customer&contact_id={customer_id}"),
        json!({}),
    );
    assert_eq!(ledger["balance"].as_f64(), Some(47200.0));
    let reports = call(&store, &t, "GET", "/api/reports", json!({}));
    assert_eq!(reports["phoneStock"]["count"].as_i64(), Some(2));
    assert_eq!(reports["stock"]["accessory_cost"].as_f64(), Some(33550.0));
    assert!(
        call(&store, &t, "GET", "/api/search?q=0300-2000001", json!({}))["contacts"]
            .as_array()
            .unwrap()
            .iter()
            .any(|contact| contact["name"] == "DEMO Ayesha Malik")
    );
    assert!(
        call(&store, &t, "GET", "/api/search?q=Navy", json!({}))["products"]
            .as_array()
            .unwrap()
            .iter()
            .any(|product| product["model"] == "Galaxy A55")
    );
    let dated = call(
        &store,
        &t,
        "GET",
        "/api/reports?from=2020-01-01&to=2030-12-31",
        json!({}),
    );
    assert!(!dated["fast"].as_array().unwrap().is_empty());
    assert!(dated["staff"][0]["collections"].as_f64().is_some());
    assert_error(
        &store,
        &t,
        "GET",
        "/api/reports?from=2030-01-01&to=2020-01-01",
        json!({}),
        400,
    );
    assert_eq!(
        call(&store, &t, "GET", "/api/phones", json!({}))
            .as_array()
            .unwrap()
            .len(),
        3
    );
    assert_eq!(
        call(&store, &t, "GET", "/api/backup", json!({}))
            .as_array()
            .unwrap()
            .len(),
        1
    );
}
#[test]
fn all_remaining_write_actions_change_the_expected_records() {
    let (store, t, _) = seeded();
    let branch = call(
        &store,
        &t,
        "POST",
        "/api/branches",
        json!({"name":"Demo second branch","address":"Market","phone":"0300"}),
    );
    assert!(branch["id"].as_i64().unwrap() > 1);
    let staff = call(
        &store,
        &t,
        "POST",
        "/api/users",
        json!({"name":"Demo Cashier","username":"demo-cashier","password":"CashierPass123","role":"cashier"}),
    );
    assert!(staff["id"].as_i64().is_some());
    let charger = call(&store, &t, "GET", "/api/products", json!({}))
        .as_array()
        .unwrap()
        .iter()
        .find(|p| p["sku"] == "DEMO-CH-USBC")
        .unwrap()["id"]
        .as_i64()
        .unwrap();
    call(
        &store,
        &t,
        "PATCH",
        &format!("/api/products/{charger}"),
        json!({"price":1900,"reorder_level":6}),
    );
    assert_eq!(
        call(&store, &t, "GET", "/api/price-history", json!({}))
            .as_array()
            .unwrap()
            .len(),
        2
    );
    let rate = call(
        &store,
        &t,
        "POST",
        "/api/market-rates",
        json!({"product_id":charger,"buy_rate":1000,"sell_rate":1850}),
    );
    assert!(rate["id"].as_i64().is_some());
    let purchase = call(&store, &t, "GET", "/api/purchases", json!({}))[0].clone();
    call(
        &store,
        &t,
        "POST",
        "/api/payments",
        json!({"purchase_id":purchase["id"],"amount":1000,"method":"cash"}),
    );
    let lines = call(
        &store,
        &t,
        "GET",
        &format!("/api/purchase-lines?purchase_id={}", purchase["id"]),
        json!({}),
    );
    let glass = lines
        .as_array()
        .unwrap()
        .iter()
        .find(|l| l["product_name"] == "DEMO A55 Tempered Glass")
        .unwrap()["id"]
        .as_i64()
        .unwrap();
    call(
        &store,
        &t,
        "POST",
        "/api/purchase-returns",
        json!({"purchase_line_id":glass,"quantity":1,"reason":"Test chipped glass"}),
    );
    let products = call(&store, &t, "GET", "/api/products", json!({}));
    let glass_qty = products
        .as_array()
        .unwrap()
        .iter()
        .find(|p| p["sku"] == "DEMO-GL-A55")
        .unwrap()["quantity"]
        .as_i64()
        .unwrap();
    assert_eq!(glass_qty, 18);
    let seller = call(&store, &t, "GET", "/api/used-purchases", json!({}))[0].clone();
    call(
        &store,
        &t,
        "POST",
        &format!("/api/used-purchases/{}/pay", seller["id"]),
        json!({"amount":15000,"method":"bank_transfer"}),
    );
    let used = call(&store, &t, "GET", "/api/used-purchases", json!({}));
    assert_eq!(used[0]["paid"].as_f64(), Some(45000.0));
    let claim = call(&store, &t, "GET", "/api/warranties", json!({}))[0].clone();
    call(
        &store,
        &t,
        "PATCH",
        &format!("/api/warranties/{}", claim["id"]),
        json!({"status":"resolved","action":"Tested","result":"Pass"}),
    );
    let claims = call(&store, &t, "GET", "/api/warranties", json!({}));
    assert_eq!(claims[0]["status"], "resolved");
    let repair = call(&store, &t, "GET", "/api/repairs", json!({}))[0].clone();
    call(
        &store,
        &t,
        "PATCH",
        &format!("/api/repairs/{}", repair["id"]),
        json!({"status":"Delivered"}),
    );
    assert_eq!(
        call(&store, &t, "GET", "/api/repairs", json!({}))[0]["status"],
        "Delivered"
    );
    call(
        &store,
        &t,
        "POST",
        "/api/expenses",
        json!({"category":"internet","amount":1500,"method":"bank_transfer"}),
    );
    call(
        &store,
        &t,
        "POST",
        "/api/drawings",
        json!({"amount":500,"notes":"Test drawing"}),
    );
    assert_eq!(
        call(&store, &t, "GET", "/api/expenses", json!({}))
            .as_array()
            .unwrap()
            .len(),
        2
    );
    assert_eq!(
        call(&store, &t, "GET", "/api/drawings", json!({}))
            .as_array()
            .unwrap()
            .len(),
        2
    );
    let backup = call(&store, &t, "POST", "/api/backup", json!({}));
    assert!(backup["name"].as_str().unwrap().starts_with("backup-"));
}
#[test]
fn permissions_and_invalid_operations_are_rejected() {
    let (store, t, _) = seeded();
    assert_error(&store, "", "GET", "/api/products", json!({}), 401);
    assert_error(
        &store,
        &t,
        "POST",
        "/api/setup",
        json!({"name":"other"}),
        403,
    );
    assert_error(
        &store,
        &t,
        "POST",
        "/api/purchases",
        json!({"lines":[]}),
        400,
    );
    let seller = call(
        &store,
        &t,
        "POST",
        "/api/users",
        json!({"name":"Seller","username":"seller2","password":"SellerPass123","role":"salesman"}),
    );
    assert!(seller["id"].as_i64().is_some());
    let login = call(
        &store,
        "",
        "POST",
        "/api/login",
        json!({"username":"seller2","password":"SellerPass123"}),
    );
    let token = login["token"].as_str().unwrap();
    for path in [
        "/api/reports",
        "/api/backup",
        "/api/users",
        "/api/audit",
        "/api/price-history",
    ] {
        assert_error(&store, token, "GET", path, json!({}), 403);
    }
    assert_error(
        &store,
        token,
        "POST",
        "/api/products",
        json!({"name":"Denied","category":"charger"}),
        403,
    );
    let products = call(&store, token, "GET", "/api/products", json!({}));
    assert!(products[0].get("cost").is_none());
    let phones = call(&store, token, "GET", "/api/phones", json!({}));
    assert!(phones[0].get("purchase_cost").is_none());
    let phone_id = phones[0]["id"].as_i64().unwrap();
    assert_error(
        &store,
        &t,
        "POST",
        "/api/warranties",
        json!({"sale_id":1,"phone_id":phone_id+999,"issue":"Invalid"}),
        400,
    );
    call(&store, token, "POST", "/api/logout", json!({}));
    assert_error(&store, token, "GET", "/api/me", json!({}), 401);
}
#[test]
fn split_payments_used_phone_intake_and_later_installment_schedule() {
    let (store, t, _) = seeded();
    let contacts = call(&store, &t, "GET", "/api/contacts?kind=customer", json!({}));
    let customer = contacts
        .as_array()
        .unwrap()
        .iter()
        .find(|x| x["name"] == "DEMO Ayesha Malik")
        .unwrap()["id"]
        .as_i64()
        .unwrap();
    let seller = contacts
        .as_array()
        .unwrap()
        .iter()
        .find(|x| x["name"] == "DEMO Hamza Ali")
        .unwrap()["id"]
        .as_i64()
        .unwrap();
    let products = call(&store, &t, "GET", "/api/products", json!({}));
    let charger = products
        .as_array()
        .unwrap()
        .iter()
        .find(|x| x["sku"] == "DEMO-CH-USBC")
        .unwrap()["id"]
        .as_i64()
        .unwrap();
    let used_model = products
        .as_array()
        .unwrap()
        .iter()
        .find(|x| x["sku"] == "DEMO-PH-IP13")
        .unwrap()["id"]
        .as_i64()
        .unwrap();
    let sale = call(
        &store,
        &t,
        "POST",
        "/api/sales",
        json!({"customer_id":customer,"lines":[{"product_id":charger,"quantity":1,"unit_price":1800}],"payments":[{"amount":500,"method":"cash"},{"amount":400,"method":"easypaisa"}]}),
    );
    let detail = call(
        &store,
        &t,
        "GET",
        &format!("/api/sales/{}", sale["id"]),
        json!({}),
    );
    assert_eq!(detail["payments"].as_array().unwrap().len(), 2);
    assert_eq!(detail["paid"].as_f64(), Some(900.0));
    call(
        &store,
        &t,
        "POST",
        &format!("/api/sales/{}/installments", sale["id"]),
        json!({"entries":[{"due_date":"2027-02-01","amount":400},{"due_date":"2027-03-01","amount":500}]}),
    );
    assert_error(
        &store,
        &t,
        "POST",
        &format!("/api/sales/{}/installments", sale["id"]),
        json!({"entries":[{"due_date":"2027-04-01","amount":900}]}),
        400,
    );
    let detail = call(
        &store,
        &t,
        "GET",
        &format!("/api/sales/{}", sale["id"]),
        json!({}),
    );
    assert_eq!(detail["installments"].as_array().unwrap().len(), 2);
    let used = call(
        &store,
        &t,
        "POST",
        "/api/used-purchases",
        json!({"customer_id":seller,"product_id":used_model,"imei1":"900000000000005","agreed_price":40000,"paid":10000,"condition_grade":"B","checklist":{"screen":"pass","battery":"84%"}}),
    );
    assert!(used["id"].as_i64().is_some());
    let phones = call(&store, &t, "GET", "/api/phones", json!({}));
    let phone = phones
        .as_array()
        .unwrap()
        .iter()
        .find(|h| h["imei1"] == "900000000000005")
        .unwrap();
    assert_eq!(phone["purchase_cost"].as_f64(), Some(40000.0));
    call(
        &store,
        &t,
        "POST",
        &format!("/api/used-purchases/{}/pay", used["id"]),
        json!({"amount":30000,"method":"bank_transfer"}),
    );
    assert_error(
        &store,
        &t,
        "POST",
        &format!("/api/used-purchases/{}/pay", used["id"]),
        json!({"amount":1,"method":"cash"}),
        400,
    );
}
