import datetime
import os
from fastapi import FastAPI, Depends, HTTPException, Query, status, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional, Union

from .database import engine, Base, get_db
from . import models, schemas, crud
from .auth import (
    create_access_token,
    get_current_user,
    get_current_user_optional,
    require_roles,
)

# Ensure database tables exist
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Coyote Delivery API",
    description="Hardened Production-Grade Backend API for Coyote Delivery (Global Coffee × Coyote Case 01)",
    version="1.1.0"
)

# Enable CORS for frontend
# Configure trusted origins via COYOTE_CORS_ORIGINS environment variable.
# Provide a comma-separated list of allowed origins:
#   COYOTE_CORS_ORIGINS=https://your-domain.com,https://other.com
# Falls back to localhost:5173 (Vite dev server) when unset.
# Never use allow_origins=["*"] with allow_credentials=True; that combination
# is rejected by modern browsers and leaks cookies/tokens cross-origin.
_raw_origins = os.getenv("COYOTE_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
ALLOWED_ORIGINS: List[str] = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "service": "Coyote Delivery API",
        "version": "1.1.0",
        "features": ["argon2id-auth", "jwt-rbac", "server-pricing", "idempotency", "token-tracking", "zero-leakage-privacy"]
    }

# ==========================================
# AUTHENTICATION & PROFILE
# ==========================================

@app.post("/api/auth/register", response_model=schemas.TokenResponse, status_code=201)
def register(payload: schemas.UserRegister, db: Session = Depends(get_db)):
    """
    Public customer registration.
    Strictly forces role='customer'. Prevents arbitrary privilege escalation.
    """
    user = crud.register_customer(db, payload)
    access_token = create_access_token({
        "sub": str(user.id),
        "phone": user.phone,
        "role": user.role
    })
    return schemas.TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=schemas.UserResponse(
            id=user.id,
            name=user.name,
            phone=user.phone,
            role=user.role,
            is_active=user.is_active,
            courier_id=None
        )
    )

@app.post("/api/auth/login", response_model=schemas.TokenResponse)
def login(payload: schemas.UserLogin, db: Session = Depends(get_db)):
    """
    Authenticates user via phone and password using Argon2id verification.
    Issues a cryptographically signed JWT access token.
    """
    user = crud.authenticate_user(db, payload.phone, payload.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid phone number or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    courier_id = user.courier.id if user.courier else None

    access_token = create_access_token({
        "sub": str(user.id),
        "phone": user.phone,
        "role": user.role,
        "courier_id": courier_id
    })

    return schemas.TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=schemas.UserResponse(
            id=user.id,
            name=user.name,
            phone=user.phone,
            role=user.role,
            is_active=user.is_active,
            courier_id=courier_id
        )
    )

@app.get("/api/auth/me", response_model=schemas.UserResponse)
def get_current_user_profile(
    current_user: models.User = Depends(get_current_user)
):
    """
    Returns the authenticated user's current identity and verified database role.
    """
    courier_id = current_user.courier.id if current_user.courier else None
    return schemas.UserResponse(
        id=current_user.id,
        name=current_user.name,
        phone=current_user.phone,
        role=current_user.role,
        is_active=current_user.is_active,
        courier_id=courier_id
    )

# ==========================================
# PRODUCTS (Public Read, Admin Write)
# ==========================================

@app.get("/api/products", response_model=List[schemas.ProductResponse])
def get_products(category: Optional[str] = Query(None), db: Session = Depends(get_db)):
    return crud.get_products(db, category=category)

@app.get("/api/products/{product_id}", response_model=schemas.ProductResponse)
def get_product(product_id: int, db: Session = Depends(get_db)):
    prod = crud.get_product(db, product_id)
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    return prod

@app.post("/api/admin/products", response_model=schemas.ProductResponse, status_code=201)
def create_product(
    prod_in: schemas.ProductCreate,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(require_roles("admin"))
):
    return crud.create_product(db, prod_in)

@app.put("/api/admin/products/{product_id}", response_model=schemas.ProductResponse)
def update_product(
    product_id: int,
    prod_in: schemas.ProductUpdate,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(require_roles("admin"))
):
    return crud.update_product(db, product_id, prod_in)

@app.delete("/api/admin/products/{product_id}")
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(require_roles("admin"))
):
    return crud.delete_product(db, product_id)

# ==========================================
# ORDERS (Creation & Secure Tracking)
# ==========================================

