from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class ProductBase(BaseModel):
    name: str
    description: Optional[str] = None
    price: float = Field(..., gt=0)
    image: Optional[str] = None
    category: str
    available: bool = True

class ProductResponse(ProductBase):
    id: int

    class Config:
        from_attributes = True

class CourierResponse(BaseModel):
    id: int
    name: str
    phone: str
    availability_status: str

    class Config:
        from_attributes = True

class OrderItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(..., gt=0)

class OrderItemResponse(BaseModel):
    id: int
    product_id: int
    product_name: str
    quantity: int
    unit_price: float

    class Config:
        from_attributes = True

class OrderCreate(BaseModel):
    customer_name: str = Field(..., min_length=2)
    customer_phone: str = Field(..., min_length=5)
    delivery_address: str = Field(..., min_length=5)
    delivery_instructions: Optional[str] = None
    items: List[OrderItemCreate] = Field(..., min_length=1)

class OrderStatusUpdate(BaseModel):
    status: str
    courier_id: Optional[int] = None

class CourierAssignRequest(BaseModel):
    courier_id: int

class OrderResponse(BaseModel):
    id: int
    customer_name: str
    customer_phone: str
    delivery_address: str
    delivery_instructions: Optional[str] = None
    status: str
    total_price: float
    courier_id: Optional[int] = None
    courier: Optional[CourierResponse] = None
    items: List[OrderItemResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class StatisticsResponse(BaseModel):
    total_orders: int
    pending_orders: int
    active_orders: int
    completed_orders: int
    cancelled_orders: int
    total_revenue: float
