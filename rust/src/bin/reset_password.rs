use rusqlite::Connection;
use scrypt::{scrypt, Params};
use rand::RngCore;
use std::env;
use std::path::PathBuf;

fn hash_password(password: &str) -> Result<String, Box<dyn std::error::Error>> {
    let mut salt = [0_u8; 16];
    rand::rng().fill_bytes(&mut salt);
    let params = Params::new(14, 8, 1, 64)?;
    let mut output = [0_u8; 64];
    scrypt(password.as_bytes(), &salt, &params, &mut output)?;
    Ok(format!("{}:{}", hex::encode(salt), hex::encode(output)))
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = env::args().collect();
    let home = env::var("HOME")?;
    let db_path = PathBuf::from(home)
        .join(".local/share/com.mobileshop.erp/shop.db");

    if !db_path.exists() {
        eprintln!("Error: Database not found at {:?}", db_path);
        std::process::exit(1);
    }

    let conn = Connection::open(&db_path)?;

    let default_user: String = conn
        .query_row(
            "SELECT username FROM users WHERE role = 'owner' AND active = 1 LIMIT 1",
            [],
            |row| row.get(0),
        )
        .unwrap_or_else(|_| "admin".to_string());

    let username = args.get(1).map(|s| s.as_str()).unwrap_or(&default_user);
    let password = args.get(2).map(|s| s.as_str()).unwrap_or("admin1234");

    if password.len() < 8 {
        eprintln!("Error: Password must be at least 8 characters long.");
        std::process::exit(1);
    }

    let hash = hash_password(password)?;

    let updated = conn.execute(
        "UPDATE users SET password_hash = ?1 WHERE username = ?2",
        (&hash, username),
    )?;

    if updated == 0 {
        eprintln!("Error: User '{}' not found in database.", username);
        std::process::exit(1);
    }

    println!("SUCCESS: Password for '{}' has been reset to '{}'", username, password);
    Ok(())
}
