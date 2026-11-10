import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_auth_and_security():
    print("=" * 65)
    print("TESTING COYOTE DELIVERY 1.1 AUTHENTICATION & SECURITY")
    print("=" * 65)

    # 1. Test public registration only creates customer accounts
    print("\n1. Testing customer registration...")
    reg_payload = {
        "name": "Sec Customer",
        "phone": "+7 701 999 0011",
        "password": "customer_secure_pass123"
    }
    res = client.post("/api/auth/register", json=reg_payload)
    if res.status_code == 400 and "already registered" in res.text:
        # User already exists from previous run, login instead
        login_res = client.post("/api/auth/login", json={"phone": reg_payload["phone"], "password": reg_payload["password"]})
        assert login_res.status_code == 200
        customer_token = login_res.json()["access_token"]
        customer_data = login_res.json()["user"]
    else:
        assert res.status_code == 201, res.text
        data = res.json()
        assert "access_token" in data
        assert data["user"]["role"] == "customer"
        customer_token = data["access_token"]
        customer_data = data["user"]
    print(f"✓ Customer registered with forced role '{customer_data['role']}'. JWT token issued.")

    # 2. Test duplicate registration rejection
    print("\n2. Testing duplicate registration rejection...")
    dup_res = client.post("/api/auth/register", json=reg_payload)
    assert dup_res.status_code == 400
    print("✓ Duplicate phone registration correctly rejected (HTTP 400).")

    # 3. Test login with wrong password
    print("\n3. Testing invalid credentials rejection...")
    bad_login = client.post("/api/auth/login", json={"phone": reg_payload["phone"], "password": "wrong_password"})
    assert bad_login.status_code == 401
    print("✓ Incorrect password rejected (HTTP 401).")

    # 4. Test staff and admin login
    print("\n4. Testing staff and admin authentication...")
    staff_login = client.post("/api/auth/login", json={"phone": "+7 (701) 333-4455", "password": "coyote2026"})
    assert staff_login.status_code == 200
    staff_token = staff_login.json()["access_token"]
    assert staff_login.json()["user"]["role"] == "staff"
    print("✓ Staff authenticated successfully. Role: staff")

    admin_login = client.post("/api/auth/login", json={"phone": "+7 (701) 555-6677", "password": "coyote2026"})
    assert admin_login.status_code == 200
    admin_token = admin_login.json()["access_token"]
    assert admin_login.json()["user"]["role"] == "admin"
    print("✓ Admin authenticated successfully. Role: admin")

    # 5. Test courier login
    print("\n5. Testing courier authentication...")
    courier_login = client.post("/api/auth/login", json={"phone": "+7 (777) 123-4567", "password": "coyote2026"})
    assert courier_login.status_code == 200
    courier_token = courier_login.json()["access_token"]
    assert courier_login.json()["user"]["role"] == "courier"
    assert courier_login.json()["user"]["courier_id"] is not None
    print(f"✓ Courier authenticated successfully. Linked Courier ID: {courier_login.json()['user']['courier_id']}")

    # 6. Test RBAC permissions: Customer attempting to view admin statistics
    print("\n6. Testing RBAC restrictions...")
    cust_headers = {"Authorization": f"Bearer {customer_token}"}
    unauthorized_res = client.get("/api/admin/statistics", headers=cust_headers)
    assert unauthorized_res.status_code == 403, f"Expected 403, got {unauthorized_res.status_code}"
    print(f"✓ Customer blocked from admin statistics (HTTP 403 Forbidden).")

    # Staff accessing admin statistics
    staff_headers = {"Authorization": f"Bearer {staff_token}"}
    staff_stats = client.get("/api/admin/statistics", headers=staff_headers)
    assert staff_stats.status_code == 200
    print(f"✓ Staff permitted to view statistics (HTTP 200 OK).")

    # 7. Test Server-Side Pricing (client sends no price, server computes from DB)
    print("\n7. Testing server-side pricing integrity...")
    prods = client.get("/api/products").json()
    prod_a = prods[0]
    prod_b = prods[1]
    expected_total = round(prod_a["price"] * 2 + prod_b["price"] * 3, 2)

    order_payload = {
        "customer_name": "Tamper Test User",
        "customer_phone": "+7 701 999 0011",
        "delivery_address": "Security Street 1",
        "idempotency_key": "sec-test-" + os.urandom(8).hex(),
        "items": [
            {"product_id": prod_a["id"], "quantity": 2},
            {"product_id": prod_b["id"], "quantity": 3}
        ]
    }
    order_res = client.post("/api/orders", json=order_payload, headers=cust_headers)
    assert order_res.status_code == 201
    created_order = order_res.json()
    assert created_order["total_price"] == expected_total
    assert created_order["tracking_token"] is not None
    print(f"✓ Total calculated server-side (${created_order['total_price']:.2f}). Tracking token generated.")

    # 8. Test Idempotency Key
    print("\n8. Testing idempotency key deduplication...")
    dup_order_res = client.post("/api/orders", json=order_payload, headers=cust_headers)
    assert dup_order_res.status_code in [200, 201]
    assert dup_order_res.json()["id"] == created_order["id"]
    print(f"✓ Repeated request with idempotency key returned existing Order #{created_order['id']}.")

    # 9. Test Secure Public Tracking by Token
    print("\n9. Testing public tracking token endpoint...")
    token = created_order["tracking_token"]
    track_res = client.get(f"/api/orders/track/{token}")
    assert track_res.status_code == 200
    track_data = track_res.json()
    # OrderTrackResponse omits 'id' by design (privacy) — verify via tracking_token and status
    assert track_data["tracking_token"] == token
    assert track_data["status"] == "PENDING"
    # Verify no PII fields are exposed
    assert "customer_phone" not in track_data
    assert "delivery_address" not in track_data
    assert "customer_name" not in track_data
    print(f"✓ Order tracked securely via token '{token[:12]}...'. No PII exposed in response.")

    # Invalid token check
    invalid_track = client.get("/api/orders/track/invalid-fake-token-12345")
    assert invalid_track.status_code == 404
    print("✓ Invalid tracking token correctly returned HTTP 404.")

    print("\n" + "=" * 65)
    print("ALL AUTH & SECURITY TESTS PASSED! (9/9)")
    print("=" * 65)

if __name__ == "__main__":
    test_auth_and_security()
