import sqlite3
import secrets
import datetime
import os
import sys


def _mask(value: str, keep: int = 4) -> str:
    """Mask sensitive strings for log output. Shows first `keep` characters then ***."""
    if not value:
        return "(empty)"
    if len(value) <= keep:
        return "***"
    return value[:keep] + "***"

def run_migration(db_path: str):
    if not os.path.exists(db_path):
        raise FileNotFoundError(f"Database file not found at: {db_path}")

    print(f"Starting safe schema migration on {db_path}...")
    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    try:
        # 1. Inspect and update 'users' table
        c.execute("PRAGMA table_info(users)")
        user_cols = {col[1]: col for col in c.fetchall()}

        if "password_hash" not in user_cols:
            print("  -> Adding 'password_hash' column to users...")
            c.execute("ALTER TABLE users ADD COLUMN password_hash VARCHAR(255)")

        if "is_active" not in user_cols:
            print("  -> Adding 'is_active' column to users...")
            c.execute("ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1")
            c.execute("UPDATE users SET is_active = 1 WHERE is_active IS NULL")

        if "created_at" not in user_cols:
            print("  -> Adding 'created_at' column to users...")
            c.execute("ALTER TABLE users ADD COLUMN created_at DATETIME")
            now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
            c.execute("UPDATE users SET created_at = ? WHERE created_at IS NULL", (now_iso,))

        # 2. Inspect and update 'couriers' table
        c.execute("PRAGMA table_info(couriers)")
        courier_cols = {col[1]: col for col in c.fetchall()}

        if "user_id" not in courier_cols:
            print("  -> Adding 'user_id' column to couriers...")
            c.execute("ALTER TABLE couriers ADD COLUMN user_id INTEGER REFERENCES users(id)")

        # 3. Inspect and update 'orders' table
        c.execute("PRAGMA table_info(orders)")
        order_cols = {col[1]: col for col in c.fetchall()}

        if "tracking_token" not in order_cols:
            print("  -> Adding 'tracking_token' column to orders...")
            c.execute("ALTER TABLE orders ADD COLUMN tracking_token VARCHAR(64)")

        if "idempotency_key" not in order_cols:
            print("  -> Adding 'idempotency_key' column to orders...")
            c.execute("ALTER TABLE orders ADD COLUMN idempotency_key VARCHAR(100)")

        # Ensure all existing orders have an unguessable tracking token
        c.execute("SELECT id FROM orders WHERE tracking_token IS NULL OR tracking_token = ''")
        missing_tokens = c.fetchall()
        if missing_tokens:
            print(f"  -> Backfilling tracking tokens for {len(missing_tokens)} historical orders...")
            for (order_id,) in missing_tokens:
                token = secrets.token_urlsafe(24)
                c.execute("UPDATE orders SET tracking_token = ? WHERE id = ?", (token, order_id))

        # 4. Link courier accounts safely without demoting or converting existing accounts
        c.execute("SELECT id, name, phone, user_id FROM couriers")
        couriers = c.fetchall()
        for c_id, name, phone, u_id in couriers:
            if not u_id:
                c.execute("SELECT id, name, role, password_hash FROM users WHERE phone = ?", (phone,))
                existing_user = c.fetchone()
                if existing_user:
                    user_id, existing_name, role, pwd_hash = existing_user
                    # Only an existing account already having the courier role may be linked automatically
                    if role == "courier":
                        print(f"  -> Linking existing courier user #{user_id} ({existing_name}) to courier #{c_id}.")
                        c.execute("UPDATE couriers SET user_id = ? WHERE id = ?", (user_id, c_id))
                    else:
                        # Existing staff, admin, and customer accounts are NEVER silently demoted or converted.
                        # Never overwrite an existing user's password, name, or role.
                        print(f"  -> Phone {_mask(phone)} belongs to existing {role} user #{user_id} ({existing_name}). Preserving {role} role.")
                        
                        # Generate collision-safe unique phone identifier
                        suffix = 1
                        candidate_phone = f"{phone}_courier"
                        while True:
                            c.execute("SELECT id FROM users WHERE phone = ?", (candidate_phone,))
                            if not c.fetchone():
                                break
                            suffix += 1
                            candidate_phone = f"{phone}_courier_{suffix}"
                        
                        print(f"  -> Creating dedicated courier account (phone suffix: _courier).")
                        # Newly created courier accounts must NOT receive a usable default password (password_hash is NULL)
                        c.execute(
                            "INSERT INTO users (name, phone, role, password_hash, is_active, created_at) VALUES (?, ?, 'courier', NULL, 1, ?)",
                            (name, candidate_phone, datetime.datetime.now(datetime.timezone.utc).isoformat())
                        )
                        new_user_id = c.lastrowid
                        c.execute("UPDATE couriers SET user_id = ? WHERE id = ?", (new_user_id, c_id))
                else:
                    # No user with this phone exists - create dedicated courier user
                    # Newly created courier accounts must NOT receive a usable default password (password_hash is NULL)
                    c.execute(
                        "INSERT INTO users (name, phone, role, password_hash, is_active, created_at) VALUES (?, ?, 'courier', NULL, 1, ?)",
                        (name, phone, datetime.datetime.now(datetime.timezone.utc).isoformat())
                    )
                    new_user_id = c.lastrowid
                    c.execute("UPDATE couriers SET user_id = ? WHERE id = ?", (new_user_id, c_id))

        # 5. Safely create unique indexes after verifying duplicate absence
        # Phone uniqueness
        c.execute("SELECT phone, COUNT(*) FROM users GROUP BY phone HAVING COUNT(*) > 1")
        dup_phones = c.fetchall()
        if dup_phones:
            print(f"  -> Warning: Detected {len(dup_phones)} duplicate phone(s); skipping unique index on users.phone to preserve data.")
            print(f"     Resolve duplicates manually before re-running migration.")
        else:
            c.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_phone ON users(phone)")
            print("  -> Unique index on users(phone): OK")

        # Tracking token uniqueness
        c.execute("SELECT tracking_token, COUNT(*) FROM orders WHERE tracking_token IS NOT NULL AND TRIM(tracking_token) != '' GROUP BY tracking_token HAVING COUNT(*) > 1")
        dup_tokens = c.fetchall()
        if dup_tokens:
            print(f"  -> Warning: Detected {len(dup_tokens)} duplicate tracking token(s); skipping unique index on orders(tracking_token).")
        else:
            c.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_orders_tracking_token ON orders(tracking_token) WHERE tracking_token IS NOT NULL")
            print("  -> Unique index on orders(tracking_token): OK")

        # Idempotency key index - verify no duplicate non-empty keys exist
        c.execute("""
            SELECT idempotency_key, COUNT(*) 
            FROM orders 
            WHERE idempotency_key IS NOT NULL AND TRIM(idempotency_key) != ''
            GROUP BY idempotency_key 
            HAVING COUNT(*) > 1
        """)
        dup_keys = c.fetchall()

        if dup_keys:
            print(f"  -> Warning: Detected duplicate non-empty idempotency keys in orders:")
            for key, count in dup_keys:
                c.execute("SELECT id FROM orders WHERE idempotency_key = ?", (key,))
                order_ids = [str(r[0]) for r in c.fetchall()]
                # Print masked key to avoid leaking order payload data in migration logs
                print(f"     Key {_mask(key)} duplicated across Order IDs: {', '.join(order_ids)} (count={count})")
            print("  -> SKIPPING unique index on orders(idempotency_key) to preserve all historical orders unmodified.")
        else:
            # Partial unique index handles NULL and empty values safely while enforcing uniqueness on non-empty keys
            c.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS ix_orders_idempotency_key 
                ON orders(idempotency_key) 
                WHERE idempotency_key IS NOT NULL AND TRIM(idempotency_key) != ''
            """)
            print("  -> Unique index on orders(idempotency_key): OK")

        # 6. Ensure guest_order_sessions table exists
        c.execute("""
            CREATE TABLE IF NOT EXISTS guest_order_sessions (
                order_id INTEGER PRIMARY KEY,
                session_id TEXT NOT NULL
            )
        """)
        print("  -> Table guest_order_sessions: OK")

        conn.commit()
        print("Schema migration completed successfully with full transaction safety!")
    except Exception as e:
        conn.rollback()
        print(f"CRITICAL: Migration failed with error: {e}. Transaction rolled back.")
        raise e
    finally:
        conn.close()

if __name__ == "__main__":
    db_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "coyote_delivery.db")
    run_migration(db_file)
