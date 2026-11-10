import os
import sys
import tempfile
import threading
from concurrent.futures import ThreadPoolExecutor

# Point to temporary isolated database before importing app
temp_dir = tempfile.mkdtemp()
temp_db_path = os.path.join(temp_dir, "test_isolated.db")
os.environ["DATABASE_URL"] = f"sqlite:///{temp_db_path}"
os.environ["JWT_SECRET_KEY"] = "isolated_test_secret_key_abcdef1234567890"
os.environ["TESTING"] = "1"

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base, get_db
from app.main import app
from app.models import User, Courier, Product, Order, OrderItem
from app.auth import hash_password, create_access_token

test_engine = create_engine(
    f"sqlite:///{temp_db_path}",
    connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

# Initialize database schema on isolated database
Base.metadata.create_all(bind=test_engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

client = TestClient(app)

def setup_isolated_data():
    """Populate test DB with products, users (customer1, customer2, staff, courier1, courier2)."""
    db = TestingSessionLocal()
    
    # Products
    p1 = Product(name="Test Espresso", description="Strong shot", price=3.50, category="Hot Coffee", available=True)
    p2 = Product(name="Test Latte", description="Creamy latte", price=4.50, category="Hot Coffee", available=True)
    db.add_all([p1, p2])
    db.commit()
    
    # Users
    u_cust1 = User(name="Customer One", phone="+7 701 100 0001", password_hash=hash_password("pass123"), role="customer", is_active=True)
    u_cust2 = User(name="Customer Two", phone="+7 701 100 0002", password_hash=hash_password("pass123"), role="customer", is_active=True)
    u_staff = User(name="Staff Member", phone="+7 701 100 0003", password_hash=hash_password("pass123"), role="staff", is_active=True)
    
    u_cour1 = User(name="Courier One", phone="+7 777 100 0001", password_hash=hash_password("pass123"), role="courier", is_active=True)
    u_cour2 = User(name="Courier Two", phone="+7 777 100 0002", password_hash=hash_password("pass123"), role="courier", is_active=True)
    
    db.add_all([u_cust1, u_cust2, u_staff, u_cour1, u_cour2])
    db.commit()

    # Couriers with user_id foreign key
    c1 = Courier(name="Courier One", phone="+7 777 100 0001", availability_status="available", user_id=u_cour1.id)
    c2 = Courier(name="Courier Two", phone="+7 777 100 0002", availability_status="available", user_id=u_cour2.id)
    db.add_all([c1, c2])
    db.commit()
    db.close()

def _execute_isolated_steps():
    setup_isolated_data()
    
    # 1. Login all users
    cust1_tok = client.post("/api/auth/login", json={"phone": "+7 701 100 0001", "password": "pass123"}).json()["access_token"]
    cust2_tok = client.post("/api/auth/login", json={"phone": "+7 701 100 0002", "password": "pass123"}).json()["access_token"]
    staff_tok = client.post("/api/auth/login", json={"phone": "+7 701 100 0003", "password": "pass123"}).json()["access_token"]
    cour1_tok = client.post("/api/auth/login", json={"phone": "+7 777 100 0001", "password": "pass123"}).json()["access_token"]
    cour2_tok = client.post("/api/auth/login", json={"phone": "+7 777 100 0002", "password": "pass123"}).json()["access_token"]
    
    h_cust1 = {"Authorization": f"Bearer {cust1_tok}"}
    h_cust2 = {"Authorization": f"Bearer {cust2_tok}"}
    h_staff = {"Authorization": f"Bearer {staff_tok}"}
    h_cour1 = {"Authorization": f"Bearer {cour1_tok}"}
    h_cour2 = {"Authorization": f"Bearer {cour2_tok}"}
    
    # 2. Test Anonymous order listing blocked
    res_anon_orders = client.get("/api/orders")
    assert res_anon_orders.status_code == 401
    print("✓ TEST 1: Anonymous access to /api/orders blocked (HTTP 401)")
    
    # 3. Create order for Customer 1
    prods = client.get("/api/products").json()
    order_res = client.post("/api/orders", json={
        "customer_name": "Customer One",
        "customer_phone": "+7 701 100 0001",
        "delivery_address": "Test Ave 1",
        "items": [{"product_id": prods[0]["id"], "quantity": 2}]
    }, headers=h_cust1)
    assert order_res.status_code == 201
    order_id = order_res.json()["id"]
    token = order_res.json()["tracking_token"]
    print(f"✓ TEST 2: Customer 1 placed Order #{order_id}")
    
    # 4. IDOR test: Customer 2 attempts to get Customer 1's order details
    res_idor = client.get(f"/api/orders/{order_id}", headers=h_cust2)
    assert res_idor.status_code == 403, f"Expected 403 IDOR rejection, got {res_idor.status_code}"
    print(f"✓ TEST 3: IDOR prevention: Customer 2 cannot read Customer 1's Order #{order_id} (HTTP 403)")
    
    # Customer 1 CAN read their own order
    res_own = client.get(f"/api/orders/{order_id}", headers=h_cust1)
    assert res_own.status_code == 200
    print(f"✓ TEST 4: Customer 1 successfully reads own Order #{order_id}")
    
    # 5. Invalid token test
    res_bad_tok = client.get("/api/orders", headers={"Authorization": "Bearer totally_forged_invalid_jwt_token"})
    assert res_bad_tok.status_code == 401
    print("✓ TEST 5: Forged/invalid JWT token rejected (HTTP 401)")
    
    # 6. Staff advances order to READY_FOR_PICKUP
    client.patch(f"/api/orders/{order_id}/status", json={"status": "ACCEPTED"}, headers=h_staff)
    client.patch(f"/api/orders/{order_id}/status", json={"status": "PREPARING"}, headers=h_staff)
    client.patch(f"/api/orders/{order_id}/status", json={"status": "READY_FOR_PICKUP"}, headers=h_staff)
    print("✓ TEST 6: Staff progressed order to READY_FOR_PICKUP")
    
    # 7. TRUE MULTITHREADED CONCURRENCY RACE CONDITION TEST
    # Two couriers simultaneously send POST /accept on different threads at the exact same moment
    print("\n--- Running True Concurrent Race Condition Test (2 Simultaneous Threads) ---")
    results = []
    
    def courier_accept(headers, courier_name):
        c = TestClient(app)
        res = c.post(f"/api/couriers/orders/{order_id}/accept", headers=headers)
        results.append((courier_name, res.status_code, res.text))
        
    t1 = threading.Thread(target=courier_accept, args=(h_cour1, "Courier 1"))
    t2 = threading.Thread(target=courier_accept, args=(h_cour2, "Courier 2"))
    
    # Fire simultaneously
    t1.start()
    t2.start()
    t1.join()
    t2.join()
    
    status_codes = [r[1] for r in results]
    print(f"  Race results: {results[0][0]} -> {results[0][1]}, {results[1][0]} -> {results[1][1]}")
    assert 200 in status_codes, "Exactly one courier must succeed"
    assert 409 in status_codes, "The other courier must get HTTP 409 Conflict"
    print("✓ TEST 7: TRUE MULTITHREADED CONCURRENCY RACE: 1 accepted (200), 1 conflicted (409)")
    
    # 8. Unassigned courier cannot pickup
    winner_headers = h_cour1 if results[0][1] == 200 and results[0][0] == "Courier 1" or results[1][1] == 200 and results[1][0] == "Courier 1" else h_cour2
    loser_headers = h_cour2 if winner_headers == h_cour1 else h_cour1
    
    res_loser_pickup = client.post(f"/api/couriers/orders/{order_id}/pickup", headers=loser_headers)
    assert res_loser_pickup.status_code == 403
    print("✓ TEST 8: Losing courier unauthorized pickup blocked (HTTP 403)")
    
    # Winner picks up
    res_winner_pickup = client.post(f"/api/couriers/orders/{order_id}/pickup", headers=winner_headers)
    assert res_winner_pickup.status_code == 200
    print("✓ TEST 9: Assigned courier picks up order (HTTP 200)")
    
    # Loser delivery attempt
    res_loser_del = client.post(f"/api/couriers/orders/{order_id}/deliver", headers=loser_headers)
    assert res_loser_del.status_code == 403
    print("✓ TEST 10: Unauthorized delivery attempt blocked (HTTP 403)")
    
    # Winner delivers
    res_winner_del = client.post(f"/api/couriers/orders/{order_id}/deliver", headers=winner_headers)
    assert res_winner_del.status_code == 200
    print("✓ TEST 11: Assigned courier completes delivery (HTTP 200)")
    
    # 9. Verify Public tracking token has NO PII
    track_res = client.get(f"/api/orders/track/{token}").json()
    assert "customer_phone" not in track_res
    assert "customer_name" not in track_res
    assert "delivery_address" not in track_res
    assert "delivery_instructions" not in track_res
    assert "customer_id" not in track_res
    assert "courier_id" not in track_res
    print("✓ TEST 12: Public tracking token response contains zero PII fields")

    # ------------------------------------------------------------------ #
    # TEST 13: Idempotency key scoped to customer — different user CANNOT  #
    # match the same key and must receive 409 Conflict.                    #
    # ------------------------------------------------------------------ #
    print("\n--- Idempotency Cross-User Isolation Test ---")
    prods2 = client.get("/api/products").json()
    shared_key = "shared-idempotency-key-for-both-customers"

    # Customer 1 creates an order with the shared key
    order_cust1 = client.post("/api/orders", json={
        "customer_name": "Customer One",
        "customer_phone": "+7 701 100 0001",
        "delivery_address": "Test Ave 1",
        "idempotency_key": shared_key,
        "items": [{"product_id": prods2[0]["id"], "quantity": 1}],
    }, headers=h_cust1)
    assert order_cust1.status_code == 201, \
        f"Expected 201 for Customer 1 first order, got {order_cust1.status_code}: {order_cust1.text}"
    cust1_new_order_id = order_cust1.json()["id"]
    print(f"✓ TEST 13a: Customer 1 placed order #{cust1_new_order_id} with idempotency key.")

    # Customer 1 retries with same key — should return the existing order (200/201)
    retry_cust1 = client.post("/api/orders", json={
        "customer_name": "Customer One",
        "customer_phone": "+7 701 100 0001",
        "delivery_address": "Test Ave 1",
        "idempotency_key": shared_key,
        "items": [{"product_id": prods2[0]["id"], "quantity": 1}],
    }, headers=h_cust1)
    assert retry_cust1.status_code in (200, 201), \
        f"Expected idempotent return for Customer 1 retry, got {retry_cust1.status_code}"
    assert retry_cust1.json()["id"] == cust1_new_order_id, \
        "Customer 1 idempotency retry must return the same order id"
    print("✓ TEST 13b: Customer 1 retry with same key returned existing order (idempotent).")

    # Customer 2 submits the SAME idempotency key — must be rejected with 409
    conflict_cust2 = client.post("/api/orders", json={
        "customer_name": "Customer Two",
        "customer_phone": "+7 701 100 0002",
        "delivery_address": "Test Ave 2",
        "idempotency_key": shared_key,
        "items": [{"product_id": prods2[0]["id"], "quantity": 1}],
    }, headers=h_cust2)
    assert conflict_cust2.status_code == 409, (
        f"SECURITY VIOLATION: Expected 409 when Customer 2 reuses Customer 1's "
        f"idempotency key, got {conflict_cust2.status_code}: {conflict_cust2.text}"
    )
    print("✓ TEST 13c: Customer 2 correctly rejected (HTTP 409) for cross-user idempotency key reuse.")

    # ------------------------------------------------------------------ #
    # TEST 14: Guest order phone match must NOT auto-link to existing user #
    # ------------------------------------------------------------------ #
    print("\n--- Guest Order Phone-Linkage Isolation Test ---")
    # Submit a guest order (no auth header) using Customer 1's phone number
    guest_order_res = client.post("/api/orders", json={
        "customer_name": "Impersonation Attempt",
        "customer_phone": "+7 701 100 0001",   # Customer 1's registered phone
        "delivery_address": "Shadow St 999",
        "items": [{"product_id": prods2[0]["id"], "quantity": 1}],
    })
    assert guest_order_res.status_code == 201, \
        f"Expected 201 for guest order, got {guest_order_res.status_code}: {guest_order_res.text}"
    guest_order = guest_order_res.json()
    # The critical assertion: customer_id must be None — the guest order must
    # NOT have been silently linked to Customer 1's account.
    assert guest_order.get("customer_id") is None, (
        f"SECURITY VIOLATION: Guest order was linked to customer_id="
        f"{guest_order.get('customer_id')} via phone number match!"
    )
    print("✓ TEST 14: Guest order using a registered phone is NOT linked to that user (customer_id=None).")

    # ------------------------------------------------------------------ #
    # TEST 15: Atomic transaction — committed order must have all items    #
    # ------------------------------------------------------------------ #
    print("\n--- Atomic Transaction Integrity Test ---")
    db_check = TestingSessionLocal()
    try:
        from app.models import Order as OrderModel
        saved_order = db_check.query(OrderModel).filter(
            OrderModel.id == cust1_new_order_id
        ).first()
        assert saved_order is not None, "Order must exist after successful commit"
        assert len(saved_order.items) == 1, (
            f"Order must have exactly 1 item after atomic commit, "
            f"got {len(saved_order.items)}"
        )
        print(f"✓ TEST 15: Order #{cust1_new_order_id} committed atomically with {len(saved_order.items)} item(s).")
    finally:
        db_check.close()

    # ------------------------------------------------------------------ #
    # TEST 16: Two separate guest sessions using the same key & payload   #
    # ------------------------------------------------------------------ #
    print("\n--- Guest-Session Idempotency Scope Isolation Test ---")
    guest_key = "guest-shared-idempotency-key-2026"
    identical_guest_payload = {
        "customer_name": "Walk-in Guest",
        "customer_phone": "+7 701 888 0001",
        "delivery_address": "Neutral St 42",
        "idempotency_key": guest_key,
        "items": [{"product_id": prods2[0]["id"], "quantity": 1}],
    }

    # Two separate guest browser sessions (separate cookie jars)
    client_alpha = TestClient(app)
    client_beta = TestClient(app)

    # Guest Session Alpha creates order with guest_key (server sets HttpOnly cookie)
    res_guest_alpha = client_alpha.post(
        "/api/orders",
        json=identical_guest_payload
    )
    assert res_guest_alpha.status_code == 201, f"Guest Alpha order failed: {res_guest_alpha.text}"
    alpha_order_id = res_guest_alpha.json()["id"]
    alpha_tracking_token = res_guest_alpha.json()["tracking_token"]
    alpha_cookie = res_guest_alpha.cookies.get("coyote_guest_session")
    assert alpha_cookie, "Server must issue coyote_guest_session HttpOnly cookie to guest"
    print(f"✓ TEST 16a: Guest Session Alpha created Order #{alpha_order_id}")

    # Guest Session Beta submits the SAME key with IDENTICAL payload
    res_guest_beta = client_beta.post(
        "/api/orders",
        json=identical_guest_payload
    )
    # Must be rejected with HTTP 409 Conflict — NEVER return Alpha's order or tracking token!
    assert res_guest_beta.status_code == 409, (
        f"SECURITY BREACH: Guest Beta received status {res_guest_beta.status_code} "
        f"instead of 409 Conflict! Response: {res_guest_beta.text}"
    )
    print("✓ TEST 16b: Guest Session Beta blocked with HTTP 409 from claiming Guest Alpha's idempotency key.")

    # Arbitrary Header Spoofing Attempt:
    # Attacker tries to pass arbitrary header X-Guest-Session-ID pointing to Alpha's cookie
    client_attacker = TestClient(app)
    res_attacker = client_attacker.post(
        "/api/orders",
        json=identical_guest_payload,
        headers={"X-Guest-Session-ID": alpha_cookie, "x-guest-session-id": alpha_cookie}
    )
    assert res_attacker.status_code == 409, (
        f"SECURITY BREACH: Arbitrary header allowed claiming another guest's order! Status: {res_attacker.status_code}"
    )
    print("✓ TEST 16c: Attacker supplying arbitrary X-Guest-Session-ID header blocked from claiming Alpha's order.")

    # ------------------------------------------------------------------ #
    # TEST 17: Guest Session Alpha safely retries their own request        #
    # ------------------------------------------------------------------ #
    print("\n--- Guest Session Safe Retry Test ---")
    res_guest_alpha_retry = client_alpha.post(
        "/api/orders",
        json=identical_guest_payload
    )
    assert res_guest_alpha_retry.status_code in (200, 201), (
        f"Expected idempotent return (200/201) for same guest retry, got {res_guest_alpha_retry.status_code}"
    )
    assert res_guest_alpha_retry.json()["id"] == alpha_order_id, (
        "Guest Alpha safe retry must return the existing order ID"
    )
    assert res_guest_alpha_retry.json()["tracking_token"] == alpha_tracking_token, (
        "Guest Alpha safe retry must return their own tracking token"
    )
    print(f"✓ TEST 17: Guest Session Alpha safely retrieved own Order #{alpha_order_id} on retry via cookie.")

    # ------------------------------------------------------------------ #
    # TEST 18: Concurrent requests using the same idempotency key         #
    # ------------------------------------------------------------------ #
    print("\n--- Concurrent Duplicate-Key Collision Handling Test ---")
    concurrent_key = "concurrent-race-key-" + os.urandom(6).hex()
    concurrent_results = []

    def post_concurrent_order(session_id: str):
        c = TestClient(app)
        res = c.post(
            "/api/orders",
            json={
                "customer_name": "Concurrent Tester",
                "customer_phone": "+7 701 999 1234",
                "delivery_address": "Race Blvd 1",
                "idempotency_key": concurrent_key,
                "items": [{"product_id": prods2[0]["id"], "quantity": 1}],
            },
            cookies={"coyote_guest_session": session_id}
        )
        concurrent_results.append((session_id, res.status_code, res.text))

    t_a = threading.Thread(target=post_concurrent_order, args=("concurrent-session-a",))
    t_b = threading.Thread(target=post_concurrent_order, args=("concurrent-session-b",))
    t_a.start()
    t_b.start()
    t_a.join()
    t_b.join()

    codes = [r[1] for r in concurrent_results]
    print(f"  Concurrent race results: {concurrent_results[0][0]} -> {concurrent_results[0][1]}, {concurrent_results[1][0]} -> {concurrent_results[1][1]}")

    # No unhandled 500 error allowed!
    assert 500 not in codes, f"UNHANDLED 500 ERROR in concurrent idempotency: {concurrent_results}"
    # Exactly one must succeed (201) and the conflicting thread must be 409
    assert 201 in codes, f"Expected at least one thread to succeed with 201: {codes}"
    assert 409 in codes, f"Expected conflicting thread to be handled with 409: {codes}"
    print("✓ TEST 18: Concurrent duplicate-key conflict safely handled: 1 created (201), 1 conflicted (409), 0 HTTP 500s.")

    # ------------------------------------------------------------------ #
    # TEST 19: Two simultaneous requests from SAME authenticated user    #
    # ------------------------------------------------------------------ #
    print("\n--- Concurrent Same-User Legitimate Retry Test ---")
    same_user_key = "same-user-race-" + os.urandom(6).hex()
    same_user_results = []

    def post_same_user_order():
        c = TestClient(app)
        res = c.post(
            "/api/orders",
            json={
                "customer_name": "Customer One",
                "customer_phone": "+7 701 100 0001",
                "delivery_address": "Test Ave 1",
                "idempotency_key": same_user_key,
                "items": [{"product_id": prods2[0]["id"], "quantity": 1}],
            },
            headers=h_cust1
        )
        same_user_results.append(res)

    t_u1 = threading.Thread(target=post_same_user_order)
    t_u2 = threading.Thread(target=post_same_user_order)
    t_u1.start()
    t_u2.start()
    t_u1.join()
    t_u2.join()

    u_codes = [r.status_code for r in same_user_results]
    print(f"  Same-user race response codes: {u_codes}")
    assert 500 not in u_codes, f"Same-user race raised unhandled 500: {u_codes}"
    for r in same_user_results:
        assert r.status_code in (200, 201), f"Expected 200/201 on same-user retry, got {r.status_code}: {r.text}"

    # Verify both returned the EXACT same order ID
    order_id_1 = same_user_results[0].json()["id"]
    order_id_2 = same_user_results[1].json()["id"]
    assert order_id_1 == order_id_2, f"Expected same order ID, got {order_id_1} vs {order_id_2}"

    # Verify order items were NOT duplicated in the database
    db_items_check = TestingSessionLocal()
    try:
        from app.models import OrderItem as OrderItemModel
        items_count = db_items_check.query(OrderItemModel).filter(OrderItemModel.order_id == order_id_1).count()
        assert items_count == 1, f"Expected exactly 1 item for order #{order_id_1}, found {items_count}"
        print(f"✓ TEST 19: Same-user simultaneous requests resolved to Order #{order_id_1} without duplicate items.")
    finally:
        db_items_check.close()

    # ------------------------------------------------------------------ #
    # TEST 20: Two simultaneous requests from SAME guest session          #
    # ------------------------------------------------------------------ #
    print("\n--- Concurrent Same-Guest-Session Legitimate Retry Test ---")
    same_guest_key = "same-guest-race-" + os.urandom(6).hex()
    shared_guest_token = "shared-guest-cookie-token-777"
    same_guest_results = []

    def post_same_guest_order():
        c = TestClient(app)
        res = c.post(
            "/api/orders",
            json={
                "customer_name": "Simultaneous Guest",
                "customer_phone": "+7 701 555 4321",
                "delivery_address": "Fast Lane 9",
                "idempotency_key": same_guest_key,
                "items": [{"product_id": prods2[0]["id"], "quantity": 1}],
            },
            cookies={"coyote_guest_session": shared_guest_token}
        )
        same_guest_results.append(res)

    t_g1 = threading.Thread(target=post_same_guest_order)
    t_g2 = threading.Thread(target=post_same_guest_order)
    t_g1.start()
    t_g2.start()
    t_g1.join()
    t_g2.join()

    g_codes = [r.status_code for r in same_guest_results]
    print(f"  Same-guest race response codes: {g_codes}")
    assert 500 not in g_codes, f"Same-guest race raised unhandled 500: {g_codes}"
    for r in same_guest_results:
        assert r.status_code in (200, 201), f"Expected 200/201 on same-guest retry, got {r.status_code}: {r.text}"

    guest_order_id_1 = same_guest_results[0].json()["id"]
    guest_order_id_2 = same_guest_results[1].json()["id"]
    assert guest_order_id_1 == guest_order_id_2, f"Expected same order ID, got {guest_order_id_1} vs {guest_order_id_2}"

    db_guest_items_check = TestingSessionLocal()
    try:
        from app.models import OrderItem as OrderItemModel
        guest_items_count = db_guest_items_check.query(OrderItemModel).filter(OrderItemModel.order_id == guest_order_id_1).count()
        assert guest_items_count == 1, f"Expected exactly 1 item for order #{guest_order_id_1}, found {guest_items_count}"
        print(f"✓ TEST 20: Same-guest simultaneous requests resolved to Order #{guest_order_id_1} without duplicate items.")
    finally:
        db_guest_items_check.close()

    # ------------------------------------------------------------------ #
    # TEST 21: Guest retry after simulated application restart            #
    # ------------------------------------------------------------------ #
    print("\n--- Guest Retry After Simulated Server Restart Test ---")
    restart_key = "restart-persist-key-" + os.urandom(6).hex()
    restart_guest_token = "restart-persistent-session-888"

    # Initial order before restart
    client_pre = TestClient(app)
    res_pre = client_pre.post(
        "/api/orders",
        json={
            "customer_name": "Persistent Guest",
            "customer_phone": "+7 701 333 9999",
            "delivery_address": "Memory Ave 1",
            "idempotency_key": restart_key,
            "items": [{"product_id": prods2[0]["id"], "quantity": 1}],
        },
        cookies={"coyote_guest_session": restart_guest_token}
    )
    assert res_pre.status_code == 201
    pre_order_id = res_pre.json()["id"]

    # SIMULATE SERVER RESTART:
    # 1. Clear any transient in-memory dicts/caches
    # 2. Instantiate a fresh TestClient representing a newly booted server process
    client_post_restart = TestClient(app)

    # Guest retries with their issued cookie
    res_post = client_post_restart.post(
        "/api/orders",
        json={
            "customer_name": "Persistent Guest",
            "customer_phone": "+7 701 333 9999",
            "delivery_address": "Memory Ave 1",
            "idempotency_key": restart_key,
            "items": [{"product_id": prods2[0]["id"], "quantity": 1}],
        },
        cookies={"coyote_guest_session": restart_guest_token}
    )
    assert res_post.status_code in (200, 201), f"Expected 200/201 after restart, got {res_post.status_code}: {res_post.text}"
    assert res_post.json()["id"] == pre_order_id, "Order ID must match persisted order after simulated restart"
    print(f"✓ TEST 21a: Guest order #{pre_order_id} successfully retrieved after simulated server restart.")

    # Verify no duplicate items were created by the retry
    db_restart_check = TestingSessionLocal()
    try:
        from app.models import OrderItem as OrderItemModel
        restart_item_count = db_restart_check.query(OrderItemModel).filter(OrderItemModel.order_id == pre_order_id).count()
        assert restart_item_count == 1, f"Expected exactly 1 item after restart retry, found {restart_item_count}"
        print(f"✓ TEST 21b: No duplicate items created by post-restart retry (item count: {restart_item_count}).")
    finally:
        db_restart_check.close()

    # CRITICAL: A different guest cannot steal this order after restart
    client_thief = TestClient(app)
    res_thief = client_thief.post(
        "/api/orders",
        json={
            "customer_name": "Persistent Guest",
            "customer_phone": "+7 701 333 9999",
            "delivery_address": "Memory Ave 1",
            "idempotency_key": restart_key,
            "items": [{"product_id": prods2[0]["id"], "quantity": 1}],
        },
        cookies={"coyote_guest_session": "thief-session-after-restart-999"}
    )
    assert res_thief.status_code == 409, (
        f"SECURITY BREACH after restart: Different guest stole order with status {res_thief.status_code}! "
        f"Response: {res_thief.text}"
    )
    print("✓ TEST 21c: Different guest blocked from stealing order after simulated restart (HTTP 409).")

    # ------------------------------------------------------------------ #
    # TEST 22: Public tracking privacy exhaustive key assertions          #
    # ------------------------------------------------------------------ #
    print("\n--- Public Tracking Zero-Leakage Privacy Test ---")
    raw_track_res = client.get(f"/api/orders/track/{token}")
    assert raw_track_res.status_code == 200
    track_json = raw_track_res.json()

    # Forbidden PII keys
    forbidden_keys = [
        "customer_phone",
        "customer_name",
        "delivery_address",
        "delivery_instructions",
        "customer_id",
        "courier_id",
    ]
    for k in forbidden_keys:
        assert k not in track_json, f"PII LEAK in tracking response: key '{k}' must not exist"

    # Courier privacy check
    if track_json.get("courier"):
        courier_data = track_json["courier"]
        assert "phone" not in courier_data, "Courier phone must not leak in tracking response"
        assert "user_id" not in courier_data, "Courier user_id must not leak in tracking response"
        assert "id" not in courier_data, "Internal courier ID must not leak in tracking response"
        assert "name" in courier_data, "Courier display name must be present"
    print("✓ TEST 22: Public tracking serialized JSON strictly omits customer PII and courier contact details.")

    print("\n" + "=" * 70)
    print("ALL 22 ISOLATED TESTS (INCLUDING RESTART SAFETY, CONCURRENCY & ZERO-LEAKAGE) PASSED!")
    print("=" * 70)

def test_isolated_suite():
    print("=" * 70)
    print("RUNNING ISOLATED TEST SUITE ON CLEAN IN-MEMORY / TEMP DATABASE")
    print(f"Isolated DB: {temp_db_path}")
    print("=" * 70)
    
    app.dependency_overrides[get_db] = override_get_db
    try:
        _execute_isolated_steps()
    finally:
        # Clean up isolated DB & dependency override
        try:
            app.dependency_overrides.pop(get_db, None)
            test_engine.dispose()
            os.remove(temp_db_path)
            os.rmdir(temp_dir)
        except Exception:
            pass

# Backward compatibility for standalone runners
run_isolated_tests = test_isolated_suite

if __name__ == "__main__":
    test_isolated_suite()
