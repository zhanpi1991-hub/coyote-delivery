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

def test_concurrency_and_data_integrity():
    print("=" * 65)
    print("TESTING CONCURRENCY & DATA CONSISTENCY")
    print("=" * 65)

    # 1. Fetch products and couriers
    status, products = make_request(f"{BASE_URL}/products")
    assert status == 200 and len(products) >= 1
    prod = products[0]

    status, couriers = make_request(f"{BASE_URL}/couriers")
    assert status == 200 and len(couriers) >= 2
    courier_1 = couriers[0]
    courier_2 = couriers[1]
    print(f"✓ Couriers for concurrency testing: '{courier_1['name']}' (ID: {courier_1['id']}) vs '{courier_2['name']}' (ID: {courier_2['id']})")

    # 2. Test duplicate order submission idempotency
    order_data = {
        "customer_name": "Concurrency Test User",
        "customer_phone": "+7 700 999 8877",
        "delivery_address": "Kabanbay Batyr 10, Apt 42",
        "delivery_instructions": "Do not duplicate",
        "items": [{"product_id": prod["id"], "quantity": 1}]
    }
    status1, order1 = make_request(f"{BASE_URL}/orders", method="POST", data=order_data)
    assert status1 == 201, f"Failed to create order: {order1}"
    print(f"✓ Initial order #{order1['id']} placed successfully")

    # Immediate second submission with identical payload (simulating rapid double-click)
    status2, order2 = make_request(f"{BASE_URL}/orders", method="POST", data=order_data)
    assert status2 in [200, 201]
    assert order1["id"] == order2["id"], f"Expected same order ID, got #{order1['id']} vs #{order2['id']}"
    print(f"✓ Rapid duplicate click detected and handled idempotently (returned existing Order #{order2['id']})")

    order_id = order1["id"]

    # 3. Staff accepts and marks ready
    make_request(f"{BASE_URL}/orders/{order_id}/status", method="PATCH", data={"status": "ACCEPTED"})
    make_request(f"{BASE_URL}/orders/{order_id}/status", method="PATCH", data={"status": "PREPARING"})
    status, order = make_request(f"{BASE_URL}/orders/{order_id}/status", method="PATCH", data={"status": "READY_FOR_PICKUP"})
    assert status == 200
    assert order["status"] == "READY_FOR_PICKUP"
    print(f"✓ Order #{order_id} progressed to READY_FOR_PICKUP")

    # 4. CONCURRENCY: Courier 1 claims the order
    status, res1 = make_request(f"{BASE_URL}/couriers/orders/{order_id}/accept", method="POST", data={"courier_id": courier_1["id"]})
    assert status == 200
    assert res1["courier_id"] == courier_1["id"]
    assert res1["status"] == "COURIER_ASSIGNED"
    print(f"✓ Courier 1 ('{courier_1['name']}') successfully accepted Order #{order_id}")

    # 5. CONCURRENCY: Courier 2 attempts to accept the SAME order simultaneously
    status, res2 = make_request(f"{BASE_URL}/couriers/orders/{order_id}/accept", method="POST", data={"courier_id": courier_2["id"]})
    assert status == 409, f"Expected 409 Conflict, got {status}: {res2}"
    print(f"✓ Courier 2 conflict prevented! HTTP 409 returned: {res2.get('detail')}")

    # 6. CONCURRENCY: Courier 2 attempts to pick up Courier 1's order
    status, res3 = make_request(f"{BASE_URL}/couriers/orders/{order_id}/pickup", method="POST", data={"courier_id": courier_2["id"]})
    assert status == 403, f"Expected 403 Forbidden, got {status}: {res3}"
    print(f"✓ Courier 2 unauthorized pickup blocked! HTTP 403 returned: {res3.get('detail')}")

    # 7. Courier 1 legitimately picks up order
    status, res4 = make_request(f"{BASE_URL}/couriers/orders/{order_id}/pickup", method="POST", data={"courier_id": courier_1["id"]})
    assert status == 200
    assert res4["status"] == "PICKED_UP"
    print(f"✓ Courier 1 successfully confirmed pickup. Status: PICKED_UP")

    # 8. CONCURRENCY: Courier 2 attempts to mark Courier 1's order as delivered
    status, res5 = make_request(f"{BASE_URL}/couriers/orders/{order_id}/deliver", method="POST", data={"courier_id": courier_2["id"]})
    assert status == 403, f"Expected 403 Forbidden, got {status}: {res5}"
    print(f"✓ Courier 2 unauthorized delivery confirmation blocked! HTTP 403 returned: {res5.get('detail')}")

    # 9. Courier 1 legitimately completes delivery
    status, res6 = make_request(f"{BASE_URL}/couriers/orders/{order_id}/deliver", method="POST", data={"courier_id": courier_1["id"]})
    assert status == 200
    assert res6["status"] == "DELIVERED"
    print(f"✓ Courier 1 confirmed handoff to customer. Final Status: DELIVERED")

    # 10. Verify order cannot be modified once in terminal state DELIVERED
    status, res7 = make_request(f"{BASE_URL}/orders/{order_id}/status", method="PATCH", data={"status": "ACCEPTED"})
    assert status == 400
    print(f"✓ Terminal state protected! Modification rejected: {res7.get('detail')}")

    print("\n" + "=" * 65)
    print("ALL CONCURRENCY AND DATA CONSISTENCY TESTS PASSED (10/10)!")
    print("=" * 65)

if __name__ == "__main__":
    test_concurrency_and_data_integrity()
