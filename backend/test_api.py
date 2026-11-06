import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_workflow():
    print("1. Testing GET /api/products...")
    res = client.get("/api/products")
    assert res.status_code == 200
    products = res.json()
    assert len(products) >= 10
    print(f"   Success! Found {len(products)} products.")

    p1 = products[0]
    p2 = products[1]

    print("2. Testing POST /api/orders (Customer placing order)...")
    order_payload = {
        "customer_name": "Test Customer",
        "customer_phone": "+7 700 111 2233",
        "delivery_address": "Test Street 100, Apt 5",
        "delivery_instructions": "Ring twice",
        "items": [
            {"product_id": p1["id"], "quantity": 2},
            {"product_id": p2["id"], "quantity": 1}
        ]
    }
    res = client.post("/api/orders", json=order_payload)
    assert res.status_code == 201, res.text
    order = res.json()
    order_id = order["id"]
    expected_total = round(p1["price"] * 2 + p2["price"] * 1, 2)
    assert order["total_price"] == expected_total
    assert order["status"] == "PENDING"
    print(f"   Success! Order #{order_id} created with total ${order['total_price']:.2f}")

    print("3. Testing invalid transition (PENDING -> DELIVERED directly)...")
    res = client.patch(f"/api/orders/{order_id}/status", json={"status": "DELIVERED"})
    assert res.status_code == 400
    print("   Success! Invalid transition was correctly rejected.")

    print("4. Testing Coffee shop workflow: PENDING -> ACCEPTED -> PREPARING -> READY_FOR_PICKUP...")
    res = client.patch(f"/api/orders/{order_id}/status", json={"status": "ACCEPTED"})
    assert res.status_code == 200
    assert res.json()["status"] == "ACCEPTED"

    res = client.patch(f"/api/orders/{order_id}/status", json={"status": "PREPARING"})
    assert res.status_code == 200
    assert res.json()["status"] == "PREPARING"

    res = client.patch(f"/api/orders/{order_id}/status", json={"status": "READY_FOR_PICKUP"})
    assert res.status_code == 200
    assert res.json()["status"] == "READY_FOR_PICKUP"
    print("   Success! Coffee shop status transitions verified.")

    print("5. Testing Courier workflow: accept -> pickup -> deliver...")
    res = client.get("/api/couriers")
    assert res.status_code == 200
    couriers = res.json()
    courier_id = couriers[0]["id"]

    res = client.post(f"/api/couriers/orders/{order_id}/accept", json={"courier_id": courier_id})
    assert res.status_code == 200
    assert res.json()["status"] == "COURIER_ASSIGNED"
    assert res.json()["courier_id"] == courier_id

    res = client.post(f"/api/couriers/orders/{order_id}/pickup", json={"courier_id": courier_id})
    assert res.status_code == 200
    assert res.json()["status"] == "PICKED_UP"

    res = client.post(f"/api/couriers/orders/{order_id}/deliver", json={"courier_id": courier_id})
    assert res.status_code == 200
    assert res.json()["status"] == "DELIVERED"
    print("   Success! Courier delivery complete, order DELIVERED.")

    print("6. Testing Statistics API...")
    res = client.get("/api/admin/statistics")
    assert res.status_code == 200
    stats = res.json()
    assert stats["completed_orders"] >= 1
    assert stats["total_revenue"] > 0
    print(f"   Success! Stats: {stats}")

    print("\nALL BACKEND ACCEPTANCE CRITERIA PASSED!")

if __name__ == "__main__":
    test_workflow()
