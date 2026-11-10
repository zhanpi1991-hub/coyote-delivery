import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_workflow():
    print("=" * 65)
    print("RUNNING COYOTE DELIVERY API WORKFLOW TEST")
    print("=" * 65)

    print("1. Authenticating test users...")
    # Staff token
    staff_login = client.post("/api/auth/login", json={"phone": "+7 (701) 333-4455", "password": "coyote2026"})
    assert staff_login.status_code == 200
    staff_token = staff_login.json()["access_token"]
    staff_headers = {"Authorization": f"Bearer {staff_token}"}

    # Courier token
    courier_login = client.post("/api/auth/login", json={"phone": "+7 (777) 123-4567", "password": "coyote2026"})
    assert courier_login.status_code == 200
    courier_token = courier_login.json()["access_token"]
    courier_headers = {"Authorization": f"Bearer {courier_token}"}
    courier_id = courier_login.json()["user"]["courier_id"]

    print("2. Testing GET /api/products...")
    res = client.get("/api/products")
    assert res.status_code == 200
    products = res.json()
    assert len(products) >= 10
    print(f"   Success! Found {len(products)} products.")

    p1 = products[0]
    p2 = products[1]

    print("3. Testing POST /api/orders (Customer placing order)...")
    order_payload = {
        "customer_name": "Test Customer",
        "customer_phone": "+7 700 111 2233",
        "delivery_address": "Test Street 100, Apt 5",
        "delivery_instructions": "Ring twice",
        "idempotency_key": "test-order-" + os.urandom(6).hex(),
        "items": [
            {"product_id": p1["id"], "quantity": 2},
            {"product_id": p2["id"], "quantity": 1}
        ]
    }
    res = client.post("/api/orders", json=order_payload)
    assert res.status_code == 201, res.text
    order = res.json()
    order_id = order["id"]
    tracking_token = order["tracking_token"]
    expected_total = round(p1["price"] * 2 + p2["price"] * 1, 2)
    assert order["total_price"] == expected_total
    assert order["status"] == "PENDING"
    assert tracking_token is not None
    print(f"   Success! Order #{order_id} created with total ${order['total_price']:.2f}")

    print("4. Testing unauthenticated status change (should be rejected)...")
    unauth_patch = client.patch(f"/api/orders/{order_id}/status", json={"status": "ACCEPTED"})
    assert unauth_patch.status_code == 401
    print("   Success! Unauthenticated status change blocked (HTTP 401).")

    print("5. Testing invalid transition (PENDING -> DELIVERED directly)...")
    res = client.patch(f"/api/orders/{order_id}/status", json={"status": "DELIVERED"}, headers=staff_headers)
    assert res.status_code == 400
    print("   Success! Invalid transition was correctly rejected.")

    print("6. Testing Coffee shop workflow: PENDING -> ACCEPTED -> PREPARING -> READY_FOR_PICKUP...")
    res = client.patch(f"/api/orders/{order_id}/status", json={"status": "ACCEPTED"}, headers=staff_headers)
    assert res.status_code == 200
    assert res.json()["status"] == "ACCEPTED"

    res = client.patch(f"/api/orders/{order_id}/status", json={"status": "PREPARING"}, headers=staff_headers)
    assert res.status_code == 200
    assert res.json()["status"] == "PREPARING"

    res = client.patch(f"/api/orders/{order_id}/status", json={"status": "READY_FOR_PICKUP"}, headers=staff_headers)
    assert res.status_code == 200
    assert res.json()["status"] == "READY_FOR_PICKUP"
    print("   Success! Coffee shop status transitions verified.")

    print("7. Testing Courier workflow: accept -> pickup -> deliver...")
    res = client.post(f"/api/couriers/orders/{order_id}/accept", headers=courier_headers)
    assert res.status_code == 200
    assert res.json()["status"] == "COURIER_ASSIGNED"
    assert res.json()["courier_id"] == courier_id

    res = client.post(f"/api/couriers/orders/{order_id}/pickup", headers=courier_headers)
    assert res.status_code == 200
    assert res.json()["status"] == "PICKED_UP"

    res = client.post(f"/api/couriers/orders/{order_id}/deliver", headers=courier_headers)
    assert res.status_code == 200
    assert res.json()["status"] == "DELIVERED"
    print("   Success! Courier delivery complete, order DELIVERED.")

    print("8. Testing Public Order Tracking by Token...")
    track_res = client.get(f"/api/orders/track/{tracking_token}")
    assert track_res.status_code == 200
    assert track_res.json()["status"] == "DELIVERED"
    print(f"   Success! Customer tracked final status DELIVERED via tracking token.")

    print("9. Testing Statistics API...")
    res = client.get("/api/admin/statistics", headers=staff_headers)
    assert res.status_code == 200
    stats = res.json()
    assert stats["completed_orders"] >= 1
    assert stats["total_revenue"] > 0
    print(f"   Success! Stats: {stats}")

    print("\n" + "=" * 65)
    print("ALL BACKEND API ACCEPTANCE CRITERIA PASSED!")
    print("=" * 65)

if __name__ == "__main__":
    test_workflow()
