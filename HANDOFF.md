# COYOTE DELIVERY — PROJECT HANDOFF

## 1. Project overview

Coyote Delivery is a hackathon MVP for a coffee shop's own delivery system, based on the Case 01 concept: own delivery based on Coyote POS.

The application is intended to connect four user roles:

1. Customer
2. Coffee shop staff
3. Courier
4. Administrator

The core product journey is:

Customer places an order → Staff receives and prepares it → Courier picks it up → Courier delivers it → Customer tracks the order.

This is a standalone delivery prototype. Do not claim that an actual Coyote POS or Global Coffee integration exists unless it is implemented and verified.

## 2. Technology stack

Frontend:
- React 19
- TypeScript
- Vite 8
- Tailwind CSS v4
- Lucide React

Backend:
- Python 3.15
- FastAPI
- SQLAlchemy
- Pydantic v2
- SQLite
- Uvicorn
- JWT authentication
- Argon2 password hashing

Development environment:
- Windows 11
- VS Code
- Node.js and npm
- Python virtual environment

## 3. Brand identity

Brand name: COYOTE DELIVERY

Visual direction:
- Minimalist specialty coffee aesthetic
- Refined and professional
- Geometric coyote icon and wordmark

Colors:
- Espresso: #21150F
- Dark Roast: #382216
- Cream: #F3E9DC
- Copper: #D98943
- Milk White: #FAFAF7
- Muted Brown: #8A7668

Fonts:
- Newsreader
- Plus Jakarta Sans
- JetBrains Mono

Preserve the existing visual identity. Do not redesign the app unnecessarily.

Do not copy the official Global Coffee logo or imply official affiliation.

## 4. Existing functionality

The project has previously included:

Customer:
- Menu
- Shopping cart
- Checkout
- Order tracking
- Order history

Staff:
- Incoming orders
- Accept/reject
- Preparation status
- Ready-for-pickup
- Courier assignment

Courier:
- Delivery order list
- Accept order
- Confirm pickup
- Confirm delivery

Admin:
- Dashboard
- Product management
- User management
- Courier management
- Statistics

The current implementation must be inspected. Do not assume every feature is still working.

## 5. Previous authentication work

An earlier Antigravity implementation reportedly introduced:
- Argon2id password hashing
- JWT authentication
- Customer registration
- Role-based access control
- Tracking tokens
- Server-side product price calculation
- Idempotency keys
- Courier assignment restrictions
- Admin functionality

These are reported changes, NOT independently verified facts.

Inspect the actual source code before relying on them.

## 6. Previously identified backend risks

An earlier source audit identified the following concerns. Recheck each against the current code:

- Hardcoded fallback JWT secret.
- Optional authentication potentially allowing unauthorized anonymous access.
- Public order listing.
- Customer access to other customers' orders.
- Courier identity trusted from client-supplied courier_id.
- Public tracking exposing personal information.
- Courier endpoints insufficiently protected.
- Unsafe shared default passwords in migration logic.
- Idempotency key ownership and payload validation problems.
- Duplicate order heuristic potentially suppressing legitimate orders.
- Floating-point monetary calculations.
- Database transaction and concurrency weaknesses.
- User administration potentially allowing privilege escalation.
- Public courier endpoint exposing unnecessary personal information.

## 7. Previously identified frontend risks

Recheck:
- JWT stored in localStorage.
- Session restoration and expiration handling.
- Frontend role selector potentially misleading users about actual permissions.
- Demo credentials hardcoded in the authentication interface.
- Courier requests sending courier_id from the browser.
- Cart restoration without sufficient validation.
- Frontend/backend authorization inconsistencies.

## 8. Testing history and limitations

Earlier versions reportedly passed:
- E2E tests
- Concurrency tests
- Authentication tests
- Frontend production build

However, a previous archive contained stale test scripts:
- An old E2E script that did not send authentication headers.
- A concurrency test that executed requests sequentially instead of simultaneously.
- Tests relying on shared demo credentials and existing database state.

Do not trust previous test summaries. Rebuild and run meaningful isolated tests.

## 9. GitHub

Repository:
https://github.com/zhanpi1991-hub/coyote-delivery.git

Inspect the current Git history and working tree before making changes.

Do not push changes automatically.

Do not overwrite remote work.

## 10. Deadline priorities

We have an extremely tight hackathon deadline.

Priority 1:
- Application starts.
- Authentication works.
- Customer can place an order.
- Staff can process the order.
- Courier can complete delivery.
- Customer can track the order.

Priority 2:
- Customer data privacy.
- Backend authorization.
- Courier identity verification.
- Secure tracking.
- Safe database handling.

Priority 3:
- Admin dashboard.
- Responsive UI.
- Error handling.
- Demo preparation.
- Documentation.

Avoid unnecessary new features.

## 11. Important operating instructions

- Preserve the existing database.
- Back up before migrations.
- Never expose secrets.
- Never delete project functionality without a clear reason.
- Do not rebuild the application from scratch.
- Do not redesign the brand.
- Test actual API behavior.
- Clearly distinguish implemented features from verified features.
- Do not claim production readiness without a real production security review.

## 12. Final goal

Deliver a stable, functional, secure-enough hackathon MVP with a complete customer-to-staff-to-courier workflow and a reliable live demonstration.

The current repository is the source of truth. Inspect it before making assumptions.