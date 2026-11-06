import os
import sys

# Ensure backend root is on PYTHONPATH
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, engine, Base
from app.models import Product, Courier, Order, OrderItem, User

def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # Clear existing data to allow fresh re-seeding
        db.query(OrderItem).delete()
        db.query(Order).delete()
        db.query(Product).delete()
        db.query(Courier).delete()
        db.query(User).delete()
        db.commit()

        # Seed Couriers
        couriers = [
            Courier(name="Damir S.", phone="+7 (777) 123-4567", availability_status="available"),
            Courier(name="Aida M.", phone="+7 (777) 987-6543", availability_status="available"),
            Courier(name="Ruslan B.", phone="+7 (777) 555-8899", availability_status="busy"),
        ]
        db.add_all(couriers)
        db.commit()

        # Seed Users
        users = [
            User(name="Alikhan T.", phone="+7 (701) 111-2233", role="customer"),
            User(name="Barista Sarah", phone="+7 (701) 333-4455", role="staff"),
            User(name="Manager Elena", phone="+7 (701) 555-6677", role="admin"),
        ]
        db.add_all(users)
        db.commit()

        # Seed Products (Global Coffee × Coyote catalog)
        products = [
            # Espresso & Classics
            Product(
                name="Flat White Double Shot",
                description="Velvety microfoam over a rich double ristretto of specialty Ethiopian beans. Notes of caramel and chocolate.",
                price=4.50,
                category="Coffee Classics",
                image="https://images.unsplash.com/photo-1577968897966-3d4325b36b61?auto=format&fit=crop&w=600&q=80",
                available=True
            ),
            Product(
                name="Spanish Latte",
                description="Espresso balanced with fresh steamed milk and condensed milk for a delicate sweet finish.",
                price=5.20,
                category="Coffee Classics",
                image="https://images.unsplash.com/photo-1517256064527-09c73fc73e38?auto=format&fit=crop&w=600&q=80",
                available=True
            ),
            Product(
                name="Cold Brew Reserve",
                description="Slow-steeped for 18 hours. Ultra smooth, low acidity, subtle chocolate and hazelnut undertones.",
                price=4.80,
                category="Coffee Classics",
                image="https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=600&q=80",
                available=True
            ),
            Product(
                name="Cappuccino Supreme",
                description="Classic 1:1:1 ratio of bold espresso, steamed whole milk, and dense creamy foam.",
                price=4.20,
                category="Coffee Classics",
                image="https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&w=600&q=80",
                available=True
            ),

            # Signature Drinks
            Product(
                name="Coyote Salted Caramel Raf",
                description="Our signature house drink: espresso whipped directly with cream, Himalayan pink salt and bourbon vanilla syrup.",
                price=5.80,
                category="Signatures",
                image="https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=600&q=80",
                available=True
            ),
            Product(
                name="Pistachio Cloud Latte",
                description="Aromatic espresso crowned with silky pistachio cold foam and crushed Sicilian pistachios.",
                price=6.10,
                category="Signatures",
                image="https://images.unsplash.com/photo-1582293041079-7814c2f12063?auto=format&fit=crop&w=600&q=80",
                available=True
            ),
            Product(
                name="Lavender Honey Matcha",
                description="Ceremonial grade Uji matcha whisked with oat milk, infused with organic lavender and raw clover honey.",
                price=5.60,
                category="Signatures",
                image="https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=600&q=80",
                available=True
            ),

            # Tea & Refreshers
            Product(
                name="Citrus Cascara Iced Tea",
                description="Made from brewed coffee cherry husk (cascara), fresh pink grapefruit slices and mint.",
                price=4.40,
                category="Tea & More",
                image="https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=600&q=80",
                available=True
            ),
            Product(
                name="Spiced Chai Masala",
                description="Brewed with whole crushed spices, Assam black tea, ginger and creamy oat milk.",
                price=4.90,
                category="Tea & More",
                image="https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80",
                available=True
            ),

            # Fresh Bakery & Desserts
            Product(
                name="Artisanal Almond Croissant",
                description="Twice-baked butter croissant filled with rich almond frangipane and topped with toasted flaked almonds.",
                price=3.90,
                category="Bakery & Treats",
                image="https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80",
                available=True
            ),
            Product(
                name="San Sebastián Burnt Cheesecake",
                description="Crustless Basque cheesecake baked at high heat for a caramelized exterior and meltingly soft center.",
                price=5.50,
                category="Bakery & Treats",
                image="https://images.unsplash.com/photo-1508737027454-e6454ef45afd?auto=format&fit=crop&w=600&q=80",
                available=True
            ),
            Product(
                name="Avocado & Salmon Sourdough Tartine",
                description="Toasted country sourdough with smashed Haas avocado, cured Atlantic salmon, microgreens and poached egg.",
                price=7.50,
                category="Bakery & Treats",
                image="https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=600&q=80",
                available=True
            ),
        ]
        db.add_all(products)
        db.commit()

        # Refresh products to get IDs
        p_coyote = db.query(Product).filter(Product.name.like("%Coyote%")).first()
        p_croissant = db.query(Product).filter(Product.name.like("%Croissant%")).first()
        p_flat = db.query(Product).filter(Product.name.like("%Flat White%")).first()

        # Seed sample orders demonstrating different states
        # Sample order 1: PREPARING
        order1 = Order(
            customer_name="Amina Karimova",
            customer_phone="+7 (705) 234-5678",
            delivery_address="Dostyk Ave 42, Apt 18, Entrance 2",
            delivery_instructions="Door code 4218. Leave with concierge if unreachable.",
            status="PREPARING",
            total_price=9.70
        )
        db.add(order1)
        db.flush()

        db.add(OrderItem(order_id=order1.id, product_id=p_coyote.id, product_name=p_coyote.name, quantity=1, unit_price=p_coyote.price))
        db.add(OrderItem(order_id=order1.id, product_id=p_croissant.id, product_name=p_croissant.name, quantity=1, unit_price=p_croissant.price))

        # Sample order 2: READY_FOR_PICKUP
        order2 = Order(
            customer_name="Murat Sadykov",
            customer_phone="+7 (702) 890-1234",
            delivery_address="Abylai Khan Ave 74, Floor 4, Office 402",
            delivery_instructions="Please call 5 mins before arrival.",
            status="READY_FOR_PICKUP",
            total_price=9.00
        )
        db.add(order2)
        db.flush()

        db.add(OrderItem(order_id=order2.id, product_id=p_flat.id, product_name=p_flat.name, quantity=2, unit_price=p_flat.price))

        db.commit()
        print("Database seeded successfully with products, couriers and demo orders!")
    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed()
