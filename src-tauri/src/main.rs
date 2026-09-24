use mobile_shop_backend::Store;
use serde_json::Value;
use std::sync::Arc;
use tauri::{Manager, State};
use tauri_plugin_updater::UpdaterExt;

#[tauri::command]
fn app_version(app: tauri::AppHandle) -> String {
    app.package_info().version.to_string()
}

#[tauri::command]
fn api_request(
    store: State<'_, Arc<Store>>,
    method: String,
    path: String,
    data: Value,
    token: String,
) -> Result<Value, String> {
    store
        .handle(&method, &path, &data, &token)
        .map_err(|e| e.message)
}

#[tauri::command]
fn save_pdf(path: String, bytes: Vec<u8>) -> Result<(), String> {
    let target=std::path::Path::new(&path);
    if target.extension().and_then(|x|x.to_str()).is_none_or(|x|!x.eq_ignore_ascii_case("pdf"))
        || !bytes.starts_with(b"%PDF-") || bytes.len()>10_000_000 {
        return Err("Invalid PDF document or destination".into());
    }
    std::fs::write(target,bytes).map_err(|e|e.to_string())
}

#[tauri::command]
async fn check_updates(app: tauri::AppHandle) -> Result<Value, String> {
    let Some(endpoint)=option_env!("MOBILE_SHOP_UPDATE_URL") else {return Ok(serde_json::json!({"configured":false}));};
    let url=endpoint.parse().map_err(|e|format!("Invalid update URL: {e}"))?;
    let update=app.updater_builder().endpoints(vec![url]).map_err(|e|e.to_string())?.timeout(std::time::Duration::from_secs(10)).build().map_err(|e|e.to_string())?.check().await.map_err(|e|e.to_string())?;
    Ok(match update {Some(u)=>serde_json::json!({"configured":true,"available":true,"version":u.version,"current_version":u.current_version,"notes":u.body,"critical":u.raw_json.get("critical").and_then(Value::as_bool).unwrap_or(false),"minimum_version":u.raw_json.get("minimum_version").and_then(Value::as_str)}),None=>serde_json::json!({"configured":true,"available":false})})
}

#[tauri::command]
async fn install_update(app: tauri::AppHandle) -> Result<(), String> {
    let endpoint=option_env!("MOBILE_SHOP_UPDATE_URL").ok_or("Updates are not configured")?;
    let url=endpoint.parse().map_err(|e|format!("Invalid update URL: {e}"))?;
    let update=app.updater_builder().endpoints(vec![url]).map_err(|e|e.to_string())?.timeout(std::time::Duration::from_secs(900)).build().map_err(|e|e.to_string())?.check().await.map_err(|e|e.to_string())?.ok_or("No update available")?;
    update.download_and_install(|_,_|{},||{}).await.map_err(|e|e.to_string())?;
    app.restart();
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if let Some(key)=option_env!("MOBILE_SHOP_UPDATE_PUBLIC_KEY") {
                app.handle().plugin(tauri_plugin_updater::Builder::new().pubkey(key).build())?;
            }
            let dir = app.path().app_data_dir()?;
            let store = Store::open(dir).map_err(|e| std::io::Error::other(e.to_string()))?;
            let store=Arc::new(store);
            let scheduled=store.clone();
            std::thread::spawn(move || loop {
                if let Err(e)=scheduled.run_scheduled_backup(){eprintln!("scheduled backup: {e}");}
                std::thread::sleep(std::time::Duration::from_secs(3600));
            });
            app.manage(store);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![api_request,save_pdf,app_version,check_updates,install_update])
        .run(tauri::generate_context!())
        .expect("Mobile Shop ERP failed to start");
}
