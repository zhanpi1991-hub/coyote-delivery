from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional

from .database import engine, Base, get_db
from . import models, schemas, crud

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Coyote Delivery API",
    description="Backend API for Global Coffee × Coyote Delivery MVP (Case 01)",
    version="1.0.0"
)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "Coyote Delivery API"}

# PRODUCTS
@app.get("/api/products", response_model=List[schemas.ProductResponse])
def get_products(category: Optional[str] = Query(None), db: Session = Depends(get_db)):
    return crud.get_products(db, category=category)

@app.get("/api/products/{product_id}", response_model=schemas.ProductResponse)
def get_product(product_id: int, db: Session = Depends(get_db)):
    prod = crud.get_product(db, product_id)
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    return prod

# ORDERS
@app.post("/api/orders", response_model=schemas.OrderResponse, status_code=201)
def create_order(order_in: schemas.OrderCreate, db: Session = Depends(get_db)):
    return crud.create_order(db, order_in)

@app.get("/api/orders/{order_id}", response_model=schemas.OrderResponse)
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = crud.get_order(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

@app.get("/api/orders", response_model=List[schemas.OrderResponse])
def get_orders(status: Optional[str] = Query(None), db: Session = Depends(get_db)):
    return crud.get_orders(db, status=status)

@app.patch("/api/orders/{order_id}/status", response_model=schemas.OrderResponse)
def update_order_status(order_id: int, status_update: schemas.OrderStatusUpdate, db: Session = Depends(get_db)):
    return crud.update_order_status(db, order_id, status_update)

# COFFEE SHOP / ADMIN
@app.get("/api/admin/orders", response_model=List[schemas.OrderResponse])
def get_admin_orders(status: Optional[str] = Query(None), db: Session = Depends(get_db)):
    return crud.get_orders(db, status=status)

@app.get("/api/admin/statistics", response_model=schemas.StatisticsResponse)
def get_admin_statistics(db: Session = Depends(get_db)):
    return crud.get_admin_statistics(db)

# COURIERS
@app.get("/api/couriers", response_model=List[schemas.CourierResponse])
def get_couriers(db: Session = Depends(get_db)):
    return crud.get_couriers(db)

@app.get("/api/couriers/orders", response_model=List[schemas.OrderResponse])
def get_courier_orders(courier_id: Optional[int] = Query(None), db: Session = Depends(get_db)):
    """
    Returns orders relevant to couriers:
    - Orders waiting for courier pickup or assignment (READY_FOR_PICKUP, ACCEPTED, PREPARING)
    - Orders actively assigned to or in transit by this courier
    """
    query = db.query(models.Order)
    if courier_id:
        query = query.filter(
            (models.Order.courier_id == courier_id) |
            (models.Order.status.in_(["READY_FOR_PICKUP", "ACCEPTED", "PREPARING"]) & (models.Order.courier_id.is_(None)))
        )
    else:
        query = query.filter(models.Order.status.in_(["READY_FOR_PICKUP", "COURIER_ASSIGNED", "PICKED_UP"]))

    return query.order_by(models.Order.created_at.desc()).all()

@app.post("/api/couriers/orders/{order_id}/accept", response_model=schemas.OrderResponse)
def courier_accept(order_id: int, payload: schemas.CourierAssignRequest, db: Session = Depends(get_db)):
    return crud.courier_accept_order(db, order_id, payload.courier_id)

@app.post("/api/couriers/orders/{order_id}/pickup", response_model=schemas.OrderResponse)
def courier_pickup(order_id: int, payload: schemas.CourierAssignRequest, db: Session = Depends(get_db)):
    return crud.courier_pickup_order(db, order_id, payload.courier_id)

@app.post("/api/couriers/orders/{order_id}/deliver", response_model=schemas.OrderResponse)
def courier_deliver(order_id: int, payload: schemas.CourierAssignRequest, db: Session = Depends(get_db)):
    return crud.courier_deliver_order(db, order_id, payload.courier_id)
