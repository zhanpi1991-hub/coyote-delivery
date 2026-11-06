import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException
from typing import List, Optional
from .models import Product, Order, OrderItem, Courier
from .schemas import OrderCreate, OrderStatusUpdate

# Allowed order status transitions
VALID_TRANSITIONS = {
    "PENDING": ["ACCEPTED", "REJECTED"],
    "ACCEPTED": ["PREPARING", "REJECTED", "COURIER_ASSIGNED"],
    "PREPARING": ["READY_FOR_PICKUP", "COURIER_ASSIGNED"],
    "READY_FOR_PICKUP": ["COURIER_ASSIGNED", "PICKED_UP"],
    "COURIER_ASSIGNED": ["PICKED_UP", "READY_FOR_PICKUP"],
    "PICKED_UP": ["DELIVERED"],
    "DELIVERED": [],
    "REJECTED": []
}

def get_products(db: Session, category: Optional[str] = None):
    query = db.query(Product)
    if category and category.lower() != "all":
        query = query.filter(Product.category == category)
    return query.all()

def get_product(db: Session, product_id: int):
    return db.query(Product).filter(Product.id == product_id).first()

def get_couriers(db: Session):
    return db.query(Courier).all()

def get_courier(db: Session, courier_id: int):
    return db.query(Courier).filter(Courier.id == courier_id).first()

