# Coyote Delivery

**Case 01 — Own Delivery Based on Coyote POS**

Coyote Delivery is a web-based coffee delivery MVP designed to connect customers, coffee shop staff, and couriers in one delivery workflow.

The project demonstrates how a coffee shop can manage orders and coordinate its own delivery process through three role-based interfaces.

> **Project status:** Hackathon MVP / Prototype  
> **Important:** This prototype uses its own FastAPI backend and SQLite database. Integration with an external Coyote POS system has not been implemented or verified.

---

## 1. Features

### Customer interface
- Browse the coffee shop menu and product categories.
- Search for products and manage a shopping cart.
- Place an order with customer and delivery details.
- Track order progress through delivery.

### Coffee shop dashboard
- View incoming orders.
- Accept or reject orders.
- Update preparation status.
- Mark orders as ready for courier pickup.
- Assign couriers to orders.
- View order statistics.

### Courier interface
- View available delivery orders.
- Accept an assigned delivery.
- Confirm order pickup.
- Confirm delivery to the customer.
- Open a navigation route and contact the customer.

---

## 2. Order Workflow

The prototype demonstrates the following order lifecycle:

1. Customer places an order.
2. The order appears in the coffee shop dashboard.
3. Staff accepts the order.
4. The order moves into preparation.
5. Staff marks it ready for pickup.
6. A courier accepts the delivery.
7. The courier picks up the order.
8. The courier confirms delivery.
9. The customer sees the final delivery status.

**Order statuses:**

`PENDING → ACCEPTED → PREPARING → READY_FOR_PICKUP → COURIER_ASSIGNED → PICKED_UP → DELIVERED`

Invalid status transitions are rejected by the backend.

---

## 3. Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React 19, TypeScript |
| Build tool | Vite |
| Styling | Tailwind CSS v4 |
| Icons | Lucide React |
| Backend | Python, FastAPI |
| Database | SQLite |
| ORM | SQLAlchemy |
| Data validation | Pydantic |

---

## 4. Architecture

The application consists of three main parts:

- **Customer frontend:** menu, cart, checkout, and order tracking.
- **Operations interfaces:** coffee shop dashboard and courier interface.
- **Backend API:** order management, status transitions, courier assignment, validation, and statistics.

The frontend communicates with the backend through HTTP API requests.

SQLite is used as the local database for the prototype.

---

## 5. Getting Started

### Prerequisites

- Python 3.10 or newer
- Node.js and npm
- Git

### Clone the repository

```bash
git clone https://github.com/zhanpi1991-hub/coyote-delivery.git
cd coyote-delivery
```

### Start the backend

Open a terminal:

```powershell
cd backend

python -m venv venv

.\venv\Scripts\python.exe -m pip install -r requirements.txt

.\venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The backend API will be available at:

`http://127.0.0.1:8000`

Interactive API documentation:

`http://127.0.0.1:8000/docs`

Health check:

`http://127.0.0.1:8000/api/health`

### Start the frontend

Open a second terminal:

```powershell
cd frontend

npm install

npm run dev
```

Open the application:

`http://127.0.0.1:5173`

---

## 6. Testing

The project includes three backend test scripts.

### API acceptance tests

Run from the `backend` directory:

```powershell
.\venv\Scripts\python.exe test_api.py
```

Tests product retrieval, order creation, status validation, coffee shop operations, courier workflow, and statistics.

### End-to-end acceptance tests

Start the backend server first. Then, in another terminal:

```powershell
.\venv\Scripts\python.exe e2e_verify.py
```

The test verifies the complete customer-to-courier delivery workflow and edge cases.

**Latest recorded result: 17/17 acceptance steps and edge cases passed.**

### Concurrency and data consistency tests

With the backend server running:

```powershell
.\venv\Scripts\python.exe test_concurrency.py
```

The test checks duplicate order submissions, competing courier assignments, unauthorized pickup and delivery attempts, and terminal order states.

**Latest recorded result: 10/10 tests passed.**

These results describe the tested MVP workflows and do not constitute a production security or load-testing certification.

---

## 7. Current Limitations

This is a hackathon prototype, not a production deployment.

- External Coyote POS integration is not implemented or verified.
- SQLite is used as the local database.
- The prototype has not been validated for production-scale traffic.
- Real payment processing has not been demonstrated.
- Production deployment, monitoring, and security hardening remain future work.

---

## 8. Future Improvements

- Integrate with the actual Coyote POS API, subject to access and documentation.
- Add production-grade authentication and role-based authorization.
- Introduce a production database.
- Integrate payment processing.
- Add real-time order updates.
- Improve courier location tracking.
- Deploy the application to a production environment.

---

## 9. Project

**Coyote Delivery — Case 01**

An independent prototype exploring an own-fleet coffee delivery workflow.

GitHub: https://github.com/zhanpi1991-hub/coyote-delivery
