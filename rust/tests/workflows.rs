use mobile_shop_backend::Store;
use serde_json::{Value, json};
fn call(store: &Store, token: &str, method: &str, path: &str, body: Value) -> Value {
    store
        .handle(method, path, &body, token)
        .unwrap_or_else(|e| panic!("{method} {path}: {e}"))
}
fn setup() -> (Store, String) {
    let dir = std::env::temp_dir().join(format!(
        "mobile-shop-test-{}-{}",
        std::process::id(),
        rand::random::<u64>()
    ));
    let store = Store::open(dir).unwrap();
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
    (store, session["token"].as_str().unwrap().to_string())
}
#[test]
fn accessories_purchase_sale_payment_and_report() {
    let (store, t) = setup();
    let supplier = call(
        &store,
        &t,
        "POST",
        "/api/contacts",
        json!({"kind":"supplier","name":"Supplier"}),
    )["id"]
        .as_i64()
        .unwrap();
    let customer = call(
        &store,
        &t,
        "POST",
        "/api/contacts",
        json!({"kind":"customer","name":"Customer"}),
    )["id"]
        .as_i64()
        .unwrap();
    let charger=call(&store,&t,"POST","/api/products",json!({"name":"USB-C charger","category":"charger","sku":"CH-1","cost":900,"price":1500,"min_price":1200,"reorder_level":2}))["id"].as_i64().unwrap();
    let purchase = call(
        &store,
        &t,
        "POST",
        "/api/purchases",
        json!({"supplier_id":supplier,"paid":1800,"lines":[{"product_id":charger,"quantity":5,"unit_cost":900}]}),
    );
    assert_eq!(purchase["total"].as_f64(), Some(4500.0));
    let products = call(&store, &t, "GET", "/api/products", json!({}));
    assert_eq!(products[0]["quantity"], 5);
    let sale = call(
        &store,
        &t,
        "POST",
        "/api/sales",
        json!({"customer_id":customer,"lines":[{"product_id":charger,"quantity":2,"unit_price":1500}],"payments":[{"amount":1000,"method":"cash"}]}),
    );
    assert_eq!(sale["total"].as_f64(), Some(3000.0));
    let details = call(
        &store,
        &t,
        "GET",
        &format!("/api/sales/{}", sale["id"]),
        json!({}),
    );
    assert_eq!(details["paid"].as_f64(), Some(1000.0));
    call(
        &store,
        &t,
        "POST",
        "/api/payments",
        json!({"sale_id":sale["id"],"amount":2000,"method":"cash"}),
    );
    let products = call(&store, &t, "GET", "/api/products", json!({}));
    assert_eq!(products[0]["quantity"], 3);
    assert_eq!(
        call(&store, &t, "GET", "/api/reports", json!({}))["categories"][0]["units"],
        2
    );
    assert!(
        store
            .handle(
                "POST",
                "/api/sales",
                &json!({"lines":[{"product_id":charger,"quantity":10,"unit_price":1500}]}),
                &t
            )
            .is_err()
    );
}
#[test]
fn imei_is_unique_and_phone_cannot_sell_twice() {
    let (store, t) = setup();
    let model = call(
        &store,
        &t,
        "POST",
        "/api/products",
        json!({"name":"Test phone","category":"phone","price":20000,"cost":15000,"reorder_level":2}),
    )["id"]
        .as_i64()
        .unwrap();
    let purchase = call(
        &store,
        &t,
        "POST",
        "/api/purchases",
        json!({"lines":[{"product_id":model,"unit_cost":15000,"imeis":[{"imei1":"123456789012345"}]}]}),
    );
    assert_eq!(purchase["total"].as_f64(), Some(15000.0));
    assert!(
        call(&store, &t, "GET", "/api/dashboard", json!({}))["lowStock"]
            .as_array()
            .unwrap()
            .iter()
            .any(|row| row["id"].as_i64() == Some(model) && row["quantity"].as_i64() == Some(1))
    );
    assert!(store.handle("POST","/api/purchases",&json!({"lines":[{"product_id":model,"unit_cost":15000,"imeis":[{"imei1":"123456789012345"}]}]}),&t).is_err());
    let phones = call(&store, &t, "GET", "/api/phones", json!({}));
    let phone = phones[0]["id"].as_i64().unwrap();
    call(
        &store,
        &t,
        "POST",
        "/api/sales",
        json!({"lines":[{"product_id":model,"phone_id":phone,"unit_price":20000}],"payments":[{"amount":20000}]}),
    );
    assert!(store.handle("POST","/api/sales",&json!({"lines":[{"product_id":model,"phone_id":phone,"unit_price":20000}],"payments":[{"amount":20000}]}),&t).is_err());
}
#[test]
fn backup_and_restore_roundtrip() {
    let (store, t) = setup();
    let backup = call(&store, &t, "POST", "/api/backup", json!({}));
    call(
        &store,
        &t,
        "POST",
        "/api/contacts",
        json!({"kind":"customer","name":"After backup"}),
    );
    call(
        &store,
        &t,
        "POST",
        "/api/restore",
        json!({"name":backup["name"]}),
    );
    let rows = call(&store, &t, "GET", "/api/contacts", json!({}));
    assert_eq!(rows.as_array().unwrap().len(), 0);
}
#[test]
fn repairs_parts_cash_and_roles() {
    let (store, t) = setup();
    let customer = call(
        &store,
        &t,
        "POST",
        "/api/contacts",
        json!({"kind":"customer","name":"Repair customer"}),
    )["id"]
        .as_i64()
        .unwrap();
    let part = call(
        &store,
        &t,
        "POST",
        "/api/products",
        json!({"name":"Screen","category":"spare_part","cost":1000,"price":1600}),
    )["id"]
        .as_i64()
        .unwrap();
    call(
        &store,
        &t,
        "POST",
        "/api/purchases",
        json!({"lines":[{"product_id":part,"quantity":3,"unit_cost":1000}]}),
    );
    let repair = call(
        &store,
        &t,
        "POST",
        "/api/repairs",
        json!({"customer_id":customer,"model":"Phone X","fault":"Broken screen","labor_charge":500}),
    );
    call(
        &store,
        &t,
        "POST",
        &format!("/api/repairs/{}/parts", repair["id"]),
        json!({"product_id":part,"quantity":1}),
    );
    call(
        &store,
        &t,
        "PATCH",
        &format!("/api/repairs/{}", repair["id"]),
        json!({"status":"Ready"}),
    );
    let rows = call(&store, &t, "GET", "/api/repairs", json!({}));
    assert_eq!(rows[0]["parts_cost"].as_f64(), Some(1000.0));
    let cash = call(
        &store,
        &t,
        "POST",
        "/api/cash/open",
        json!({"opening":5000}),
    );
    call(
        &store,
        &t,
        "POST",
        "/api/payments",
        json!({"repair_id":repair["id"],"amount":1500,"method":"cash"}),
    );
    let closing = call(
        &store,
        &t,
        "POST",
        "/api/cash/close",
        json!({"id":cash["id"],"actual_closing":6500}),
    );
    assert_eq!(closing["variance"].as_f64(), Some(0.0));
    let staff = call(
        &store,
        &t,
        "POST",
        "/api/users",
        json!({"name":"Seller","username":"seller","password":"SellerPass123","role":"salesman"}),
    );
    assert!(staff["id"].as_i64().is_some());
    let login = call(
        &store,
        "",
        "POST",
        "/api/login",
        json!({"username":"seller","password":"SellerPass123"}),
    );
    let seller_token = login["token"].as_str().unwrap();
    assert!(
        store
            .handle("GET", "/api/reports", &json!({}), seller_token)
            .is_err()
    );
    let visible = call(&store, seller_token, "GET", "/api/products", json!({}));
    assert!(visible[0].get("cost").is_none());
}
#[test]
fn trade_in_and_installments_update_imei_history() {
    let (store, t) = setup();
    let customer = call(
        &store,
        &t,
        "POST",
        "/api/contacts",
        json!({"kind":"customer","name":"Buyer"}),
    )["id"]
        .as_i64()
        .unwrap();
    let model = call(
        &store,
        &t,
        "POST",
        "/api/products",
        json!({"name":"Phone model","category":"phone","cost":10000,"price":15000,"warranty_days":30}),
    )["id"]
        .as_i64()
        .unwrap();
    call(
        &store,
        &t,
        "POST",
        "/api/purchases",
        json!({"lines":[{"product_id":model,"unit_cost":10000,"imeis":[{"imei1":"111111111111111"}]}]}),
    );
    let phone = call(&store, &t, "GET", "/api/phones", json!({}))[0]["id"]
        .as_i64()
        .unwrap();
    let sale = call(
        &store,
        &t,
        "POST",
        "/api/sales",
        json!({"customer_id":customer,"lines":[{"product_id":model,"phone_id":phone,"unit_price":15000}],"trade_in_value":2000,"trade_in":{"product_id":model,"imei1":"222222222222222"},"payments":[{"amount":3000,"method":"cash"}],"installments":[{"due_date":"2027-01-01","amount":10000}]}),
    );
    assert_eq!(sale["total"].as_f64(), Some(13000.0));
    let due = call(&store, &t, "GET", "/api/installments", json!({}));
    assert_eq!(due.as_array().unwrap().len(), 1);
    call(
        &store,
        &t,
        "POST",
        &format!("/api/installments/{}/pay", due[0]["id"]),
        json!({"amount":10000,"method":"bank_transfer"}),
    );
    let details = call(
        &store,
        &t,
        "GET",
        &format!("/api/sales/{}", sale["id"]),
        json!({}),
    );
    assert_eq!(details["paid"].as_f64(), Some(13000.0));
    call(
        &store,
        &t,
        "POST",
        "/api/warranties",
        json!({"sale_id":sale["id"],"phone_id":phone,"issue":"Battery"}),
    );
    let claims = call(&store, &t, "GET", "/api/warranties", json!({}));
    assert!(claims[0]["expiry_date"].as_str().is_some());
    let history = call(
        &store,
        &t,
        "GET",
        "/api/phone-history?imei=222222222222222",
        json!({}),
    );
    assert_eq!(history["phone"]["status"], "available");
}