def create_order(db: Session, order_in: OrderCreate) -> Order:
    # Validate items and calculate total securely from DB
    if not order_in.items:
        raise HTTPException(status_code=400, detail="Order must contain at least one item")

    # Idempotency check: prevent duplicate rapid double-clicks (within 3 seconds)
    recent_cutoff = datetime.datetime.utcnow() - datetime.timedelta(seconds=3)
    existing_recent = db.query(Order).filter(
        Order.customer_name == order_in.customer_name.strip(),
        Order.customer_phone == order_in.customer_phone.strip(),
        Order.delivery_address == order_in.delivery_address.strip(),
        Order.created_at >= recent_cutoff
    ).first()
    if existing_recent:
        return existing_recent

    total_price = 0.0
    order_items_to_create = []

    for item_in in order_in.items:
        product = db.query(Product).filter(Product.id == item_in.product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product with id {item_in.product_id} not found")
        if not product.available:
            raise HTTPException(status_code=400, detail=f"Product '{product.name}' is currently unavailable")

        item_total = round(product.price * item_in.quantity, 2)
        total_price += item_total

        order_items_to_create.append({
            "product_id": product.id,
            "product_name": product.name,
            "quantity": item_in.quantity,
            "unit_price": product.price
        })

    # Create Order
    new_order = Order(
        customer_name=order_in.customer_name.strip(),
        customer_phone=order_in.customer_phone.strip(),
        delivery_address=order_in.delivery_address.strip(),
        delivery_instructions=order_in.delivery_instructions.strip() if order_in.delivery_instructions else None,
        status="PENDING",
        total_price=round(total_price, 2)
    )
    db.add(new_order)
    db.flush()  # get new_order.id

    for item_data in order_items_to_create:
        order_item = OrderItem(
            order_id=new_order.id,
            product_id=item_data["product_id"],
            product_name=item_data["product_name"],
            quantity=item_data["quantity"],
            unit_price=item_data["unit_price"]
        )
        db.add(order_item)

    db.commit()
    db.refresh(new_order)
    return new_order

def get_order(db: Session, order_id: int) -> Optional[Order]:
    return db.query(Order).filter(Order.id == order_id).first()

def get_orders(db: Session, status: Optional[str] = None):
    query = db.query(Order).order_by(Order.created_at.desc())
    if status and status.upper() != "ALL":
        query = query.filter(Order.status == status.upper())
    return query.all()

def update_order_status(db: Session, order_id: int, status_update: OrderStatusUpdate) -> Order:
    order = get_order(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    new_status = status_update.status.upper()
    current_status = order.status

    if new_status != current_status:
        allowed_next = VALID_TRANSITIONS.get(current_status, [])
        if new_status not in allowed_next:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status transition from {current_status} to {new_status}. Allowed next states: {', '.join(allowed_next) if allowed_next else 'None (Terminal state)'}"
            )
        order.status = new_status

    if status_update.courier_id is not None:
        courier = get_courier(db, status_update.courier_id)
        if not courier:
            raise HTTPException(status_code=404, detail="Courier not found")
        order.courier_id = courier.id

    db.commit()
    db.refresh(order)
    return order

def courier_accept_order(db: Session, order_id: int, courier_id: int) -> Order:
    order = get_order(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    courier = get_courier(db, courier_id)
    if not courier:
        raise HTTPException(status_code=404, detail="Courier not found")

    # Concurrency guard: check if already claimed by another courier
    if order.courier_id is not None and order.courier_id != courier_id:
        assigned_name = order.courier.name if order.courier else f"Courier #{order.courier_id}"
        raise HTTPException(
            status_code=409,
            detail=f"Conflict: Order #{order_id} has already been accepted by {assigned_name}."
        )

    # Courier can accept order if it is ACCEPTED, PREPARING, or READY_FOR_PICKUP
    if order.status not in ["ACCEPTED", "PREPARING", "READY_FOR_PICKUP"]:
        raise HTTPException(status_code=400, detail=f"Cannot accept order in status '{order.status}'.")

    order.courier_id = courier_id
    if order.status == "READY_FOR_PICKUP":
        order.status = "COURIER_ASSIGNED"

    db.commit()
    db.refresh(order)
    return order

def courier_pickup_order(db: Session, order_id: int, courier_id: int) -> Order:
    order = get_order(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Concurrency guard: only the assigned courier can pick up
    if order.courier_id is not None and order.courier_id != courier_id:
        assigned_name = order.courier.name if order.courier else f"Courier #{order.courier_id}"
        raise HTTPException(
            status_code=403,
            detail=f"Order #{order_id} is assigned to {assigned_name}. You cannot pick up another courier's order."
        )

    if order.courier_id is None:
        order.courier_id = courier_id

    if order.status not in ["READY_FOR_PICKUP", "COURIER_ASSIGNED"]:
        raise HTTPException(status_code=400, detail=f"Order #{order_id} is not ready for pickup (current status: {order.status}).")

    order.status = "PICKED_UP"
    db.commit()
    db.refresh(order)
    return order

def courier_deliver_order(db: Session, order_id: int, courier_id: int) -> Order:
    order = get_order(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Concurrency guard: only the courier who picked up can mark delivered
    if order.courier_id is not None and order.courier_id != courier_id:
        assigned_name = order.courier.name if order.courier else f"Courier #{order.courier_id}"
        raise HTTPException(
            status_code=403,
            detail=f"Order #{order_id} was picked up by {assigned_name}. Only the assigned courier can confirm delivery."
        )

    if order.status != "PICKED_UP":
        raise HTTPException(status_code=400, detail=f"Order cannot be delivered because it has not been picked up yet (current status: {order.status}).")

    order.status = "DELIVERED"
    db.commit()
    db.refresh(order)
    return order

def get_admin_statistics(db: Session):
    total_orders = db.query(func.count(Order.id)).scalar() or 0
    pending_orders = db.query(func.count(Order.id)).filter(Order.status == "PENDING").scalar() or 0
    active_orders = db.query(func.count(Order.id)).filter(Order.status.in_(["ACCEPTED", "PREPARING", "READY_FOR_PICKUP", "COURIER_ASSIGNED", "PICKED_UP"])).scalar() or 0
    completed_orders = db.query(func.count(Order.id)).filter(Order.status == "DELIVERED").scalar() or 0
    cancelled_orders = db.query(func.count(Order.id)).filter(Order.status == "REJECTED").scalar() or 0

    total_revenue = db.query(func.sum(Order.total_price)).filter(Order.status == "DELIVERED").scalar() or 0.0

    return {
        "total_orders": total_orders,
        "pending_orders": pending_orders,
        "active_orders": active_orders,
        "completed_orders": completed_orders,
        "cancelled_orders": cancelled_orders,
        "total_revenue": round(total_revenue, 2)
    }
