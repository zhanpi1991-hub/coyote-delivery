import secrets
import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status
from typing import List, Optional, Dict
from .models import Product, Order, OrderItem, Courier, User, GuestOrderSession
from .schemas import (
    OrderCreate, OrderStatusUpdate, UserRegister, ProductCreate, ProductUpdate, CourierCreate
)
from .auth import hash_password, verify_password

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

# --- AUTH & USER CRUD ---
def get_user_by_phone(db: Session, phone: str) -> Optional[User]:
    return db.query(User).filter(User.phone == phone.strip()).first()

def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()

def register_customer(db: Session, user_in: UserRegister) -> User:
    normalized_phone = user_in.phone.strip()
    existing = get_user_by_phone(db, normalized_phone)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Phone number '{normalized_phone}' is already registered."
        )

    user = User(
        name=user_in.name.strip(),
        phone=normalized_phone,
        role="customer",  # Public registration strictly forces customer role
        password_hash=hash_password(user_in.password),
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

def authenticate_user(db: Session, phone: str, password: str) -> Optional[User]:
    user = get_user_by_phone(db, phone)
    if not user:
        return None
    if not user.password_hash or not verify_password(password, user.password_hash):
        return None
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Please contact support."
        )
    return user

def get_users(db: Session, role: Optional[str] = None) -> List[User]:
    query = db.query(User)
    if role:
        query = query.filter(User.role == role.lower())
    return query.all()

def update_user(db: Session, user_id: int, update_data: dict) -> User:
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Safety guard: Prevent deactivating or demoting the last active administrator
    if user.role == "admin":
        is_changing_role = "role" in update_data and update_data["role"] != "admin"
        is_deactivating = update_data.get("is_active") is False
        if is_changing_role or is_deactivating:
            active_admins = db.query(func.count(User.id)).filter(
                User.role == "admin",
                User.is_active == True
            ).scalar() or 0
            if active_admins <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Operation rejected: Cannot deactivate or demote the last remaining active administrator."
                )

    for key, value in update_data.items():
        if value is not None and hasattr(user, key):
            setattr(user, key, value)

    db.commit()
    db.refresh(user)
    return user

# --- PRODUCT CRUD ---
def get_products(db: Session, category: Optional[str] = None):
    query = db.query(Product)
    if category and category.lower() != "all":
        query = query.filter(Product.category == category)
    return query.all()

def get_product(db: Session, product_id: int):
    return db.query(Product).filter(Product.id == product_id).first()