@app.post("/api/orders", response_model=schemas.OrderResponse, status_code=201)
def create_order(
    order_in: schemas.OrderCreate,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user_optional)
):
    """
    Creates an order with server-side price calculation and idempotency checks.
    Binds to authenticated customer account if present, or to an isolated guest session.
    Guest identity is derived exclusively from the server-issued HttpOnly
    coyote_guest_session cookie — never from request body payloads or
    arbitrary client headers.
    """
    customer_id = current_user.id if current_user else None
    guest_session_id = None
    if not customer_id:
        raw_cookie = request.cookies.get("coyote_guest_session")
        if raw_cookie and isinstance(raw_cookie, str) and 8 <= len(raw_cookie.strip()) <= 128:
            guest_session_id = raw_cookie.strip()
        else:
            import secrets
            guest_session_id = secrets.token_urlsafe(24)

        # Configure Secure cookie for HTTPS / production environments
        is_secure = (
            request.url.scheme == "https" or
            request.headers.get("x-forwarded-proto", "").lower() == "https" or
            os.getenv("APP_ENV", "").strip().lower() in ("production", "prod") or
            os.getenv("SECURE_COOKIES", "0").strip().lower() in ("1", "true", "yes")
        )

        response.set_cookie(
            key="coyote_guest_session",
            value=guest_session_id,
            httponly=True,
            samesite="lax",
            secure=is_secure,
            max_age=30 * 24 * 3600,
        )

    return crud.create_order(db, order_in, customer_id=customer_id, guest_session_id=guest_session_id)

@app.get("/api/orders/track/{tracking_token}", response_model=schemas.OrderTrackResponse)
def track_order_by_token(tracking_token: str, db: Session = Depends(get_db)):
    """
    Public order tracking via unguessable 32-character token.
    Zero personal data leakage: never returns customer phone, full address,
    delivery instructions, internal user IDs, or courier contact details.
    """
    order = crud.get_order_by_tracking_token(db, tracking_token)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found. Invalid tracking token.")

    courier_info = None
    if order.courier:
        courier_info = schemas.OrderTrackCourierResponse(name=order.courier.name)

    items_info = [
        schemas.OrderTrackItemResponse(
            product_name=item.product_name,
            quantity=item.quantity,
            unit_price=item.unit_price
        )
        for item in order.items
    ]

    return schemas.OrderTrackResponse(
        tracking_token=order.tracking_token,
        status=order.status,
        total_price=order.total_price,
        created_at=order.created_at,
        updated_at=order.updated_at,
        items=items_info,
        courier=courier_info
    )

@app.get("/api/orders/my-orders", response_model=List[schemas.OrderResponse])
def get_my_orders(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("customer"))
):
    """
    Returns orders placed by the currently authenticated customer.
    Customers cannot access other customers' orders.
    """
    return crud.get_customer_orders(db, current_user.id)

@app.get("/api/orders/{order_id}", response_model=schemas.OrderResponse)
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Retrieves full order details. STRICT AUTHENTICATION ENFORCED:
    - Customer: only their own order.
    - Courier: only assigned orders.
    - Staff / Admin: authorized operational access.
    Anonymous requests receive 401 Unauthorized.
    """
    order = crud.get_order(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if current_user.role in ["staff", "admin"]:
        return order

    if current_user.role == "customer":
        if order.customer_id is None or order.customer_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: You can only view your own orders."
            )
        return order

    if current_user.role == "courier":
        if not current_user.courier or order.courier_id != current_user.courier.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: You can only view orders assigned to your courier account."
            )
        return order

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

@app.get("/api/orders", response_model=List[schemas.OrderResponse])
def get_orders(
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Returns order lists based on role:
    - Customer: their own orders only.
    - Staff / Admin: full order queue.
    - Courier: their assigned orders.
    Anonymous access is strictly prohibited (HTTP 401).
    """
    if current_user.role == "customer":
        orders = crud.get_customer_orders(db, current_user.id)
        if status and status.upper() != "ALL":
            orders = [o for o in orders if o.status == status.upper()]
        return orders

    if current_user.role in ["staff", "admin"]:
        return crud.get_orders(db, status=status)

    if current_user.role == "courier":
        if not current_user.courier:
            return []
        query = db.query(models.Order).filter(models.Order.courier_id == current_user.courier.id)
        if status and status.upper() != "ALL":
            query = query.filter(models.Order.status == status.upper())
        return query.order_by(models.Order.created_at.desc()).all()

    return []

@app.patch("/api/orders/{order_id}/status", response_model=schemas.OrderResponse)
def update_order_status(
    order_id: int,
    status_update: schemas.OrderStatusUpdate,
    db: Session = Depends(get_db),
    _staff: models.User = Depends(require_roles("staff", "admin"))
):
    """
    Staff / Admin advances order status (ACCEPTED -> PREPARING -> READY_FOR_PICKUP).
    Enforces terminal state immutability.
    """
    return crud.update_order_status(db, order_id, status_update)

