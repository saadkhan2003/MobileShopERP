#!/usr/bin/env python3
"""Back up and load the repeatable SQL demo fixture into a Mobile Shop ERP database."""
import argparse
import datetime as dt
import os
from pathlib import Path
import sqlite3

HERE = Path(__file__).resolve().parent
DEFAULT_DB = Path(os.environ.get("XDG_DATA_HOME", str(Path.home() / ".local/share"))) / "com.mobileshop.erp" / "shop.db"


def check(db: sqlite3.Connection) -> None:
    integrity = db.execute("PRAGMA integrity_check").fetchone()[0]
    if integrity != "ok":
        raise RuntimeError(f"Database integrity check failed: {integrity}")
    foreign_keys = db.execute("PRAGMA foreign_key_check").fetchall()
    if foreign_keys:
        raise RuntimeError(f"Foreign key check failed: {foreign_keys}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", type=Path, default=DEFAULT_DB, help="SQLite database path")
    parser.add_argument("--dry-run", action="store_true", help="Validate using an in-memory copy")
    args = parser.parse_args()
    if not args.db.is_file():
        parser.error(f"Database does not exist: {args.db}. Start the app and create an owner account first.")
    sql = (HERE / "demo-seed.sql").read_text()
    live = sqlite3.connect(args.db, timeout=10)
    live.execute("PRAGMA busy_timeout=10000")
    if live.execute("SELECT count(*) FROM users WHERE role='owner'").fetchone()[0] == 0:
        parser.error("Create the owner account in the app before seeding demo data.")
    check(live)
    trial = sqlite3.connect(":memory:")
    live.backup(trial)
    trial.executescript(sql)
    trial.executescript(sql)
    check(trial)
    trial.close()
    if args.dry_run:
        print("Demo SQL passed twice in a disposable database; live data unchanged.")
        return
    stamp = dt.datetime.now().strftime("%Y-%m-%dT%H-%M-%S")
    backup_path = args.db.with_name(f"backup-demo-{stamp}.db")
    backup = sqlite3.connect(backup_path)
    live.backup(backup)
    backup.close()
    live.execute("PRAGMA foreign_keys=ON")
    live.executescript(sql)
    check(live)
    products = live.execute("SELECT count(*) FROM products WHERE sku LIKE 'DEMO-%'").fetchone()[0]
    print(f"Demo records ready: {products} products. Safety backup: {backup_path}")


if __name__ == "__main__":
    main()
