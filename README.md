# Coyote Delivery — Brand Identity & Own Fleet Delivery System

> **CASE 01 — OWN DELIVERY BASED ON COYOTE POS**
> A premium, modern coffee delivery experience inspired by the atmosphere and visual culture of specialty coffee roasteries, built with its own independent brand identity.

---

## ☕ 1. Brand Identity & Visual Language

**Coyote Delivery** is positioned as an artisanal, specialty-grade coffee delivery platform directly integrated into the **Coyote POS** ecosystem.

### Brand Attributes:
- **Premium & Editorial**: Magazine-quality typography and photography (*Newsreader* display serif paired with *Plus Jakarta Sans* and *JetBrains Mono*).
- **Warm & Refined**: Warm milk white and cream backgrounds for content areas, dark espresso for navigation, and restrained copper accents.
- **Minimalist & Distinctive**: An original geometric faceted coyote mark—clean, scalable, and recognizable at small sizes.

---

## 🦊 2. Logo Design & Symbol

The **Coyote** emblem is an original geometric SVG vector mark featuring:
- Alert, faceted geometric planes representing the vigilant coyote.
- Warm copper and cream facets sculpted against dark espresso.
- Wordmark: **`COYOTE`** with secondary lettering **`DELIVERY`**.
- Implemented as a reusable component:
  ```tsx
  <Logo variant="light" size="md" showSecondary={true} />
  ```
- Configurable properties:
  - `variant`: `'light'` (for dark espresso headers/footers), `'dark'` (for cream/milk backgrounds), `'copper'`
  - `size`: `'sm'`, `'md'`, `'lg'`, `'xl'`
  - `showText`: boolean
  - `showSecondary`: boolean
  - `layout`: `'horizontal' | 'vertical'`

---

## 🎨 3. Color System

| Token | Hex Value | Role & Usage |
| :--- | :--- | :--- |
| **Espresso** | `#21150F` | Primary headers, primary dark buttons, deep contrast accents |
| **Dark Roast** | `#382216` | Navigation borders, badge backgrounds, card borders |
| **Cream** | `#F3E9DC` | Warm background highlights, subtle badges |
| **Cream Soft** | `#FAF4EC` | Content card surfaces, form inputs, secondary pill backgrounds |
| **Cream Border**| `#E8DAC8` | Delicate dividers, hairline card borders |
| **Copper** | `#D98943` | Restrained brand accent, primary buttons, price tags, active icons |
| **Milk White** | `#FAFAF7` | Base canvas background, clean card backgrounds |
| **Muted Brown**| `#8A7668` | Secondary labels, descriptions, micro-copy, timestamps |

---

## 🔤 4. Typography Pairing

- **Headings & Display**: *Newsreader* (Google Fonts display serif) — warm, literary, reminiscent of artisanal coffee journals and Nordic roasteries.
- **Body & Controls**: *Plus Jakarta Sans* — ultra-crisp, legible modern grotesque sans-serif for UI controls, inputs, and paragraphs.
- **Data & Pricing**: *JetBrains Mono* — precise, technical mono for tickets, order IDs, and monetary amounts.

---

## 🖥️ 5. Redesigned User Experiences

### A. Customer Experience
- **Editorial Hero**: Headline *"Great Coffee. Delivered."*, accurate value badges (*Specialty Coffee Experience*, *Direct Coffee Shop Delivery*, *One Connected Delivery Workflow*), and direct menu navigation.
- **Curated Menu**: Category navigation pills, real-time search, large coffee photography, and aromatic tasting notes.
- **Coffee Bag Drawer**: Slide-over panel with tactile quantity steppers, free delivery badge, guest checkout form, and instant validation.
- **Live Order Progress**: Dodo-inspired step timeline from Queue to Doorstep Delivery, syncing automatically with the backend every 3 seconds.
- **Toast Notifications**: Gentle feedback for bag additions and order events.

### B. Coffee Shop POS Operations Dashboard
- **Refined Light Workspace**: Soft cream and milk surfaces with dark espresso navigation.
- **Urgent Incoming Highlighting**: Unaccepted orders pulse with a warm copper outline so baristas never miss a ticket.
- **KPI Metrics**: Real-time order counts and revenue statistics.
- **Direct Workflow Controls**: One-click progression: `Accept Order` → `Start Brewing` → `Ready for Courier`.
- **Fleet Courier Assignment**: Direct dropdown to dispatch *Damir S.*, *Aida M.*, or *Ruslan B.*

### C. Courier Companion App
- **Mobile-First Layout**: Large, accessible touch targets (48px+ height).
- **Available vs. Active Tabs**: Clean separation between roastery pickups and active route transit.
- **Direct Guest Action**: One-click Google Maps route navigation and phone dialer.
- **Step Confirmation**: Prominent buttons to confirm pickup and customer handoff.

---

## 🛠️ 6. How to Run Locally

### Start Backend:
```bash
cd backend
.\venv\Scripts\activate
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Start Frontend:
```bash
cd frontend
npm install
npm run dev
```
Open **http://127.0.0.1:5173** in your browser.

### Run End-to-End Acceptance Verification:
```bash
cd backend
python e2e_verify.py
```
Validates all 17 workflow steps and edge-case security constraints with 100% success.
