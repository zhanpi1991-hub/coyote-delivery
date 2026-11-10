from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Literal
from datetime import datetime

UserRoleType = Literal["customer", "staff", "admin", "courier"]
OrderStatusType = Literal[
    "PENDING",
    "ACCEPTED",
    "PREPARING",
    "READY_FOR_PICKUP",
    "COURIER_ASSIGNED",
    "PICKED_UP",
    "DELIVERED",
    "REJECTED"
]

# --- AUTH SCHEMAS ---
class UserRegister(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    phone: str = Field(..., min_length=5, max_length=30)
    password: str = Field(..., min_length=6, max_length=128)

class UserLogin(BaseModel):
    phone: str = Field(..., min_length=5, max_length=30)
    password: str = Field(..., min_length=1)

class UserResponse(BaseModel):
    id: int
    name: str
    phone: str
    role: str
    is_active: bool
    courier_id: Optional[int] = None

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class UserAdminUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    role: Optional[UserRoleType] = None
    is_active: Optional[bool] = None

# --- PRODUCT SCHEMAS ---
class ProductBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    description: Optional[str] = Field(None, max_length=1000)
    price: float = Field(..., gt=0, le=10000.0)
    image: Optional[str] = Field(None, max_length=500)
    category: str = Field(..., min_length=2, max_length=50)
    available: bool = True

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=150)
    description: Optional[str] = Field(None, max_length=1000)
    price: Optional[float] = Field(None, gt=0, le=10000.0)
    image: Optional[str] = Field(None, max_length=500)
    category: Optional[str] = Field(None, min_length=2, max_length=50)
    available: Optional[bool] = None

class ProductResponse(ProductBase):
    id: int

    class Config:
        from_attributes = True

# --- COURIER SCHEMAS ---
class CourierPublicResponse(BaseModel):
    """Safe courier representation for public / client interface: no personal phone number or user_id."""
    id: int
    name: str
    availability_status: str

    class Config:
        from_attributes = True

class CourierStaffResponse(BaseModel):
    """Detailed courier representation for authorized staff and admin dispatch."""
    id: int
    name: str
    phone: str
    availability_status: str
    user_id: Optional[int] = None

    class Config:
        from_attributes = True

class CourierCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    phone: str = Field(..., min_length=5, max_length=30)
    password: str = Field(..., min_length=6, max_length=128)

class CourierUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    phone: Optional[str] = Field(None, min_length=5, max_length=30)
    availability_status: Optional[str] = None

# --- ORDER SCHEMAS ---
class OrderItemCreate(BaseModel):
    product_id: int = Field(..., gt=0)
    quantity: int = Field(..., gt=0, le=50)

class OrderItemResponse(BaseModel):
    id: int
    product_id: int
    product_name: str
    quantity: int
    unit_price: float

    class Config:
        from_attributes = True

class OrderCreate(BaseModel):
    customer_name: str = Field(..., min_length=2, max_length=100)
    customer_phone: str = Field(..., min_length=5, max_length=30)
    delivery_address: str = Field(..., min_length=5, max_length=255)
    delivery_instructions: Optional[str] = Field(None, max_length=500)
    items: List[OrderItemCreate] = Field(..., min_length=1, max_length=50)
    idempotency_key: Optional[str] = Field(None, min_length=6, max_length=100)

class OrderStatusUpdate(BaseModel):
    status: OrderStatusType
    courier_id: Optional[int] = None

class CourierAssignRequest(BaseModel):
    courier_id: int = Field(..., gt=0)

class OrderResponse(BaseModel):
    """Full order response for authenticated customer (their own order) or staff/admin."""
    id: int
    customer_id: Optional[int] = None
    customer_name: str
    customer_phone: str
    delivery_address: str
    delivery_instructions: Optional[str] = None
    status: str
    total_price: float
    courier_id: Optional[int] = None
    courier: Optional[CourierStaffResponse] = None
    items: List[OrderItemResponse] = []
    tracking_token: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Privacy-safe Public Tracking Schemas
class OrderTrackCourierResponse(BaseModel):
    name: str

class OrderTrackItemResponse(BaseModel):
    product_name: str
    quantity: int
    unit_price: float

class OrderTrackResponse(BaseModel):
    """
    Zero-leakage public tracking response.
    Never exposes customer phone number, full address, delivery instructions, courier phone, or user IDs.
    """
    tracking_token: str
    status: str
    total_price: float
    created_at: datetime
    updated_at: datetime
    items: List[OrderTrackItemResponse] = []
    courier: Optional[OrderTrackCourierResponse] = None

    class Config:
        from_attributes = True

class StatisticsResponse(BaseModel):
    total_orders: int
    pending_orders: int
    active_orders: int
    completed_orders: int
    cancelled_orders: int
    total_revenue: float
