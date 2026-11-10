import os
import sys
import tempfile
import sqlite3
import pytest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from migrate import run_migration
from app.auth import get_jwt_secret, verify_password

def create_base_test_db(db_path: str):
    """Creates a basic unmigrated database schema matching pre-migration state."""
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute("""
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(100) NOT NULL,
            phone VARCHAR(30) NOT NULL,
            role VARCHAR(30) DEFAULT 'customer'
        )
    """)
    c.execute("""
        CREATE TABLE couriers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(100) NOT NULL,
            phone VARCHAR(30) NOT NULL,
            availability_status VARCHAR(30) DEFAULT 'available'
        )
    """)
    c.execute("""
        CREATE TABLE orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_name VARCHAR(100),
            customer_phone VARCHAR(30),
            delivery_address VARCHAR(255),
            status VARCHAR(40) DEFAULT 'PENDING',
            total_price FLOAT DEFAULT 0.0
        )
    """)
    conn.commit()
    conn.close()

def test_migration_customer_not_demoted():
    """Verify that an existing customer account is NEVER converted into a courier."""
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmpdir:
        db_path = os.path.join(tmpdir, "test_customer.db")
        create_base_test_db(db_path)
        
        conn = sqlite3.connect(db_path)
        c = conn.cursor()
        c.execute("INSERT INTO users (name, phone, role) VALUES ('Alice Customer', '+7 701 111 0001', 'customer')")
        alice_id = c.lastrowid
        c.execute("INSERT INTO couriers (name, phone) VALUES ('Alice Courier', '+7 701 111 0001')")
        courier_id = c.lastrowid
        conn.commit()
        conn.close()
        
        # Run migration
        run_migration(db_path)
        
        # Verify customer record remains unchanged
        conn = sqlite3.connect(db_path)
        c = conn.cursor()
        c.execute("SELECT id, name, role, phone FROM users WHERE id = ?", (alice_id,))
        user_row = c.fetchone()
        assert user_row is not None
        assert user_row[2] == "customer", f"Expected role 'customer', got '{user_row[2]}'"
        assert user_row[1] == "Alice Customer"
        assert user_row[3] == "+7 701 111 0001"
        
        # Verify courier is linked to a separate dedicated account with collision-safe phone
        c.execute("SELECT user_id FROM couriers WHERE id = ?", (courier_id,))
        linked_user_id = c.fetchone()[0]
        assert linked_user_id != alice_id, "Courier must not be linked to customer user account"
        
        c.execute("SELECT name, phone, role, password_hash FROM users WHERE id = ?", (linked_user_id,))
        new_courier_user = c.fetchone()
        assert new_courier_user[0] == "Alice Courier"
        assert new_courier_user[1] == "+7 701 111 0001_courier"
        assert new_courier_user[2] == "courier"
        assert new_courier_user[3] is None, "Newly created courier account must have NULL password_hash"
        conn.close()

def test_migration_staff_admin_roles_unchanged():
    """Verify staff and admin accounts are never converted to courier role."""
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmpdir:
        db_path = os.path.join(tmpdir, "test_staff_admin.db")
        create_base_test_db(db_path)
        
        conn = sqlite3.connect(db_path)
        c = conn.cursor()
        c.execute("INSERT INTO users (name, phone, role) VALUES ('Sarah Staff', '+7 701 222 0002', 'staff')")
        staff_id = c.lastrowid
        c.execute("INSERT INTO users (name, phone, role) VALUES ('Elena Admin', '+7 701 333 0003', 'admin')")
        admin_id = c.lastrowid
        c.execute("INSERT INTO couriers (name, phone) VALUES ('Courier S', '+7 701 222 0002')")
        c.execute("INSERT INTO couriers (name, phone) VALUES ('Courier A', '+7 701 333 0003')")
        conn.commit()
        conn.close()
        
        run_migration(db_path)
        
        conn = sqlite3.connect(db_path)
        c = conn.cursor()
        c.execute("SELECT role FROM users WHERE id = ?", (staff_id,))
        assert c.fetchone()[0] == "staff", "Staff role must not be changed"
        
        c.execute("SELECT role FROM users WHERE id = ?", (admin_id,))
        assert c.fetchone()[0] == "admin", "Admin role must not be changed"
        conn.close()

