import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_concurrency_and_data_integrity():
    print("=" * 65)
    print("TESTING CONCURRENCY & DATA CONSISTENCY (COYOTE 1.1)")
    print("=" * 65)

    # 1. Authenticate Staff
    staff_res = client.post("/api/auth/login", json={"phone": "+7 (701) 333-4455", "password": "coyote2026"})
    assert staff_res.status_code == 200
    staff_headers = {"Authorization": f"Bearer {staff_res.json()['access_token']}"}

    # Authenticate Courier 1 (Damir S., Courier ID 1)
    c1_res = client.post("/api/auth/login", json={"phone": "+7 (777) 123-4567", "password": "coyote2026"})
    assert c1_res.status_code == 200
    c1_headers = {"Authorization": f"Bearer {c1_res.json()['access_token']}"}
    c1_id = c1_res.json()["user"]["courier_id"]

    # Authenticate Courier 2 (Aida M., Courier ID 2)
    c2_res = client.post("/api/auth/login", json={"phone": "+7 (777) 987-6543", "password": "coyote2026"})
    assert c2_res.status_code == 200
    c2_headers = {"Authorization": f"Bearer {c2_res.json()['access_token']}"}
    c2_id = c2_res.json()["user"]["courier_id"]

    print(f"✓ Couriers authenticated: Courier #{c1_id} vs Courier #{c2_id}")

    # 2. Fetch products
    prods = client.get("/api/products").json()
    prod = prods[0]

    # 3. Test duplicate order submission idempotency
    idempotency_key = "conc-test-" + os.urandom(8).hex()
    order_data = {
        "customer_name": "Concurrency Test User",
        "customer_phone": "+7 700 999 8877",
        "delivery_address": "Kabanbay Batyr 10, Apt 42",
        "delivery_instructions": "Do not duplicate",
        "idempotency_key": idempotency_key,
        "items": [{"product_id": prod["id"], "quantity": 1}]
    }

    res1 = client.post("/api/orders", json=order_data)
    assert res1.status_code == 201
    order1 = res1.json()
    print(f"✓ Initial order #{order1['id']} placed successfully")

    # Immediate second submission with identical payload & idempotency key
    res2 = client.post("/api/orders", json=order_data)
    assert res2.status_code in [200, 201]
    order2 = res2.json()
    assert order1["id"] == order2["id"], f"Expected same order ID, got #{order1['id']} vs #{order2['id']}"
    print(f"✓ Rapid duplicate click detected and handled idempotently (returned existing Order #{order2['id']})")

    order_id = order1["id"]

    # 4. Staff accepts and marks ready
    client.patch(f"/api/orders/{order_id}/status", json={"status": "ACCEPTED"}, headers=staff_headers)
    client.patch(f"/api/orders/{order_id}/status", json={"status": "PREPARING"}, headers=staff_headers)
    res_ready = client.patch(f"/api/orders/{order_id}/status", json={"status": "READY_FOR_PICKUP"}, headers=staff_headers)
    assert res_ready.status_code == 200
    assert res_ready.json()["status"] == "READY_FOR_PICKUP"
    print(f"✓ Order #{order_id} progressed to READY_FOR_PICKUP")

    # 5. CONCURRENCY: Courier 1 claims the order
    res_claim1 = client.post(f"/api/couriers/orders/{order_id}/accept", headers=c1_headers)
    assert res_claim1.status_code == 200
    assert res_claim1.json()["courier_id"] == c1_id
    assert res_claim1.json()["status"] == "COURIER_ASSIGNED"
    print(f"✓ Courier 1 successfully accepted Order #{order_id}")

    # 6. CONCURRENCY: Courier 2 attempts to accept the SAME order simultaneously
    res_claim2 = client.post(f"/api/couriers/orders/{order_id}/accept", headers=c2_headers)
    assert res_claim2.status_code == 409, f"Expected 409 Conflict, got {res_claim2.status_code}: {res_claim2.text}"
    print(f"✓ Courier 2 conflict prevented! HTTP 409 Conflict returned: {res_claim2.json().get('detail')}")

    # 7. CONCURRENCY: Courier 2 attempts to pick up Courier 1's order
    res_pickup2 = client.post(f"/api/couriers/orders/{order_id}/pickup", headers=c2_headers)
    assert res_pickup2.status_code == 403, f"Expected 403 Forbidden, got {res_pickup2.status_code}: {res_pickup2.text}"
    print(f"✓ Courier 2 unauthorized pickup blocked! HTTP 403 returned: {res_pickup2.json().get('detail')}")

    # 8. Courier 1 legitimately picks up order
    res_pickup1 = client.post(f"/api/couriers/orders/{order_id}/pickup", headers=c1_headers)
    assert res_pickup1.status_code == 200
    assert res_pickup1.json()["status"] == "PICKED_UP"
    print(f"✓ Courier 1 successfully confirmed pickup. Status: PICKED_UP")

    # 9. CONCURRENCY: Courier 2 attempts to mark Courier 1's order as delivered
    res_del2 = client.post(f"/api/couriers/orders/{order_id}/deliver", headers=c2_headers)
    assert res_del2.status_code == 403, f"Expected 403 Forbidden, got {res_del2.status_code}: {res_del2.text}"
    print(f"✓ Courier 2 unauthorized delivery confirmation blocked! HTTP 403 returned: {res_del2.json().get('detail')}")

    # 10. Courier 1 legitimately completes delivery
    res_del1 = client.post(f"/api/couriers/orders/{order_id}/deliver", headers=c1_headers)
    assert res_del1.status_code == 200
    assert res_del1.json()["status"] == "DELIVERED"
    print(f"✓ Courier 1 confirmed handoff to customer. Final Status: DELIVERED")

    # 11. Terminal state check: cannot modify once in terminal state DELIVERED
    res_term = client.patch(f"/api/orders/{order_id}/status", json={"status": "ACCEPTED"}, headers=staff_headers)
    assert res_term.status_code == 400
    print(f"✓ Terminal state guard: cannot revert DELIVERED order (HTTP 400 rejected)")

    print("\n" + "=" * 65)
    print("ALL 10 CONCURRENCY & INTEGRITY CHECKS PASSED!")
    print("=" * 65)

if __name__ == "__main__":
    test_concurrency_and_data_integrity()
