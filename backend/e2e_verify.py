import urllib.request
import json
import time

BASE_URL = "http://127.0.0.1:8000/api"

def make_request(url, method="GET", data=None):
    req = urllib.request.Request(url, method=method)
    req.add_header("Content-Type", "application/json")
    body = json.dumps(data).encode("utf-8") if data else None
    try:
        with urllib.request.urlopen(req, data=body) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        try:
            return e.code, json.loads(error_body)
        except:
            return e.code, error_body

def run_acceptance_tests():
    print("=" * 60)
    print("RUNNING COMPLETE ACCEPTANCE TEST SUITE")
    print("=" * 60)

    # 1 & 2. Get products
    status, products = make_request(f"{BASE_URL}/products")
    assert status == 200, f"Expected 200, got {status}"
    assert len(products) >= 2, "Need at least 2 products"
    p1 = products[0]
    p2 = products[1]
    print(f"✓ Products fetched: Selected '{p1['name']}' (${p1['price']}) and '{p2['name']}' (${p2['price']})")

    # 3, 4, 5. Place order with 2 products
    order_payload = {
        "customer_name": "Hackathon Judge",
        "customer_phone": "+7 (777) 999-0011",
        "delivery_address": "Dostyk Plaza, Block B, Office 301",
        "delivery_instructions": "Deliver to front desk reception",
        "items": [
            {"product_id": p1["id"], "quantity": 2},
            {"product_id": p2["id"], "quantity": 1}
        ]
    }
    status, new_order = make_request(f"{BASE_URL}/orders", method="POST", data=order_payload)
    assert status == 201, f"Expected 201, got {status}: {new_order}"
    order_id = new_order["id"]
    expected_total = round(p1["price"] * 2 + p2["price"] * 1, 2)
    assert new_order["total_price"] == expected_total
    assert new_order["status"] == "PENDING"
    print(f"✓ Step 1-6: Order #{order_id} created successfully. Total: ${new_order['total_price']}. Status: {new_order['status']}")

    # 7 & 8. Find order in coffee shop dashboard
    status, admin_orders = make_request(f"{BASE_URL}/admin/orders")
    assert status == 200
    matched = next((o for o in admin_orders if o["id"] == order_id), None)
    assert matched is not None, "Created order not in coffee shop orders list"
    print(f"✓ Step 7-8: Order #{order_id} received on Coffee Shop POS Dashboard")

    # 9. Accept order
    status, updated_order = make_request(f"{BASE_URL}/orders/{order_id}/status", method="PATCH", data={"status": "ACCEPTED"})
    assert status == 200
    assert updated_order["status"] == "ACCEPTED"
    print(f"✓ Step 9: Coffee shop accepted order. Status: {updated_order['status']}")

    # 10. Mark PREPARING
    status, updated_order = make_request(f"{BASE_URL}/orders/{order_id}/status", method="PATCH", data={"status": "PREPARING"})
    assert status == 200
    assert updated_order["status"] == "PREPARING"
    print(f"✓ Step 10: Kitchen preparing order. Status: {updated_order['status']}")

    # 11. Mark READY_FOR_PICKUP
    status, updated_order = make_request(f"{BASE_URL}/orders/{order_id}/status", method="PATCH", data={"status": "READY_FOR_PICKUP"})
    assert status == 200
    assert updated_order["status"] == "READY_FOR_PICKUP"
    print(f"✓ Step 11: Barista marked ready for pickup. Status: {updated_order['status']}")

    # 12 & 13. Courier accept delivery
    status, couriers = make_request(f"{BASE_URL}/couriers")
    assert status == 200 and len(couriers) > 0
    courier_id = couriers[0]["id"]
    courier_name = couriers[0]["name"]

    status, courier_order = make_request(f"{BASE_URL}/couriers/orders/{order_id}/accept", method="POST", data={"courier_id": courier_id})
    assert status == 200
    assert courier_order["status"] == "COURIER_ASSIGNED"
    assert courier_order["courier_id"] == courier_id
    print(f"✓ Step 12-13: Courier '{courier_name}' accepted delivery. Status: {courier_order['status']}")

    # 14. Mark PICKED_UP
    status, courier_order = make_request(f"{BASE_URL}/couriers/orders/{order_id}/pickup", method="POST", data={"courier_id": courier_id})
    assert status == 200
    assert courier_order["status"] == "PICKED_UP"
    print(f"✓ Step 14: Courier picked up order from shop. Status: {courier_order['status']}")

    # 15. Mark DELIVERED
    status, courier_order = make_request(f"{BASE_URL}/couriers/orders/{order_id}/deliver", method="POST", data={"courier_id": courier_id})
    assert status == 200
    assert courier_order["status"] == "DELIVERED"
    print(f"✓ Step 15: Courier delivered order to customer. Status: {courier_order['status']}")

    # 16 & 17. Return to customer tracking page & verify final status DELIVERED
    status, final_order = make_request(f"{BASE_URL}/orders/{order_id}")
    assert status == 200
    assert final_order["status"] == "DELIVERED"
    print(f"✓ Step 16-17: Customer tracking page confirms final status is DELIVERED!")

    # EDGE CASES & VALIDATIONS
    print("\n" + "-" * 40)
    print("TESTING EDGE CASES & VALIDATION CONSTRAINTS")
    print("-" * 40)

    # Edge Case 1: Empty cart
    status, res = make_request(f"{BASE_URL}/orders", method="POST", data={
        "customer_name": "Test",
        "customer_phone": "123456",
        "delivery_address": "Test Street",
        "items": []
    })
    assert status in [400, 422], f"Expected error for empty cart, got {status}"
    print(f"✓ Edge Case 1: Empty cart rejected (HTTP {status})")

    # Edge Case 2: Invalid status transition (cannot go from DELIVERED to PREPARING)
    status, res = make_request(f"{BASE_URL}/orders/{order_id}/status", method="PATCH", data={"status": "PREPARING"})
    assert status == 400, f"Expected 400 for invalid transition, got {status}"
    print(f"✓ Edge Case 2: Invalid transition DELIVERED -> PREPARING correctly rejected with 400: {res.get('detail')}")

    # Edge Case 3: Invalid order ID
    status, res = make_request(f"{BASE_URL}/orders/99999999")
    assert status == 404, f"Expected 404 for invalid order, got {status}"
    print(f"✓ Edge Case 3: Non-existent order ID returned 404")

    # Edge Case 4: Admin statistics accurate
    status, stats = make_request(f"{BASE_URL}/admin/statistics")
    assert status == 200
    assert stats["completed_orders"] >= 1
    assert stats["total_revenue"] >= expected_total
    print(f"✓ Edge Case 4: Admin stats accurate. Revenue: ${stats['total_revenue']:.2f}")

    print("\n" + "=" * 60)
    print("ALL 17 ACCEPTANCE TEST STEPS & EDGE CASES PASSED WITH 100% SUCCESS!")
    print("=" * 60)

if __name__ == "__main__":
    run_acceptance_tests()
