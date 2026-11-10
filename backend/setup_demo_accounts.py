"""
Hackathon demonstration account setup script.

PURPOSE:
    Creates or verifies the existence of demo accounts needed for a live jury
    demonstration. This script ONLY creates accounts that do not yet exist.
    It NEVER modifies existing account passwords, roles, or active status.

SAFETY RULES:
    1. Refuses to run against any database not in the known demo path unless
       the env var COYOTE_DEMO_DB_PATH is explicitly set.
    2. Never overwrites an existing user's password, role, or is_active flag.
    3. Never silently promotes an existing account to admin or any other role.
    4. Refuses to execute without an explicit "--confirm-demo" CLI flag.
    5. Courier accounts created here are user-role "courier" only; they are
       NOT inserted into the couriers fleet table (use migrate.py for that).

SAFE SETUP PROCESS:
    1. Run schema migration first:    python migrate.py
    2. Run this setup script:         python setup_demo_accounts.py --confirm-demo
    3. Start the backend server:      uvicorn app.main:app --reload
    4. The frontend dev server:       npm run dev  (from frontend/)

WARNING:
    Never execute this script against a database with real customer data.
    The hardcoded demo passwords ("coyote2026") are intentional, well-documented
    demonstration-only credentials and must never be used in a production environment.
"""
import os
import sys
import sqlite3
import datetime
from typing import Optional

# ---------------------------------------------------------------------------
# Demo account definitions
# ---------------------------------------------------------------------------
# password field is intentionally visible here because:
#   - These are documented hackathon demonstration credentials.
#   - The script refuses to overwrite any existing account.
#   - A disclaimer banner is printed before any database change.
DEMO_ACCOUNTS = [
    {"name": "Alikhan T.",    "phone": "+7 (701) 111-2233", "role": "customer", "password": "coyote2026"},
    {"name": "Barista Sarah", "phone": "+7 (701) 333-4455", "role": "staff",    "password": "coyote2026"},
    {"name": "Manager Elena", "phone": "+7 (701) 555-6677", "role": "admin",    "password": "coyote2026"},
    {"name": "Damir S.",      "phone": "+7 (777) 123-4567", "role": "courier",  "password": "coyote2026"},
    {"name": "Aida M.",       "phone": "+7 (777) 987-6543", "role": "courier",  "password": "coyote2026"},
    {"name": "Ruslan B.",     "phone": "+7 (777) 555-8899", "role": "courier",  "password": "coyote2026"},
]

# ---------------------------------------------------------------------------
# Path Resolution and Safety Assertion
# ---------------------------------------------------------------------------
def _resolve_demo_db_path() -> str:
    """Return the demo database path from env or the default sibling location."""
    env_override = os.environ.get("COYOTE_DEMO_DB_PATH", "").strip()
    if env_override:
        return os.path.abspath(env_override)
    return os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "coyote_delivery.db"))


def _assert_safe_demo_target(db_path: str, confirmed_path: str) -> str:
    """
    Refuse to modify any database without explicit confirmation of its resolved absolute path.
    confirmed_path is mandatory. Aborts if missing, empty, or if normalized paths do not match.
    Never relies on filename alone.
    """
    if not confirmed_path or not str(confirmed_path).strip():
        raise RuntimeError(
            f"SAFETY VIOLATION: confirmed_path is mandatory. Database filename alone is insufficient proof of safety.\n"
            f"Explicit confirmation of the resolved absolute database path is required.\n"
            f"Target absolute path: {os.path.abspath(db_path)}"
        )

    abs_target = os.path.normcase(os.path.abspath(db_path))
    abs_confirmed = os.path.normcase(os.path.abspath(confirmed_path.strip()))

    if abs_target != abs_confirmed:
        raise RuntimeError(
            f"SAFETY VIOLATION: Confirmed path does not match target path.\n"
            f"Target:    {abs_target}\n"
            f"Confirmed: {abs_confirmed}"
        )

    return os.path.abspath(db_path)


