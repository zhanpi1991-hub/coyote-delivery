import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    phone = Column(String(30), nullable=False, unique=True, index=True)
    role = Column(String(30), default="customer")  # customer, staff, courier, admin
    password_hash = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    courier = relationship("Courier", back_populates="user", uselist=False)
    orders = relationship("Order", back_populates="customer")

class Courier(Base):
    __tablename__ = "couriers"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    phone = Column(String(30), nullable=False)
    availability_status = Column(String(30), default="available")  # available, busy, offline
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=True)

    user = relationship("User", back_populates="courier")
    orders = relationship("Order", back_populates="courier")

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Float, nullable=False)
    image = Column(String(500), nullable=True)
    category = Column(String(50), nullable=False, index=True)
    available = Column(Boolean, default=True)

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    customer_name = Column(String(100), nullable=False)
    customer_phone = Column(String(30), nullable=False)
    delivery_address = Column(String(255), nullable=False)
    delivery_instructions = Column(Text, nullable=True)
    status = Column(String(40), default="PENDING", index=True)
    total_price = Column(Float, nullable=False, default=0.0)
    courier_id = Column(Integer, ForeignKey("couriers.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    tracking_token = Column(String(64), unique=True, index=True, nullable=True)
    idempotency_key = Column(String(100), unique=True, index=True, nullable=True)

    customer = relationship("User", back_populates="orders")
    courier = relationship("Courier", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")

class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    product_name = Column(String(150), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    unit_price = Column(Float, nullable=False)

    order = relationship("Order", back_populates="items")
    product = relationship("Product")

class GuestOrderSession(Base):
    __tablename__ = "guest_order_sessions"

    order_id = Column(Integer, primary_key=True)
    session_id = Column(String(128), nullable=False, index=True)
