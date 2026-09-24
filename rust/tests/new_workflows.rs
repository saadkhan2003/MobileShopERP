use mobile_shop_backend::Store;
use serde_json::{json, Value};

fn call(store:&Store, token:&str, method:&str, path:&str, body:Value)->Value {
    store.handle(method,path,&body,token).unwrap_or_else(|e|panic!("{method} {path}: {e}"))
}
fn setup()->(Store,String,std::path::PathBuf){
    let dir=std::env::temp_dir().join(format!("shop-ops-{}-{}",std::process::id(),rand::random::<u64>()));
    let store=Store::open(dir.clone()).unwrap();
    call(&store,"","POST","/api/setup",json!({"name":"Owner","username":"owner","password":"StrongPass123"}));
    let token=call(&store,"","POST","/api/login",json!({"username":"owner","password":"StrongPass123"}))["token"].as_str().unwrap().to_string();
    (store,token,dir)
}

#[test]
fn partial_return_reconciles_refund_stock_ledger_and_cash(){
    let (store,token,_dir)=setup();
    let customer=call(&store,&token,"POST","/api/contacts",json!({"kind":"customer","name":"Ali"}))["id"].as_i64().unwrap();
    let product=call(&store,&token,"POST","/api/products",json!({"name":"Charger","category":"charger","cost":500,"price":1000}))["id"].as_i64().unwrap();
    call(&store,&token,"POST","/api/cash/open",json!({"opening":100}));
    call(&store,&token,"POST","/api/purchases",json!({"lines":[{"product_id":product,"quantity":3,"unit_cost":500}]}));
    let sale=call(&store,&token,"POST","/api/sales",json!({"customer_id":customer,"lines":[{"product_id":product,"quantity":2,"unit_price":1000}],"payments":[{"amount":2000,"method":"cash"}]}));
    let id=sale["id"].as_i64().unwrap();
    let details=call(&store,&token,"GET",&format!("/api/sales/{id}"),json!({}));
    let line=details["lines"][0]["id"].as_i64().unwrap();
    let result=call(&store,&token,"POST",&format!("/api/sales/{id}/returns"),json!({"sale_line_id":line,"quantity":1,"refund_method":"cash","restock":true,"reason":"Unopened"}));
    assert_eq!(result["refund"],1000.0);
    assert_eq!(result["new_total"],1000.0);
    assert_eq!(call(&store,&token,"GET","/api/products",json!({}))[0]["quantity"],2);
    assert_eq!(call(&store,&token,"GET","/api/ledger",json!({"kind":"customer","contact_id":customer}))["balance"],0.0);
    let cash=call(&store,&token,"GET","/api/cash/1/report",json!({}));
    assert_eq!(cash["expected"],1100.0);
    assert_eq!(cash["refunds"][0]["refund"],1000.0);
    assert!(store.handle("POST",&format!("/api/sales/{id}/returns"),&json!({"sale_line_id":line,"quantity":2}),&token).is_err());
}

#[test]
fn external_backup_verifies_and_restores(){
    let (store,token,dir)=setup();
    let external=std::env::temp_dir().join(format!("shop-backup-{}-{}",std::process::id(),rand::random::<u64>()));
    std::fs::create_dir_all(&external).unwrap();
    call(&store,&token,"PUT","/api/backup/preferences",json!({"destination":external,"enabled":true,"interval_hours":1}));
    let backup=call(&store,&token,"POST","/api/backup/external",json!({}));
    let name=backup["name"].as_str().unwrap();
    assert_eq!(call(&store,&token,"POST","/api/backup/verify",json!({"name":name,"location":"external"}))["ok"],true);
    assert_eq!(call(&store,&token,"GET","/api/backup/external",json!({}))[0],name);
    call(&store,&token,"POST","/api/contacts",json!({"kind":"customer","name":"After backup"}));
    call(&store,&token,"POST","/api/restore",json!({"name":name,"location":"external"}));
    assert!(call(&store,&token,"GET","/api/contacts?kind=customer",json!({})).as_array().unwrap().is_empty());
    assert!(dir.read_dir().unwrap().any(|entry|entry.unwrap().file_name().to_string_lossy().starts_with("before-restore-")));
    std::fs::remove_dir_all(external).unwrap();
}

#[test]
fn phone_return_and_credit_return_keep_inventory_and_schedule_consistent(){
    let (store,token,_dir)=setup();
    let customer=call(&store,&token,"POST","/api/contacts",json!({"kind":"customer","name":"Sara"}))["id"].as_i64().unwrap();
    let model=call(&store,&token,"POST","/api/products",json!({"name":"Phone","category":"phone","cost":10000,"price":15000}))["id"].as_i64().unwrap();
    call(&store,&token,"POST","/api/purchases",json!({"lines":[{"product_id":model,"unit_cost":10000,"imeis":[{"imei1":"345678901234567"}]}]}));
    let phone=call(&store,&token,"GET","/api/phones",json!({}))[0]["id"].as_i64().unwrap();
    let sale=call(&store,&token,"POST","/api/sales",json!({"customer_id":customer,"lines":[{"product_id":model,"phone_id":phone,"unit_price":15000}],"payments":[{"amount":5000,"method":"cash"}],"installments":[{"due_date":"2027-01-01","amount":10000}]}));
    let id=sale["id"].as_i64().unwrap();
    let details=call(&store,&token,"GET",&format!("/api/sales/{id}"),json!({}));
    let line=details["lines"][0]["id"].as_i64().unwrap();
    let returned=call(&store,&token,"POST",&format!("/api/sales/{id}/returns"),json!({"sale_line_id":line,"quantity":1,"restock":false,"refund_method":"bank_transfer"}));
    assert_eq!(returned["refund"],5000.0);
    assert_eq!(returned["new_total"],0.0);
    assert_eq!(call(&store,&token,"GET","/api/phones",json!({}))[0]["status"],"returned");
    assert!(call(&store,&token,"GET","/api/installments",json!({})).as_array().unwrap().is_empty());
    assert_eq!(call(&store,&token,"GET","/api/ledger",json!({"kind":"customer","contact_id":customer}))["balance"],0.0);
    assert_eq!(call(&store,&token,"GET",&format!("/api/sales/{id}"),json!({}))["payments"][1]["direction"],"out");
}

#[test]
fn cash_report_for_new_open_session_shows_opening_balance(){
    let (store,token,_dir)=setup();
    let session=call(&store,&token,"POST","/api/cash/open",json!({"opening":100}));
    let report=call(&store,&token,"GET",&format!("/api/cash/{}/report",session["id"]),json!({}));
    assert_eq!(report["expected"],100.0);
    assert_eq!(report["variance"],Value::Null);
}