def test_migration_existing_courier_linked_safely():
    """Verify that an account that ALREADY has role='courier' is linked without altering credentials."""
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmpdir:
        db_path = os.path.join(tmpdir, "test_existing_courier.db")
        create_base_test_db(db_path)
        
        conn = sqlite3.connect(db_path)
        c = conn.cursor()
        c.execute("INSERT INTO users (name, phone, role) VALUES ('Damir Courier', '+7 777 444 0004', 'courier')")
        courier_user_id = c.lastrowid
        c.execute("INSERT INTO couriers (name, phone) VALUES ('Damir Courier', '+7 777 444 0004')")
        courier_id = c.lastrowid
        conn.commit()
        conn.close()
        
        run_migration(db_path)
        
        conn = sqlite3.connect(db_path)
        c = conn.cursor()
        c.execute("SELECT user_id FROM couriers WHERE id = ?", (courier_id,))
        assert c.fetchone()[0] == courier_user_id, "Existing courier user must be linked to courier record"
        
        c.execute("SELECT role FROM users WHERE id = ?", (courier_user_id,))
        assert c.fetchone()[0] == "courier"
        conn.close()

def test_newly_created_courier_cannot_login_with_default_password():
    """Verify that newly created courier accounts cannot log in with any default password."""
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmpdir:
        db_path = os.path.join(tmpdir, "test_no_default_pass.db")
        create_base_test_db(db_path)
        
        conn = sqlite3.connect(db_path)
        c = conn.cursor()
        c.execute("INSERT INTO couriers (name, phone) VALUES ('New Driver', '+7 777 999 1111')")
        conn.commit()
        conn.close()
        
        run_migration(db_path)
        
        conn = sqlite3.connect(db_path)
        c = conn.cursor()
        c.execute("SELECT password_hash FROM users WHERE phone = '+7 777 999 1111'")
        row = c.fetchone()
        assert row is not None
        password_hash = row[0]
        assert password_hash is None, f"Expected NULL password_hash, got {password_hash}"
        
        # Test that verify_password rejects common default passwords against None / empty
        assert not verify_password("coyote2026", password_hash or "")
        assert not verify_password("password", password_hash or "")
        assert not verify_password("123456", password_hash or "")
        conn.close()

def test_duplicate_idempotency_keys_do_not_delete_or_alter_orders():
    """Verify that duplicate idempotency keys do not cause historical orders to be deleted or changed."""
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmpdir:
        db_path = os.path.join(tmpdir, "test_dup_idemp.db")
        create_base_test_db(db_path)
        
        # Add idempotency_key column before migration to simulate duplicate existing keys
        conn = sqlite3.connect(db_path)
        c = conn.cursor()
        c.execute("ALTER TABLE orders ADD COLUMN idempotency_key VARCHAR(100)")
        
        # Insert duplicate non-empty keys, empty string, and NULL
        c.execute("INSERT INTO orders (customer_name, idempotency_key, total_price) VALUES ('Order A', 'dup_key_1', 15.5)")
        id1 = c.lastrowid
        c.execute("INSERT INTO orders (customer_name, idempotency_key, total_price) VALUES ('Order B', 'dup_key_1', 25.0)")
        id2 = c.lastrowid
        c.execute("INSERT INTO orders (customer_name, idempotency_key, total_price) VALUES ('Order C', '', 35.0)")
        id3 = c.lastrowid
        c.execute("INSERT INTO orders (customer_name, idempotency_key, total_price) VALUES ('Order D', NULL, 45.0)")
        id4 = c.lastrowid
        conn.commit()
        conn.close()
        
        # Migration must succeed without failing or deleting orders
        run_migration(db_path)
        
        # Verify all 4 orders still exist completely intact
        conn = sqlite3.connect(db_path)
        c = conn.cursor()
        c.execute("SELECT id, customer_name, idempotency_key, total_price FROM orders ORDER BY id")
        rows = c.fetchall()
        assert len(rows) == 4, f"Expected 4 orders preserved, got {len(rows)}"
        assert rows[0] == (id1, "Order A", "dup_key_1", 15.5)
        assert rows[1] == (id2, "Order B", "dup_key_1", 25.0)
        assert rows[2] == (id3, "Order C", "", 35.0)
        assert rows[3] == (id4, "Order D", None, 45.0)
        
        # Verify unique index was skipped to avoid data corruption or integrity error
        c.execute("PRAGMA index_list(orders)")
        indexes = [idx[1] for idx in c.fetchall()]
        assert "ix_orders_idempotency_key" not in indexes, "Unique index should be skipped when duplicate keys exist"
        conn.close()

