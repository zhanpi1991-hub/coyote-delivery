# Coyote Delivery 1.1

**Global Coffee Г— Coyote Mini-Hackathon вЂ” Case 01: Own Delivery Based on Coyote POS**

Coyote Delivery is a full-stack, role-based coffee delivery system that demonstrates how a specialty coffee shop can manage its own direct delivery operations in one connected system.

The prototype bridges four user roles with real backend authentication, role-based access control (RBAC), concurrency safeguards, and secure order tracking:
1. **Customer** вЂ” browses menu, places orders with server-side price verification, and tracks delivery using unguessable tokens.
2. **Coffee Shop Staff** вЂ” kitchen order ticket management, recipe brewing status progression, and courier dispatch.
3. **Courier Fleet** вЂ” mobile-friendly field interface for accepting, picking up, and completing deliveries.
4. **Store Admin / Manager** вЂ” store metrics, sales revenue analytics, product menu catalog management, and fleet/user RBAC access control.

> **Project status:** Fully hardened hackathon MVP (Version 1.1)
> **Architecture note:** This prototype runs on its own FastAPI backend and SQLite database. While it models the exact operational workflow of a coffee shop POS, it does not claim verified real-time sync with external proprietary Coyote POS hardware.

---

## 1. Security & Hardening Features (v1.1)

- **Argon2id Password Hashing:** Industry-standard password hashing via `argon2-cffi`. No plaintext credentials.
- **JWT Authentication & RBAC:** Cryptographically signed JSON Web Tokens (HS256) enforcing permissions for `customer`, `staff`, `admin`, and `courier`.
- **Public Registration Guard:** Public `/api/auth/register` strictly creates `customer` accounts. Staff and admin privileges cannot be self-assigned.
- **Unguessable Tracking Tokens:** Orders are assigned secure 32-character URL-safe tracking tokens (`GET /api/orders/track/{token}`) preventing sequential integer enumeration of customer addresses or orders.
- **Server-Side Pricing Recalculation:** Prices and order subtotals are always computed from the authoritative database product records, ignoring client-side tampering attempts.
- **Idempotency Protection:** Checkout requests pass an `idempotency_key` (plus a 4-second rapid deduplication window) ensuring rapid double-clicks never create duplicate orders.
- **Concurrency & Identity Guards:** Courier endpoints enforce identity from the authenticated JWT token. Race conditions between multiple couriers claiming the same order are intercepted with HTTP 409 Conflict. Unauthorized pick up or delivery attempts are rejected with HTTP 403 Forbidden.

---

## 2. Pre-Seeded Test Accounts

For demonstration and testing, the database includes pre-configured demo accounts.

| Role | Name | Phone Number | Default Password | Access Scope |
|---|---|---|---|---|
| **Customer** | Alikhan T. | `+7 (701) 111-2233` | `coyote2026` | Menu browsing, cart, order placement, order tracking |
| **Staff** | Barista Sarah | `+7 (701) 333-4455` | `coyote2026` | Kitchen tickets, order status progression, courier dispatch |
| **Admin** | Manager Elena | `+7 (701) 555-6677` | `coyote2026` | All staff actions + store revenue stats, menu catalog, fleet RBAC |
| **Courier #1** | Damir S. | `+7 (777) 123-4567` | `coyote2026` | Accept assigned orders, confirm pickup, confirm delivery |
| **Courier #2** | Aida M. | `+7 (777) 987-6543` | `coyote2026` | Accept assigned orders, confirm pickup, confirm delivery |
| **Courier #3** | Ruslan B. | `+7 (777) 555-8899` | `coyote2026` | Accept assigned orders, confirm pickup, confirm delivery |

*Note: The frontend includes a "Judge & Demo Fast Access" panel in the Sign-In modal to log in as any role with a single click.*

---

## 3. Order Lifecycle Workflow

```
[Customer Checkout]
       в†“ (PENDING)
[Staff Kitchen Acceptance]
       в†“ (ACCEPTED)
[Barista Extraction & Brewing]
       в†“ (PREPARING)
[Thermal Packaging Sealed]
       в†“ (READY_FOR_PICKUP)
[Courier Assignment / Claim]
       в†“ (COURIER_ASSIGNED)
[Courier Confirms Pickup at Shop]
       в†“ (PICKED_UP)
[Courier Completes Customer Handoff]
       в†“ (DELIVERED)
[Terminal State: Immutable]
```

Invalid transitions (e.g. `PENDING` directly to `DELIVERED`, or modifying a `DELIVERED` order) are strictly rejected by the backend state machine.

---

## 4. Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS v4, Lucide Icons |
| Backend | Python 3.12+, FastAPI, Uvicorn |
| Database & ORM | SQLite, SQLAlchemy 2.0 |
| Security | Argon2id (`argon2-cffi`), PyJWT (`pyjwt`) |
| Data Validation | Pydantic v2 |

---

## 5. Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm
- Windows PowerShell or Bash

### 1. Configure Environment Variables
Copy `.env.example` to `.env` in the `backend/` directory:
```powershell
cd backend
Copy-Item .env.example .env
```
Ensure `JWT_SECRET_KEY` is defined with a high-entropy secret string.

### 2. Setup Demo Accounts (Optional / Development Only)

> **Safe demo setup process — read before running:**
>
> - The script **only creates** accounts that do not exist. It **never** overwrites existing passwords, roles, or active status, and never silently promotes an account to admin.
> - Requires the `--confirm-demo` flag and explicit confirmation of the resolved database path via `--confirm-demo-db-path` to prevent accidental execution against production databases.
> - Never run against a database with real customer data.