def setup_demo_accounts(db_path: str, confirmed_path: str) -> None:
    """
    Create missing demo accounts.

    Key invariants:
    - Requires mandatory explicit confirmation of the resolved absolute database path.
    - Never relies on filename alone.
    - Never updates an existing user's password, role, name, or is_active status.
    - Never silently promotes an existing account to admin.
    """
    resolved_target = _assert_safe_demo_target(db_path, confirmed_path=confirmed_path)

    if not os.path.exists(resolved_target):
        raise FileNotFoundError(f"Database not found: {resolved_target}")

    # Lazy import so the module can still be imported in envs without argon2-cffi
    try:
        from argon2 import PasswordHasher
        ph = PasswordHasher()
    except ImportError as exc:
        raise ImportError(
            "argon2-cffi is required: pip install argon2-cffi"
        ) from exc

    print("=" * 60)
    print("DEMO ACCOUNT SETUP — HACKATHON DEMONSTRATION ENVIRONMENT")
    print("WARNING: These credentials must NEVER be used in production.")
    print("=" * 60)
    print(f"Target database: {db_path}")
    print()

    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    created = 0
    skipped = 0
    conflicts = []

    try:
        for acc in DEMO_ACCOUNTS:
            phone = acc["phone"]
            role  = acc["role"]
            name  = acc["name"]

            c.execute(
                "SELECT id, name, role, is_active FROM users WHERE phone = ?",
                (phone,)
            )
            existing = c.fetchone()

            if existing:
                ex_id, ex_name, ex_role, ex_active = existing
                # NEVER overwrite any field on an existing account.
                skipped += 1
                # Flag if the existing role differs from the demo spec — could
                # indicate a misconfigured database; report but do not change.
                if ex_role != role:
                    conflicts.append(
                        f"  [CONFLICT] Phone {phone}: demo expects role='{role}' "
                        f"but existing account #{ex_id} ('{ex_name}') has role='{ex_role}'. "
                        f"No change made."
                    )
                else:
                    print(f"  — Skipped (already exists): {name} [{role}]")
            else:
                # Account does not exist — safe to create.
                pwd_hash = ph.hash(acc["password"])
                now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
                c.execute(
                    "INSERT INTO users (name, phone, role, password_hash, is_active, created_at) "
                    "VALUES (?, ?, ?, ?, 1, ?)",
                    (name, phone, role, pwd_hash, now_iso)
                )
                created += 1
                print(f"  ✓ Created: {name} [{role}]")

        conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"Error during demo account setup: {e}")
        raise
    finally:
        conn.close()

    print()
    print(f"Done. Created: {created}, Already existed (skipped): {skipped}")

    if conflicts:
        print()
        print("ROLE CONFLICTS DETECTED (no changes were made to these accounts):")
        for msg in conflicts:
            print(msg)
        print(
            "Resolution: use the Admin panel (/api/admin/users) to adjust roles, "
            "or manually reconcile before the demonstration."
        )


if __name__ == "__main__":
    has_confirm = any(arg.startswith("--confirm-demo") for arg in sys.argv)
    confirmed = None
    for arg in sys.argv:
        if arg.startswith("--confirm-demo-db-path="):
            confirmed = arg.split("=", 1)[1].strip()
        elif arg.startswith("--confirm-path="):
            confirmed = arg.split("=", 1)[1].strip()
        elif arg.startswith("--confirm-demo=") and len(arg.split("=", 1)[1].strip()) > 0:
            confirmed = arg.split("=", 1)[1].strip()

    if not has_confirm or not confirmed:
        print(
            "ERROR: Explicit confirmation of the database path is mandatory.\n"
            "Re-run with the --confirm-demo and --confirm-demo-db-path flags:\n\n"
            "  python setup_demo_accounts.py --confirm-demo --confirm-demo-db-path=\"<absolute-path-to-db>\"\n\n"
            "This script creates missing demo accounts and never overwrites existing ones.\n"
            "See the module docstring for the safe setup process."
        )
        sys.exit(1)

    db_file = _resolve_demo_db_path()
    setup_demo_accounts(db_file, confirmed_path=confirmed)
