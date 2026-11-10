import os
import sys
import shutil
import tempfile

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(BASE_DIR, "backend")
ORIGINAL_DB_PATH = os.path.join(BACKEND_DIR, "coyote_delivery.db")

def mask_phone(phone: str) -> str:
    """Masks phone number for log safety."""
    if len(phone) >= 8:
        return phone[:6] + " *** ** " + phone[-2:]
    return "***"

def mask_token(token: str) -> str:
    """Masks unguessable tracking token for log safety."""
    if token and len(token) >= 10:
        return token[:6] + "..." + token[-4:]
    return "***"

def run_e2e_verification():
    if not os.path.exists(ORIGINAL_DB_PATH):
        raise FileNotFoundError(f"Persistent database template not found at: {ORIGINAL_DB_PATH}")

    engine = None
    temp_dir_path = None
    temp_db_path = None

    # Use TemporaryDirectory for reliable, guaranteed lifecycle management
    with tempfile.TemporaryDirectory(prefix="coyote_e2e_") as temp_dir:
        temp_dir_path = temp_dir
        temp_db_path = os.path.join(temp_dir, "e2e_isolated.db")

        # 1. Copy persistent template into isolated environment
        shutil.copy2(ORIGINAL_DB_PATH, temp_db_path)

        # 2. Configure environment strictly for isolated temporary database
        os.environ["DATABASE_URL"] = f"sqlite:///{temp_db_path}"
        os.environ["TESTING"] = "1"

        # Add backend directory to sys.path
        if BACKEND_DIR not in sys.path:
            sys.path.insert(0, BACKEND_DIR)

        # 3. Import application and database dependencies
        from fastapi.testclient import TestClient
        from app.database import engine as db_engine
        from app.main import app

        engine = db_engine

        # 4. Strict safety assertions: Refuse to execute if pointing to persistent database
        resolved_db_path = os.path.normcase(os.path.abspath(engine.url.database))
        expected_temp_path = os.path.normcase(os.path.abspath(temp_db_path))
        original_persistent_path = os.path.normcase(os.path.abspath(ORIGINAL_DB_PATH))

        assert resolved_db_path == expected_temp_path, (
            f"SAFETY VIOLATION: Resolved DB path '{resolved_db_path}' does not match temporary DB '{expected_temp_path}'!"
        )
        assert resolved_db_path != original_persistent_path, (
            f"CRITICAL SAFETY VIOLATION: Engine URL points to persistent database '{original_persistent_path}'!"
        )
        assert "coyote_delivery.db" not in os.path.basename(resolved_db_path), (
            f"CRITICAL SAFETY VIOLATION: Engine database name '{os.path.basename(resolved_db_path)}' matches persistent DB!"
        )

        client = TestClient(app)

        print("=" * 75)
        print("COYOTE DELIVERY 1.1 — COMPLETE END-TO-END VERIFICATION SUITE")
        print("Global Coffee x Coyote (Case 01 — Own Delivery based on Coyote POS)")
        print(f"Isolated Test Database: {temp_db_path}")
        print("=" * 75)

        try:
            # Step 1: Customer registration & authentication
            print("\n[Step 1] Customer Registration & Argon2id Password Hashing...")
            phone_suffix = os.urandom(3).hex()
            customer_phone = f"+7 701 555 {phone_suffix[:4]}"
            reg_res = client.post("/api/auth/register", json={
                "name": "E2E Test Customer",
                "phone": customer_phone,
                "password": "customer_pass_2026"
            })
            assert reg_res.status_code == 201, f"Registration failed (HTTP {reg_res.status_code}): {reg_res.text}"
            reg_data = reg_res.json()
            assert "access_token" in reg_data, "Registration response missing access_token"
            customer_token = reg_data["access_token"]
            customer_user = reg_data["user"]
            assert customer_user["role"] == "customer", "Public registration must strictly be customer"
            customer_headers = {"Authorization": f"Bearer {customer_token}"}
            print(f"  ✓ Customer registered: {customer_user['name']} ({mask_phone(customer_user['phone'])}) [Role: {customer_user['role']}]")

            # Step 2: Customer fetches menu products
            print("\n[Step 2] Customer Browses Menu...")
            prods_res = client.get("/api/products")
            assert prods_res.status_code == 200, f"Failed to fetch products: {prods_res.status_code}"
            products = prods_res.json()
            assert len(products) >= 10, f"Expected at least 10 products, found {len(products)}"
            p1 = products[0]
            p2 = products[1]
            print(f"  ✓ Menu loaded: {len(products)} specialty items available.")
            print(f"    Item 1: {p1['name']} (${p1['price']:.2f})")
            print(f"    Item 2: {p2['name']} (${p2['price']:.2f})")

            # Step 3: Customer places order with server-side pricing & idempotency key
            print("\n[Step 3] Customer Places Order (Server-Side Pricing & Idempotency)...")
            idempotency_key = "e2e-idemp-" + os.urandom(8).hex()
            expected_total = round(p1["price"] * 2 + p2["price"] * 1, 2)
            order_payload = {
                "customer_name": customer_user["name"],
                "customer_phone": customer_user["phone"],
                "delivery_address": "Kabanbay Batyr Ave 53, Apt 104",
                "delivery_instructions": "Contactless drop-off at entrance",
                "idempotency_key": idempotency_key,
                "items": [
                    {"product_id": p1["id"], "quantity": 2},
                    {"product_id": p2["id"], "quantity": 1}
                ]
            }
            order_res = client.post("/api/orders", json=order_payload, headers=customer_headers)
            assert order_res.status_code == 201, f"Order creation failed: {order_res.status_code} - {order_res.text}"
            order = order_res.json()
            order_id = order["id"]
            tracking_token = order["tracking_token"]
            assert order["total_price"] == expected_total, f"Expected total {expected_total}, got {order['total_price']}"
            assert order["status"] == "PENDING"
            assert tracking_token is not None and len(tracking_token) >= 20
            print(f"  ✓ Order #{order_id} created successfully!")
            print(f"    Calculated Total: ${order['total_price']:.2f}")
            print(f"    Tracking Token (Masked): {mask_token(tracking_token)}")

            # Step 4: Check idempotency deduplication
            print("\n[Step 4] Checking Idempotency Key Deduplication...")
            dup_res = client.post("/api/orders", json=order_payload, headers=customer_headers)
            assert dup_res.status_code in [200, 201], f"Idempotency retry failed: {dup_res.status_code}"
            assert dup_res.json()["id"] == order_id, "Expected same order ID on idempotent retry"
            print(f"  ✓ Repeated checkout with same idempotency key returned existing Order #{order_id}.")

            # Step 5: Customer tracks order by token
            print("\n[Step 5] Customer Public Tracking by Token...")
            track_res = client.get(f"/api/orders/track/{tracking_token}")
            assert track_res.status_code == 200, f"Tracking failed: {track_res.status_code}"
            assert track_res.json()["status"] == "PENDING"
            print(f"  ✓ Public tracking verified: Status is PENDING.")

            # Step 6: Security & RBAC boundary checks
            print("\n[Step 6] Security & RBAC Boundary Enforcement...")
            sec1 = client.get("/api/admin/statistics", headers=customer_headers)
            assert sec1.status_code == 403, f"Expected 403 Forbidden, got {sec1.status_code}"
            print("  ✓ Customer blocked from admin statistics (HTTP 403 Forbidden).")

            sec2 = client.patch(f"/api/orders/{order_id}/status", json={"status": "ACCEPTED"})
            assert sec2.status_code == 401, f"Expected 401 Unauthorized, got {sec2.status_code}"
            print("  ✓ Unauthenticated status progression blocked (HTTP 401 Unauthorized).")

            # Step 7: Staff login & kitchen workflow
            print("\n[Step 7] Staff Barista Login & POS Progression...")
            staff_login = client.post("/api/auth/login", json={"phone": "+7 (701) 333-4455", "password": "coyote2026"})
            assert staff_login.status_code == 200, f"Staff authentication failed (HTTP {staff_login.status_code}): {staff_login.text}"
            staff_data = staff_login.json()
            assert "access_token" in staff_data, "Staff login missing access_token"
            staff_token = staff_data["access_token"]
            staff_headers = {"Authorization": f"Bearer {staff_token}"}
            print(f"  ✓ Barista Sarah authenticated ({mask_phone(staff_data['user']['phone'])}). JWT issued.")

            res_acc = client.patch(f"/api/orders/{order_id}/status", json={"status": "ACCEPTED"}, headers=staff_headers)
            assert res_acc.status_code == 200 and res_acc.json()["status"] == "ACCEPTED"
            print("  ✓ Kitchen accepted order: ACCEPTED")

            res_prep = client.patch(f"/api/orders/{order_id}/status", json={"status": "PREPARING"}, headers=staff_headers)
            assert res_prep.status_code == 200 and res_prep.json()["status"] == "PREPARING"
            print("  ✓ Barista brewing & extracting: PREPARING")

            res_ready = client.patch(f"/api/orders/{order_id}/status", json={"status": "READY_FOR_PICKUP"}, headers=staff_headers)
            assert res_ready.status_code == 200 and res_ready.json()["status"] == "READY_FOR_PICKUP"
            print("  ✓ Thermal packaging sealed: READY_FOR_PICKUP")

            # Step 8: Staff assigns courier
            print("\n[Step 8] Staff Dispatches Courier via Dedicated Assignment Endpoint...")
            couriers = client.get("/api/couriers").json()
            c1 = couriers[0] # Damir S.
            c2 = couriers[1] # Aida M.
            assign_res = client.post(f"/api/orders/{order_id}/assign-courier", json={"courier_id": c1["id"]}, headers=staff_headers)
            assert assign_res.status_code == 200, f"Assignment failed: {assign_res.status_code}"
            assert assign_res.json()["courier_id"] == c1["id"]
            assert assign_res.json()["status"] == "COURIER_ASSIGNED"
            print(f"  ✓ Order #{order_id} assigned to '{c1['name']}' (Courier #{c1['id']}). Status: COURIER_ASSIGNED")

            # Step 9: Concurrency & Courier Security Guards
            print("\n[Step 9] Concurrency Conflict & Courier Impersonation Defense...")
            c1_login = client.post("/api/auth/login", json={"phone": "+7 (777) 123-4567", "password": "coyote2026"})
            assert c1_login.status_code == 200, f"Courier 1 authentication failed (HTTP {c1_login.status_code}): {c1_login.text}"
            c1_token = c1_login.json()["access_token"]
            c1_headers = {"Authorization": f"Bearer {c1_token}"}

            c2_login = client.post("/api/auth/login", json={"phone": "+7 (777) 987-6543", "password": "coyote2026"})
            assert c2_login.status_code == 200, f"Courier 2 authentication failed (HTTP {c2_login.status_code}): {c2_login.text}"
            c2_token = c2_login.json()["access_token"]
            c2_headers = {"Authorization": f"Bearer {c2_token}"}

            # Courier 2 attempts to accept already assigned order
            c2_conflict = client.post(f"/api/couriers/orders/{order_id}/accept", headers=c2_headers)
            assert c2_conflict.status_code == 409, f"Expected 409 Conflict, got {c2_conflict.status_code}"
            print(f"  ✓ Courier 2 accept conflict rejected: HTTP 409 ({c2_conflict.json()['detail']})")

            # Courier 2 attempts to pickup Courier 1's order
            c2_pickup = client.post(f"/api/couriers/orders/{order_id}/pickup", headers=c2_headers)
            assert c2_pickup.status_code == 403, f"Expected 403 Forbidden, got {c2_pickup.status_code}"
            print(f"  ✓ Courier 2 unauthorized pickup blocked: HTTP 403 ({c2_pickup.json()['detail']})")

            # Step 10: Courier 1 legitimate pickup
            print("\n[Step 10] Courier 1 Confirms Pickup at Coffee Shop...")
            c1_pickup = client.post(f"/api/couriers/orders/{order_id}/pickup", headers=c1_headers)
            assert c1_pickup.status_code == 200, f"Pickup failed: {c1_pickup.status_code}"
            assert c1_pickup.json()["status"] == "PICKED_UP"
            print(f"  ✓ Courier 1 confirmed pickup. Status is PICKED_UP.")

            # Step 11: Courier 2 attempts to confirm delivery
            c2_del = client.post(f"/api/couriers/orders/{order_id}/deliver", headers=c2_headers)
            assert c2_del.status_code == 403, f"Expected 403 Forbidden, got {c2_del.status_code}"
            print(f"  ✓ Courier 2 unauthorized delivery blocked: HTTP 403 ({c2_del.json()['detail']})")

            # Step 12: Courier 1 completes delivery
            print("\n[Step 11] Courier 1 Completes Hand-off to Customer...")
            c1_del = client.post(f"/api/couriers/orders/{order_id}/deliver", headers=c1_headers)
            assert c1_del.status_code == 200, f"Delivery completion failed: {c1_del.status_code}"
            assert c1_del.json()["status"] == "DELIVERED"
            print(f"  ✓ Courier 1 confirmed handoff. Status is DELIVERED.")

            # Step 13: Customer tracking reaches DELIVERED
            print("\n[Step 12] Customer Live Tracking Token Sync...")
            final_track = client.get(f"/api/orders/track/{tracking_token}")
            assert final_track.status_code == 200, f"Final tracking failed: {final_track.status_code}"
            assert final_track.json()["status"] == "DELIVERED"
            assert final_track.json()["courier"]["name"] == c1["name"]
            print(f"  ✓ Customer tracking reflects final status: DELIVERED by {c1['name']}.")

            # Step 14: Terminal state guard
            print("\n[Step 13] Verifying Terminal State Immutability...")
            term_res = client.patch(f"/api/orders/{order_id}/status", json={"status": "ACCEPTED"}, headers=staff_headers)
            assert term_res.status_code == 400, f"Expected 400, got {term_res.status_code}"
            print("  ✓ Terminal state immutable: DELIVERED order cannot be modified (HTTP 400).")

            # Step 15: Admin statistics & management
            print("\n[Step 14] Admin Role Verification & POS Statistics...")
            admin_login = client.post("/api/auth/login", json={"phone": "+7 (701) 555-6677", "password": "coyote2026"})
            assert admin_login.status_code == 200, f"Admin authentication failed (HTTP {admin_login.status_code}): {admin_login.text}"
            admin_token = admin_login.json()["access_token"]
            admin_headers = {"Authorization": f"Bearer {admin_token}"}
            stats = client.get("/api/admin/statistics", headers=admin_headers).json()
            assert stats["completed_orders"] >= 1, "Expected at least 1 completed order"
            assert stats["total_revenue"] > 0, "Expected non-zero total revenue"
            print("  ✓ Admin statistics verified (completed orders >= 1, total revenue > $0.00).")

            print("\n" + "=" * 75)
            print("ALL 14 END-TO-END CHECKS PASSED.")
            print("=" * 75)

        finally:
            # 1. Dispose engine connections to release any open SQLite locks
            if engine:
                try:
                    engine.dispose()
                except Exception as e:
                    print(f"[Cleanup Warning] Failed to dispose engine: {e}")

            # 2. Remove database file and any SQLite sidecar files (-wal, -shm, -journal)
            cleanup_errors = []
            for ext in ["", "-wal", "-shm", "-journal"]:
                sidecar_path = temp_db_path + ext
                if os.path.exists(sidecar_path):
                    try:
                        os.remove(sidecar_path)
                    except Exception as err:
                        cleanup_errors.append(f"{sidecar_path}: {err}")

            if cleanup_errors:
                print(f"[Cleanup Failure] Unable to remove SQLite files: {cleanup_errors}")
            else:
                print(f"[Cleanup] Isolated database and sidecar files safely removed: {temp_db_path}")

    # Verify directory removal
    if temp_dir_path and os.path.exists(temp_dir_path):
        remaining = os.listdir(temp_dir_path)
        print(f"[Cleanup Failure] Temporary directory '{temp_dir_path}' still exists! Remaining items: {remaining}")
    else:
        print("[Cleanup] Temporary directory successfully verified destroyed.")

if __name__ == "__main__":
    run_e2e_verification()