def test_missing_jwt_secret_fails_outside_explicit_test_mode():
    """Verify that get_jwt_secret() raises RuntimeError when JWT_SECRET_KEY is missing and TESTING!=1."""
    orig_secret = os.environ.get("JWT_SECRET_KEY")
    orig_testing = os.environ.get("TESTING")
    
    try:
        # Clear secret and testing flag
        os.environ.pop("JWT_SECRET_KEY", None)
        os.environ.pop("TESTING", None)
        
        with pytest.raises(RuntimeError) as exc_info:
            get_jwt_secret()
            
        assert "CRITICAL SECURITY CONFIGURATION ERROR" in str(exc_info.value)
    finally:
        # Restore environment
        if orig_secret is not None:
            os.environ["JWT_SECRET_KEY"] = orig_secret
        if orig_testing is not None:
            os.environ["TESTING"] = orig_testing

def test_explicit_isolated_test_mode_works():
    """Verify that get_jwt_secret() succeeds when TESTING=1 is explicitly set."""
    orig_secret = os.environ.get("JWT_SECRET_KEY")
    orig_testing = os.environ.get("TESTING")
    
    try:
        os.environ.pop("JWT_SECRET_KEY", None)
        os.environ["TESTING"] = "1"
        
        secret = get_jwt_secret()
        assert secret == "coyote_test_isolated_secret_key_non_production_32bytes_len"
    finally:
        # Restore environment
        if orig_secret is not None:
            os.environ["JWT_SECRET_KEY"] = orig_secret
        if orig_testing is not None:
            os.environ["TESTING"] = orig_testing

# =========================================================================
# Additional Security Remediation Tests
# =========================================================================

def test_setup_demo_accounts_safety_guards():
    """Verify setup_demo_accounts enforces mandatory confirmed_path, path normalization, and safe execution."""
    from setup_demo_accounts import setup_demo_accounts, _assert_safe_demo_target, _resolve_demo_db_path
    import hashlib

    # 1. Verify _resolve_demo_db_path is defined and callable
    resolved = _resolve_demo_db_path()
    assert os.path.isabs(resolved)
    assert "coyote_delivery.db" in resolved

    # 2. Missing confirmation: Aborts if confirmed_path is missing, None, or empty
    with pytest.raises(TypeError):
        _assert_safe_demo_target("/var/prod/coyote_delivery.db")  # missing required positional argument

    with pytest.raises(RuntimeError) as exc_none:
        _assert_safe_demo_target("/var/prod/coyote_delivery.db", confirmed_path=None)
    assert "SAFETY VIOLATION: confirmed_path is mandatory" in str(exc_none.value)

    with pytest.raises(RuntimeError) as exc_empty:
        _assert_safe_demo_target("/var/prod/coyote_delivery.db", confirmed_path="")
    assert "SAFETY VIOLATION: confirmed_path is mandatory" in str(exc_empty.value)

    # 3. Incorrect path: Refuses when confirmed path does not match target path
    with pytest.raises(RuntimeError) as exc_mismatch:
        _assert_safe_demo_target("/tmp/test_a.db", confirmed_path="/tmp/test_b.db")
    assert "Confirmed path does not match target path" in str(exc_mismatch.value)

    # 4. Correct path: Succeeds when normalized absolute paths match
    target_sample = os.path.abspath("/tmp/sample_coyote.db")
    result_path = _assert_safe_demo_target(target_sample, confirmed_path=target_sample)
    assert os.path.normcase(result_path) == os.path.normcase(target_sample)

    # 5. Temporary Windows SQLite database path with mixed casing and slashes
    win_path_forward = "c:/temp/coyote_win_test.db"
    win_path_backward = "C:\\TEMP\\coyote_win_test.db"
    res_win = _assert_safe_demo_target(win_path_forward, confirmed_path=win_path_backward)
    assert os.path.normcase(res_win) == os.path.normcase(os.path.abspath(win_path_forward))

    # 6. Safety check: Setup script runs ONLY against temp DB and NEVER touches persistent DB
    persistent_db = os.path.join(os.path.dirname(os.path.abspath(__file__)), "coyote_delivery.db")
    hash_before = None
    if os.path.exists(persistent_db):
        with open(persistent_db, "rb") as f:
            hash_before = hashlib.sha256(f.read()).hexdigest()

    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmpdir:
        db_path = os.path.join(tmpdir, "test_demo.db")
        create_base_test_db(db_path)
        
        # Add columns like migrate does
        conn = sqlite3.connect(db_path)
        c = conn.cursor()
        c.execute("ALTER TABLE users ADD COLUMN password_hash VARCHAR(255)")
        c.execute("ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1")
        c.execute("ALTER TABLE users ADD COLUMN created_at DATETIME")
        
        # Pre-insert existing user with role='customer' on the phone used by Manager Elena in demo list
        elena_phone = "+7 (701) 555-6677"
        c.execute(
            "INSERT INTO users (name, phone, role, password_hash, is_active) VALUES (?, ?, ?, ?, ?)",
            ("Custom Customer Elena", elena_phone, "customer", "custom_hash_abc", 0) # inactive customer
        )
        existing_id = c.lastrowid
        conn.commit()
        conn.close()

        # Run setup_demo_accounts with explicit mandatory confirmation of the temporary database path
        setup_demo_accounts(db_path, confirmed_path=db_path)

        # Verify Elena was NOT promoted to admin, password NOT overwritten, active status NOT changed
        conn = sqlite3.connect(db_path)
        c = conn.cursor()
        c.execute("SELECT name, role, password_hash, is_active FROM users WHERE id = ?", (existing_id,))
        row = c.fetchone()
        assert row[0] == "Custom Customer Elena", "Name must not be overwritten"
        assert row[1] == "customer", "Role must NOT be silently promoted to admin"
        assert row[2] == "custom_hash_abc", "Password hash must not be overwritten"
        assert row[3] == 0, "is_active flag must not be overwritten"
        conn.close()

    if hash_before is not None and os.path.exists(persistent_db):
        with open(persistent_db, "rb") as f:
            hash_after = hashlib.sha256(f.read()).hexdigest()
        assert hash_before == hash_after, "Persistent database was modified during test_setup_demo_accounts!"