def create_product(db: Session, prod_in: ProductCreate) -> Product:
    product = Product(
        name=prod_in.name.strip(),
        description=prod_in.description.strip() if prod_in.description else None,
        price=round(prod_in.price, 2),
        image=prod_in.image.strip() if prod_in.image else None,
        category=prod_in.category.strip(),
        available=prod_in.available
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product

def update_product(db: Session, product_id: int, prod_in: ProductUpdate) -> Product:
    product = get_product(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    for field, value in prod_in.model_dump(exclude_unset=True).items():
        if field == "price" and value is not None:
            value = round(value, 2)
        setattr(product, field, value)
    db.commit()
    db.refresh(product)
    return product

def delete_product(db: Session, product_id: int):
    product = get_product(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(product)
    db.commit()
    return {"message": f"Product #{product_id} deleted successfully"}

# --- COURIER CRUD ---
def get_couriers(db: Session):
    return db.query(Courier).all()

def get_courier(db: Session, courier_id: int):
    return db.query(Courier).filter(Courier.id == courier_id).first()

def get_courier_by_user_id(db: Session, user_id: int) -> Optional[Courier]:
    return db.query(Courier).filter(Courier.user_id == user_id).first()

def create_courier(db: Session, courier_in: CourierCreate) -> Courier:
    normalized_phone = courier_in.phone.strip()
    existing_user = get_user_by_phone(db, normalized_phone)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Phone number '{normalized_phone}' is already registered."
        )

    # Create associated user account
    user = User(
        name=courier_in.name.strip(),
        phone=normalized_phone,
        role="courier",
        password_hash=hash_password(courier_in.password),
        is_active=True
    )
    db.add(user)
    db.flush()

    courier = Courier(
        name=courier_in.name.strip(),
        phone=normalized_phone,
        availability_status="available",
        user_id=user.id
    )
    db.add(courier)
    db.commit()
    db.refresh(courier)
    return courier

# --- GUEST SESSION HELPERS (Database-Backed) ---
def _get_order_guest_session(db: Session, order_id: int) -> Optional[str]:
    """Retrieves guest session identifier directly from database."""
    mapping = db.query(GuestOrderSession).filter(GuestOrderSession.order_id == order_id).first()
    return mapping.session_id if mapping else None

def _verify_order_caller_scope(
    db: Session,
    existing: Order,
    customer_id: Optional[int],
    guest_session_id: Optional[str]
) -> bool:
    # 1. Registered user
    if customer_id is not None:
        return existing.customer_id == customer_id

    # 2. Guest user: If existing order belongs to a registered customer, guest cannot claim it
    if existing.customer_id is not None:
        return False

    # 3. Both are guest orders: Compare guest session identifier from database
    if not guest_session_id:
        return False

    existing_session = _get_order_guest_session(db, existing.id)
    if not existing_session:
        return False

    return secrets.compare_digest(existing_session, guest_session_id)

def _verify_order_payload(existing: Order, order_in: OrderCreate) -> bool:
    same_customer = (
        existing.customer_name == order_in.customer_name.strip() and
        existing.customer_phone == order_in.customer_phone.strip() and
        existing.delivery_address == order_in.delivery_address.strip()
    )
    existing_items = {item.product_id: item.quantity for item in existing.items}
    new_items = {item.product_id: item.quantity for item in order_in.items}
    return same_customer and (existing_items == new_items)

# --- ORDER CRUD ---
def create_order(
    db: Session,
    order_in: OrderCreate,
    customer_id: Optional[int] = None,
    guest_session_id: Optional[str] = None
) -> Order:
    if not order_in.items:
        raise HTTPException(status_code=400, detail="Order must contain at least one item")

    total_quantity = sum(item.quantity for item in order_in.items)
    if total_quantity > 100:
        raise HTTPException(status_code=400, detail="Maximum order quantity limit exceeded (max 100 items)")

    clean_key = order_in.idempotency_key.strip() if order_in.idempotency_key else None

    # -----------------------------------------------------------------------
    # Idempotency check — SCOPED to caller (registered user or guest session).
    #
    # Security invariant: An idempotency key must only match an order that
    # belongs to the SAME user or guest session. Different guest sessions must
    # NEVER receive each other's orders, even with identical keys and payloads.
    # -----------------------------------------------------------------------
    if clean_key:
        try:
            existing = (
                db.query(Order)
                .filter(Order.idempotency_key == clean_key)
                .first()
            )
        except Exception:
            db.rollback()
            existing = (
                db.query(Order)
                .filter(Order.idempotency_key == clean_key)
                .first()
            )

        if existing:
            caller_owns = _verify_order_caller_scope(db, existing, customer_id, guest_session_id)
            if not caller_owns:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Idempotency key has already been used. Please generate a new key.",
                )

            if not _verify_order_payload(existing, order_in):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Idempotency key has already been used with a different order payload.",
                )

            return existing

    # -----------------------------------------------------------------------
    # Server-side price verification (always uses DB price, never client price)
    # -----------------------------------------------------------------------
    total_price = 0.0
    order_items_to_create = []

    for item_in in order_in.items:
        product = db.query(Product).filter(Product.id == item_in.product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product with id {item_in.product_id} not found")
        if not product.available:
            raise HTTPException(status_code=400, detail=f"Product '{product.name}' is currently out of stock")

        item_total = round(product.price * item_in.quantity, 2)
        total_price += item_total

        order_items_to_create.append({
            "product_id": product.id,
            "product_name": product.name,
            "quantity": item_in.quantity,
            "unit_price": product.price
        })

    # Generate tracking token (24 bytes = 32 URL-safe chars)
    tracking_token = secrets.token_urlsafe(24)

    # -----------------------------------------------------------------------
    # Atomic transaction: Order header + all OrderItems committed together.
    # Handles concurrent duplicate-key database uniqueness conflicts cleanly.
    # -----------------------------------------------------------------------
    try:
        new_order = Order(
            customer_id=customer_id,       # None for guests — never inferred from phone
            customer_name=order_in.customer_name.strip(),
            customer_phone=order_in.customer_phone.strip(),
            delivery_address=order_in.delivery_address.strip(),
            delivery_instructions=order_in.delivery_instructions.strip() if order_in.delivery_instructions else None,
            status="PENDING",
            total_price=round(total_price, 2),
            tracking_token=tracking_token,
            idempotency_key=clean_key,
        )
        db.add(new_order)
        db.flush()  # Obtain new_order.id without committing yet

        for item_data in order_items_to_create:
            order_item = OrderItem(
                order_id=new_order.id,
                product_id=item_data["product_id"],
                product_name=item_data["product_name"],
                quantity=item_data["quantity"],
                unit_price=item_data["unit_price"],
            )
            db.add(order_item)

        # Persist guest session mapping in the SAME database transaction
        if customer_id is None and guest_session_id:
            guest_session = GuestOrderSession(
                order_id=new_order.id,
                session_id=guest_session_id
            )
            db.add(guest_session)

        # Single atomic commit covers Order + all OrderItems + guest session mapping
        db.commit()
        db.refresh(new_order)
        return new_order

    except IntegrityError as ie:
        db.rollback()
        err_msg = str(ie).lower()
        # Distinguish idempotency uniqueness conflicts from unrelated integrity errors
        is_idempotency_conflict = (
            "idempotency_key" in err_msg or
            "orders.idempotency_key" in err_msg or
            "ix_orders_idempotency_key" in err_msg or
            (clean_key and db.query(Order).filter(Order.idempotency_key == clean_key).first() is not None)
        )
        if is_idempotency_conflict and clean_key:
            existing = (
                db.query(Order)
                .filter(Order.idempotency_key == clean_key)
                .first()
            )
            if existing:
                caller_owns = _verify_order_caller_scope(db, existing, customer_id, guest_session_id)
                same_payload = _verify_order_payload(existing, order_in)
                if caller_owns and same_payload:
                    return existing
                else:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="Conflict: Idempotency key already used by another session or payload.",
                    )
        # Unrelated database integrity failure: log details server-side, return generic message
        import logging
        logger = logging.getLogger("coyote.database")
        logger.error("Database integrity constraint violated during order creation: %s", ie, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order could not be created due to a database integrity constraint violation. Please verify your order data.",
        )
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Order creation failed due to an internal error. No order was recorded.",
        ) from e