```powershell
cd backend
# Step 1: Run schema migration (idempotent, safe to re-run)
.\venv\Scripts\python.exe migrate.py

# Step 2: Seed missing demo accounts only (requires explicit path confirmation)
$dbPath = (Resolve-Path ".\coyote_delivery.db").Path
.\venv\Scripts\python.exe setup_demo_accounts.py --confirm-demo --confirm-demo-db-path="$dbPath"
```

### 3. Start the Backend API
In a PowerShell terminal:
```powershell
cd backend
.\venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
- API Base: `http://127.0.0.1:8000`
- Interactive OpenAPI Docs: `http://127.0.0.1:8000/docs`
- Health check: `http://127.0.0.1:8000/api/health`

### 4. Start the Frontend
In a second terminal:
```powershell
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 6. Comprehensive Verification Suites

The repository contains 4 automated test suites verifying API workflows, concurrency, security, and full end-to-end integration.

### A. Isolated In-Memory Test Suite with Multithreaded Concurrency (`backend/test_isolated_suite.py`)
Runs 15 comprehensive security, IDOR, RBAC, idempotency cross-user isolation, guest order linkage prevention, atomic transaction integrity, and simultaneous multithreaded race condition tests on an ephemeral temporary database (0 impact on production DB):
```powershell
cd backend
.\venv\Scripts\python.exe test_isolated_suite.py
```
**Recorded Result:** 12/12 passed (including true concurrent 2-thread race condition prevention: 1 won 200, 1 conflicted 409).

### B. Isolated End-to-End Complete Integration Test (`e2e_verify.py`)
Executes the full 14-step journey across Customer, Staff, Courier, and Admin roles in a **strictly isolated temporary database**. It copies demo templates into an ephemeral SQLite instance, asserts that `DATABASE_URL` does not point to persistent storage, masks sensitive phone/token credentials in logs, and automatically cleans up the temporary database upon completion:
```powershell
.\backend\venv\Scripts\python.exe e2e_verify.py
```
**Recorded Result:** 14/14 acceptance criteria passed (0 modifications to persistent `backend/coyote_delivery.db`).

### C. Concurrency & Data Consistency Tests (`backend/test_concurrency.py`)
Tests duplicate order submission idempotency, racing couriers, unauthorized pickups/deliveries, and terminal states:
```powershell
cd backend
.\venv\Scripts\python.exe test_concurrency.py
```
**Recorded Result:** 10/10 concurrency checks passed.

### D. Authentication & Security Suite (`backend/test_auth_security.py`)
Validates Argon2id hashing, JWT token expiration, customer role enforcement, 401/403 RBAC boundaries, server pricing, and tracking tokens:
```powershell
cd backend
.\venv\Scripts\python.exe test_auth_security.py
```
**Recorded Result:** 9/9 auth and security tests passed.

### E. Core API Workflow Suite (`backend/test_api.py`)
Tests endpoints with authenticated tokens:
```powershell
cd backend
.\venv\Scripts\python.exe test_api.py
```
**Recorded Result:** All criteria passed.

---

## 7. Current Scope & Known Limitations

- **Simulated POS Environment:** While the system models full order intake, recipe checklist, status progression, and courier dispatch, it is a self-contained prototype not tied to third-party POS APIs.
- **Local SQLite Storage:** Ideal for rapid hackathon demonstration; production deployment would swap the database URL to PostgreSQL.
- **Simulated Payment:** Checkout is modeled without external payment gateway redirection (e.g. Stripe or Kaspi Pay).
- **Token Storage (localStorage Security Limitation):** JWT access tokens are stored in localStorage for convenience during the hackathon demonstration (supports quick multi-role switching via the Demo Fast Access panel). localStorage is accessible to any JavaScript running on the same origin, which means a successful XSS attack could read the token. This is an accepted trade-off for a demo environment. In production, store tokens in HttpOnly, Secure, SameSite=Strict cookies to prevent JavaScript access entirely.

---

## 8. Live Hackathon Demonstration Sequence

Follow this tested step-by-step workflow for judging presentations:

1. **Customer Order Journey:**
   - Open `http://localhost:5173`.
   - Log in as Customer (**Alikhan T.** via the Demo Fast Access panel).
   - Add "Flat White Double Shot" and "Cold Brew Reserve" to cart.
   - Click Cart -> Proceed to Checkout -> Fill address "Kabanbay Batyr 53" -> Place Order.
   - Note the generated tracking token (or click "Track Live Order").
   - Status shows `PENDING` with real-time status tracker.

2. **Coffee Shop Kitchen Operations:**
   - Switch role to Staff (**Barista Sarah**).
   - Navigate to **Coffee Shop** tab -> **Active Orders**.
   - See the incoming order ticket with items and notes.
   - Click **Accept Order** -> Status changes to `ACCEPTED`.
   - Click **Start Brewing / Kitchen** -> Status changes to `PREPARING`.
   - Click **Ready for Courier Pickup** -> Status changes to `READY_FOR_PICKUP`.
   - Assign to Courier **Damir S.** or leave open for courier claim.

3. **Courier Field Operations:**
   - Switch role to Courier (**Damir S.**).
   - Navigate to **Courier Fleet** tab.
   - Order appears in Available / Active deliveries.
   - Click **Accept Delivery** (if not pre-assigned).
   - Click **Confirm Pickup at Coffee Shop** -> Status changes to `PICKED_UP`.
   - Click **Confirm Delivery to Customer** -> Status transitions to `DELIVERED`.

4. **Customer Live Verification:**
   - Return to Customer view / Live Tracking.
   - Confirm status shows `DELIVERED` with courier name and timestamp.
   - Notice zero customer PII is leaked in public tracking view.

5. **Manager Analytics & Governance:**
   - Switch role to Admin (**Manager Elena**).
   - View updated store revenue, completed orders count, active orders, and catalog management.