@app.post("/api/orders/{order_id}/assign-courier", response_model=schemas.OrderResponse)
def assign_courier(
    order_id: int,
    payload: schemas.CourierAssignRequest,
    db: Session = Depends(get_db),
    _staff: models.User = Depends(require_roles("staff", "admin"))
):
    """
    Dedicated endpoint for coffee shop staff/admin to dispatch an order to an available courier.
    """
    return crud.assign_courier_to_order(db, order_id, payload.courier_id)

# ==========================================
# COFFEE SHOP & ADMIN DASHBOARD
# ==========================================

@app.get("/api/admin/orders", response_model=List[schemas.OrderResponse])
def get_admin_orders(
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _staff: models.User = Depends(require_roles("staff", "admin"))
):
    return crud.get_orders(db, status=status)

@app.get("/api/admin/statistics", response_model=schemas.StatisticsResponse)
def get_admin_statistics(
    db: Session = Depends(get_db),
    _staff: models.User = Depends(require_roles("staff", "admin"))
):
    return crud.get_admin_statistics(db)

@app.get("/api/admin/users", response_model=List[schemas.UserResponse])
def get_admin_users(
    role: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _admin: models.User = Depends(require_roles("admin"))
):
    users = crud.get_users(db, role=role)
    result = []
    for u in users:
        result.append(schemas.UserResponse(
            id=u.id,
            name=u.name,
            phone=u.phone,
            role=u.role,
            is_active=u.is_active,
            courier_id=u.courier.id if u.courier else None
        ))
    return result

@app.patch("/api/admin/users/{user_id}", response_model=schemas.UserResponse)
def update_user_status(
    user_id: int,
    payload: schemas.UserAdminUpdate,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(require_roles("admin"))
):
    user = crud.update_user(db, user_id, payload.model_dump(exclude_unset=True))
    return schemas.UserResponse(
        id=user.id,
        name=user.name,
        phone=user.phone,
        role=user.role,
        is_active=user.is_active,
        courier_id=user.courier.id if user.courier else None
    )

# ==========================================
# COURIERS & COURIER ACTIONS
# ==========================================

@app.get("/api/couriers")
def get_couriers(
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user_optional)
):
    """
    Returns courier list:
    - Authorized Staff/Admin: receives CourierStaffResponse with phone numbers.
    - Public / Unauthenticated: receives CourierPublicResponse (NO phone numbers, NO user_id).
    """
    couriers = crud.get_couriers(db)
    is_staff = current_user and current_user.role in ["staff", "admin"]
    if is_staff:
        return [schemas.CourierStaffResponse.model_validate(c) for c in couriers]
    return [schemas.CourierPublicResponse.model_validate(c) for c in couriers]

@app.post("/api/admin/couriers", response_model=schemas.CourierStaffResponse, status_code=201)
def create_courier(
    payload: schemas.CourierCreate,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(require_roles("admin"))
):
    return crud.create_courier(db, payload)

@app.get("/api/couriers/orders", response_model=List[schemas.OrderResponse])
def get_courier_orders(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("courier"))
):
    """
    Returns orders relevant to the authenticated courier:
    - Orders assigned to this courier.
    - Orders ready for pickup that have not yet been claimed.
    Derived strictly from authenticated session (never trusts client-supplied courier_id).
    """
    courier = current_user.courier
    if not courier:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User account is not bound to a courier fleet profile."
        )

    orders = db.query(models.Order).filter(
        (models.Order.courier_id == courier.id) |
        (models.Order.status.in_(["READY_FOR_PICKUP", "ACCEPTED", "PREPARING"]) & models.Order.courier_id.is_(None))
    ).order_by(models.Order.created_at.desc()).all()

    return orders

@app.post("/api/couriers/orders/{order_id}/accept", response_model=schemas.OrderResponse)
def courier_accept(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("courier"))
):
    """
    Authenticated courier accepts an available order.
    Identity derived strictly from JWT session. Concurrency conflicts return HTTP 409.
    """
    courier = current_user.courier
    if not courier:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User account is not bound to a courier fleet profile."
        )

    return crud.courier_accept_order(db, order_id, courier.id)

@app.post("/api/couriers/orders/{order_id}/pickup", response_model=schemas.OrderResponse)
def courier_pickup(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("courier"))
):
    """
    Authenticated courier confirms pickup of their assigned order.
    Unauthorized couriers receive HTTP 403 Forbidden.
    """
    courier = current_user.courier
    if not courier:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User account is not bound to a courier fleet profile."
        )

    return crud.courier_pickup_order(db, order_id, courier.id)

@app.post("/api/couriers/orders/{order_id}/deliver", response_model=schemas.OrderResponse)
def courier_deliver(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("courier"))
):
    """
    Authenticated courier confirms successful delivery.
    Unauthorized couriers receive HTTP 403 Forbidden.
    """
    courier = current_user.courier
    if not courier:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User account is not bound to a courier fleet profile."
        )

    return crud.courier_deliver_order(db, order_id, courier.id)