def get_order(db: Session, order_id: int) -> Optional[Order]:
    return db.query(Order).filter(Order.id == order_id).first()

def get_order_by_tracking_token(db: Session, tracking_token: str) -> Optional[Order]:
    return db.query(Order).filter(Order.tracking_token == tracking_token.strip()).first()

def get_customer_orders(db: Session, customer_id: int) -> List[Order]:
    return db.query(Order).filter(Order.customer_id == customer_id).order_by(Order.created_at.desc()).all()

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

    if current_status in ["DELIVERED", "REJECTED"]:
        raise HTTPException(
            status_code=400,
            detail=f"Order #{order_id} is in terminal state '{current_status}' and cannot be altered."
        )

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

def assign_courier_to_order(db: Session, order_id: int, courier_id: int) -> Order:
    order = get_order(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    courier = get_courier(db, courier_id)
    if not courier:
        raise HTTPException(status_code=404, detail="Courier not found")

    if courier.availability_status == "offline":
        raise HTTPException(status_code=400, detail=f"Courier '{courier.name}' is currently offline.")

    if order.status in ["DELIVERED", "REJECTED"]:
        raise HTTPException(status_code=400, detail=f"Cannot assign courier to completed/cancelled order ({order.status}).")

    order.courier_id = courier.id
    if order.status == "READY_FOR_PICKUP":
        order.status = "COURIER_ASSIGNED"

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

    # If already claimed by this courier, idempotent return
    if order.courier_id == courier_id:
        return order

    # Concurrency guard: check if already claimed by another courier
    if order.courier_id is not None and order.courier_id != courier_id:
        assigned_name = order.courier.name if order.courier else f"Courier #{order.courier_id}"
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Conflict: Order #{order_id} has already been accepted by {assigned_name}."
        )

    # Courier can accept order if it is ACCEPTED, PREPARING, or READY_FOR_PICKUP
    if order.status not in ["ACCEPTED", "PREPARING", "READY_FOR_PICKUP"]:
        raise HTTPException(status_code=400, detail=f"Cannot accept order in status '{order.status}'.")

    # Atomic conditional update prevents race conditions across concurrent threads/workers
    new_status = "COURIER_ASSIGNED" if order.status == "READY_FOR_PICKUP" else order.status
    updated_rows = db.query(Order).filter(
        Order.id == order_id,
        (Order.courier_id == None) | (Order.courier_id == courier_id)
    ).update({
        Order.courier_id: courier_id,
        Order.status: new_status
    }, synchronize_session="fetch")

    if updated_rows == 0:
        db.rollback()
        refreshed = get_order(db, order_id)
        assigned_name = refreshed.courier.name if (refreshed and refreshed.courier) else f"another courier"
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Conflict: Order #{order_id} has already been accepted by {assigned_name}."
        )

    db.commit()
    db.refresh(order)
    return order