def test_atomic_order_transaction_rollback_on_item_failure():
    """Verify that if an order item fails during insertion, the entire order is rolled back with zero incomplete records."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from app.models import Base as AppBase, Order, OrderItem, Product
    from app.schemas import OrderCreate, OrderItemCreate
    from app.crud import create_order
    from fastapi import HTTPException

    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmpdir:
        db_path = os.path.join(tmpdir, "test_atomic.db")
        engine = create_engine(f"sqlite:///{db_path}")
        AppBase.metadata.create_all(bind=engine)
        Session = sessionmaker(bind=engine)
        db = Session()

        # Add 1 product
        prod = Product(name="Atomic Espresso", price=3.5, category="Coffee", available=True)
        db.add(prod)
        db.commit()
        db.refresh(prod)

        # Order requesting 1 valid product and 1 invalid product ID
        order_payload = OrderCreate(
            customer_name="Test Customer",
            customer_phone="+7 701 999 8877",
            delivery_address="Street 1",
            items=[
                OrderItemCreate(product_id=prod.id, quantity=1),
                OrderItemCreate(product_id=99999, quantity=1), # Non-existent product
            ]
        )

        with pytest.raises(HTTPException) as exc:
            create_order(db, order_payload, customer_id=None)
        assert exc.value.status_code == 404

        # Verify no partial order header exists in database
        order_count = db.query(Order).count()
        item_count = db.query(OrderItem).count()
        assert order_count == 0, "No partial Order header should remain on failure"
        assert item_count == 0, "No partial OrderItem should remain on failure"
        db.close()
        engine.dispose()

def test_courier_account_without_password_cannot_login_endpoint():
    """Verify that courier accounts with NULL password_hash receive HTTP 401 when attempting /api/auth/login."""
    from fastapi.testclient import TestClient
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from app.database import Base as AppBase, get_db
    from app.main import app
    from app.models import User, Courier

    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmpdir:
        db_path = os.path.join(tmpdir, "test_courier_login.db")
        engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
        AppBase.metadata.create_all(bind=engine)
        Session = sessionmaker(bind=engine)
        db = Session()

        # Create courier user with NULL password_hash (same as created by migration)
        user = User(name="Unconfigured Courier", phone="+7 777 000 1234", role="courier", password_hash=None, is_active=True)
        db.add(user)
        db.commit()
        db.refresh(user)

        courier = Courier(name="Unconfigured Courier", phone="+7 777 000 1234", availability_status="available", user_id=user.id)
        db.add(courier)
        db.commit()
        db.close()

        def override_db():
            s = Session()
            try:
                yield s
            finally:
                s.close()

        app.dependency_overrides[get_db] = override_db
        try:
            client = TestClient(app)
            # Try login with empty password
            res_empty = client.post("/api/auth/login", json={"phone": "+7 777 000 1234", "password": ""})
            assert res_empty.status_code in [401, 422]

            # Try login with default demo password
            res_demo = client.post("/api/auth/login", json={"phone": "+7 777 000 1234", "password": "coyote2026"})
            assert res_demo.status_code == 401
            assert "Invalid phone number or password" in res_demo.json()["detail"]
        finally:
            app.dependency_overrides.pop(get_db, None)
            engine.dispose()

def test_database_error_privacy_no_raw_leakage():
    """Verify that database integrity errors return generic HTTP 400 responses with zero technical/raw driver leaks."""
    from fastapi.testclient import TestClient
    from sqlalchemy import create_engine, event
    from sqlalchemy.orm import sessionmaker
    from app.database import Base as AppBase, get_db
    from app.main import app
    from app.models import Product
    from unittest.mock import patch
    from sqlalchemy.exc import IntegrityError

    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmpdir:
        db_path = os.path.join(tmpdir, "test_err_privacy.db")
        engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
        AppBase.metadata.create_all(bind=engine)
        Session = sessionmaker(bind=engine)
        db = Session()

        # Add a product
        p = Product(name="Privacy Test Item", price=5.0, category="Hot Coffee", available=True)
        db.add(p)
        db.commit()
        p_id = p.id
        db.close()

        def override_db():
            s = Session()
            try:
                yield s
            finally:
                s.close()

        app.dependency_overrides[get_db] = override_db
        try:
            client = TestClient(app)
            order_data = {
                "customer_name": "Error Privacy Tester",
                "customer_phone": "+7 701 000 9999",
                "delivery_address": "Secure Street 1",
                "items": [{"product_id": p_id, "quantity": 1}]
            }

            # Simulate an unexpected database constraint error during commit
            with patch("sqlalchemy.orm.Session.commit", side_effect=IntegrityError("CHECK constraint failed: simulated_internal_leak", orig=Exception("sqlite3.IntegrityError: CHECK constraint failed: internal_table.internal_col"), params={})):
                res = client.post("/api/orders", json=order_data)
                assert res.status_code == 400
                detail = res.json().get("detail", "")
                
                # Assert generic response
                assert detail == "Order could not be created due to a database integrity constraint violation. Please verify your order data."
                
                # Assert strictly zero leakage of raw driver / table / column names
                raw_leak_terms = ["sqlite3", "sqlalchemy", "traceback", "internal_table", "internal_col", "CHECK constraint"]
                for term in raw_leak_terms:
                    assert term.lower() not in detail.lower(), f"RAW DB LEAK DETECTED: Response leaked '{term}' in detail: {detail}"
        finally:
            app.dependency_overrides.pop(get_db, None)
            engine.dispose()

def test_guest_cookie_secure_flag_on_https():
    """Verify that coyote_guest_session cookie has Secure flag enabled on HTTPS/production deployments."""
    from fastapi.testclient import TestClient
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from app.database import Base as AppBase, get_db
    from app.main import app
    from app.models import Product

    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmpdir:
        db_path = os.path.join(tmpdir, "test_secure_cookie.db")
        engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
        AppBase.metadata.create_all(bind=engine)
        Session = sessionmaker(bind=engine)
        db = Session()

        p = Product(name="Cookie Test Product", price=4.0, category="Hot Coffee", available=True)
        db.add(p)
        db.commit()
        p_id = p.id
        db.close()

        def override_db():
            s = Session()
            try:
                yield s
            finally:
                s.close()

        app.dependency_overrides[get_db] = override_db
        try:
            # 1. HTTPS client sets Secure cookie
            https_client = TestClient(app, base_url="https://coyote.delivery")
            res_https = https_client.post("/api/orders", json={
                "customer_name": "HTTPS Guest",
                "customer_phone": "+7 701 111 2222",
                "delivery_address": "HTTPS Boulevard 10",
                "items": [{"product_id": p_id, "quantity": 1}]
            })
            assert res_https.status_code == 201
            set_cookie_header = res_https.headers.get("set-cookie", "")
            assert "coyote_guest_session" in set_cookie_header
            assert "httponly" in set_cookie_header.lower()
            assert "secure" in set_cookie_header.lower(), f"Expected Secure flag on HTTPS cookie: {set_cookie_header}"

            # 2. X-Forwarded-Proto: https sets Secure cookie
            http_client = TestClient(app)
            res_forwarded = http_client.post("/api/orders", json={
                "customer_name": "Forwarded HTTPS Guest",
                "customer_phone": "+7 701 111 3333",
                "delivery_address": "Proxy Boulevard 11",
                "items": [{"product_id": p_id, "quantity": 1}]
            }, headers={"X-Forwarded-Proto": "https"})
            assert res_forwarded.status_code == 201
            forwarded_cookie = res_forwarded.headers.get("set-cookie", "")
            assert "secure" in forwarded_cookie.lower(), f"Expected Secure flag with X-Forwarded-Proto https: {forwarded_cookie}"
        finally:
            app.dependency_overrides.pop(get_db, None)
            engine.dispose()

if __name__ == "__main__":
    pytest.main(["-v", __file__])