def courier_pickup_order(db: Session, order_id: int, courier_id: int) -> Order:
    order = get_order(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Strict ownership check: courier must be assigned to order
    if order.courier_id is None:
        raise HTTPException(
            status_code=400,
            detail=f"Order #{order_id} is not yet accepted/assigned. Please accept the order first."
        )

    if order.courier_id != courier_id:
        assigned_name = order.courier.name if order.courier else f"Courier #{order.courier_id}"
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Order #{order_id} is assigned to {assigned_name}. You cannot pick up another courier's order."
        )

    if order.status not in ["READY_FOR_PICKUP", "COURIER_ASSIGNED"]:
        raise HTTPException(
            status_code=400,
            detail=f"Order #{order_id} is not ready for pickup (current status: {order.status})."
        )

    order.status = "PICKED_UP"
    db.commit()
    db.refresh(order)
    return order

def courier_deliver_order(db: Session, order_id: int, courier_id: int) -> Order:
    order = get_order(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.courier_id != courier_id:
        assigned_name = order.courier.name if order.courier else f"Courier #{order.courier_id}"
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Order #{order_id} was assigned to {assigned_name}. Only the assigned courier can confirm delivery."
        )

    if order.status != "PICKED_UP":
        raise HTTPException(
            status_code=400,
            detail=f"Order cannot be delivered because it has not been picked up yet (current status: {order.status})."
        )

    order.status = "DELIVERED"
    db.commit()
    db.refresh(order)
    return order

def get_admin_statistics(db: Session):
    total_orders = db.query(func.count(Order.id)).scalar() or 0
    pending_orders = db.query(func.count(Order.id)).filter(Order.status == "PENDING").scalar() or 0
    active_orders = db.query(func.count(Order.id)).filter(
        Order.status.in_(["ACCEPTED", "PREPARING", "READY_FOR_PICKUP", "COURIER_ASSIGNED", "PICKED_UP"])
    ).scalar() or 0
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
