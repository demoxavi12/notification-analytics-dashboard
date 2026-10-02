# PulseOps — Notification & Analytics Dashboard (Mini SaaS System)

A production-style, full-stack SaaS platform that aggregates application events and notifications across multiple backend services with real-time analytics, JWT authentication, Role-Based Access Control (RBAC), Redis caching with invalidation, and rate limiting.

---

## 🌟 Key Features

1. **Authentication & Security**
   - User registration and login with secure bcrypt password hashing (10 salt rounds).
   - Stateless JWT tokens with expiration handling.
   - Current user session verification endpoint (`GET /api/auth/me`).
   - Role-Based Access Control (`admin` vs `user`).
   - Reusable backend middleware: `authenticate` and `authorize(...roles)`.

2. **Multi-Service Events Ingestion & Aggregation**
   - Ingests events from simulated services:
     - `auth-service` (`user.signup`, `user.login`, `user.login.failed`)
     - `notification-service` (`notification.sent`, `notification.delivered`, `notification.failed`)
     - `payment-service` (`payment.success`, `payment.failed`, `subscription.renewed`)
     - `api-gateway` (`api.request`)
     - `system` (`system.error`)
   - High performance MongoDB indexing on `timestamp`, `eventType`, `service`, and `status`.
   - Real-time event simulation buttons on the dashboard to test live streaming.

3. **Notification System**
   - Multi-channel delivery: `in-app`, `email`, and `push`.
   - Notification states: `pending`, `delivered`, `failed`, and unread/read.
   - Real-time unread notification count badge in navigation header.
   - "Mark as read", "Mark all as read", and test dispatch modal.

4. **Analytics Engine & Redis Caching**
   - Real-time KPI summaries: Total events, active users, notifications dispatched, delivery success rates, error counts, and API requests.
   - MongoDB Aggregation Pipelines (`$group`, `$match`, `$dateToString`, `$facet`) powering:
     - Activity volume over time (Area/Bar charts)
     - Delivery trends (Line charts)
     - Service breakdown (Donut charts)
     - Top event types (Horizontal bar charts)
   - **Redis Caching**: Caches analytics and stats endpoints. Automatically invalidates cached results upon new event ingestion or notification dispatch.
   - **Graceful Fallbacks**: If Redis is unavailable, caching falls back to memory. In **development only**, an unavailable MongoDB falls back to an embedded in-memory engine (data is not persisted); in production the server refuses to start without its database.

5. **API Rate Limiting**
   - Sensitive endpoints (login/registration) restricted to 20 requests per 15 minutes.
   - Event ingestion limited to 150 requests per minute.
   - Returns standard `HTTP 429 Too Many Requests` with retry headers and JSON error details.

6. **Modern SaaS User Interface**
   - Clean dark-slate aesthetic inspired by top DevOps/SaaS tools (Datadog, Vercel, Stripe).
   - Responsive layouts, collapsible sidebar, summary cards, and interactive charts.
   - JSON metadata inspector modal for deep debugging of event payloads.
   - 1-click Quick Demo login buttons on the login page for instant evaluations.

---

## 🛠 Tech Stack

- **Frontend**: React 19, Vite, React Router v7, Axios, Recharts 3, Lucide Icons, Modern responsive CSS tokens.
- **Backend**: Node.js, Express.js 5, MongoDB, Mongoose 9, Redis (ioredis), JSON Web Tokens (jsonwebtoken), bcryptjs, express-rate-limit, CORS, dotenv.
- **Development**: Nodemon, embedded MongoDB in-memory engine fallback for local development only (`mongodb-memory-server`).

---

## 📂 Directory Structure

```
notification-analytics-dashboard/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/         # Badge, Modal, KPICard
│   │   │   ├── layout/         # Sidebar, Navbar
│   │   │   └── protected/      # ProtectedRoute, AdminRoute
│   │   ├── context/
│   │   │   └── AuthContext.jsx # Auth state, user profile, token persistence
│   │   ├── layouts/
│   │   │   └── DashboardLayout.jsx # App shell with unread count & health checks
│   │   ├── pages/
│   │   │   ├── DashboardPage.jsx   # Overview KPIs, charts, simulator, recent feeds
│   │   │   ├── AnalyticsPage.jsx   # Deep-dive analytics with date range & service filters
│   │   │   ├── EventsPage.jsx      # Searchable events table, metadata viewer, ingestion modal
│   │   │   ├── NotificationsPage.jsx # Inbox, filters, mark read, dispatch modal
│   │   │   ├── UsersPage.jsx       # Admin user management & RBAC role switcher
│   │   │   ├── LoginPage.jsx       # Login screen with 1-click demo fill buttons
│   │   │   ├── RegisterPage.jsx    # Public registration (always creates a standard user)
│   │   │   └── NotFoundPage.jsx    # 404 page
│   │   ├── services/
│   │   │   └── api.js          # Centralized Axios client with JWT interceptors
│   │   ├── App.jsx             # React Router route tree
│   │   ├── index.css           # Modern SaaS CSS design system
│   │   └── main.jsx            # Entry point with BrowserRouter
│   ├── .env.example
│   ├── .env
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js           # Mongoose connection (dev-only embedded fallback)
│   │   │   └── redis.js        # Redis client with in-memory fallback cache
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── userController.js
│   │   │   ├── eventController.js
│   │   │   ├── notificationController.js
│   │   │   └── analyticsController.js
│   │   ├── middleware/
│   │   │   ├── auth.js         # authenticate & authorize RBAC middleware
│   │   │   ├── rateLimiter.js  # express-rate-limit configurations
│   │   │   ├── cache.js        # Redis cache middleware & invalidation logic
│   │   │   └── errorHandler.js # Centralized async error handler
│   │   ├── models/
│   │   │   ├── User.js         # User model with bcrypt pre-save hashing
│   │   │   ├── Event.js        # Event model with compound indexes
│   │   │   └── Notification.js # Notification model with channel & delivery state
│   │   ├── routes/
│   │   │   ├── authRoutes.js
│   │   │   ├── userRoutes.js
│   │   │   ├── eventRoutes.js
│   │   │   ├── notificationRoutes.js
│   │   │   ├── analyticsRoutes.js
│   │   │   └── healthRoutes.js
│   │   ├── services/
│   │   │   ├── eventService.js
│   │   │   └── notificationService.js
│   │   ├── seed/
│   │   │   ├── seedData.js     # Reusable dataset generator (130+ events, 35+ alerts)
│   │   │   └── seed.js         # CLI seed execution script
│   │   ├── utils/
│   │   │   └── apiResponse.js  # Standardized response formatters
│   │   └── server.js           # Server bootstrap (auto-seeds only in development)
│   ├── .env.example
│   ├── .env
│   └── package.json
│
└── README.md
```

---

## ⚡ Quick Start Guide

### Prerequisites
- Node.js (v18.x or v20+ recommended, tested on v22.19.0)
- npm (v9+)
- (Optional) Local MongoDB or Redis service. *Note: in development, if they are not running, the backend uses embedded in-memory engines so it runs out-of-the-box. Production requires a real MongoDB.*

---

### Step 1: Clone or Navigate to Directory
```bash
cd notification-analytics-dashboard
```

---

### Step 2: Configure Environment Variables

#### Backend (`backend/.env`):
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/notification_dashboard
REDIS_URL=redis://localhost:6379
# Required: at least 32 random characters. Generate with:
#   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
AUTH_RATE_LIMIT_WINDOW_MS=60000
AUTH_RATE_LIMIT_MAX=100
```

#### Frontend (`frontend/.env`):
```env
VITE_API_URL=http://localhost:5000/api
```

*Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to `frontend/.env`, then fill in real values. `.env` files are git-ignored and must never be committed. In production the backend refuses to start without a strong `JWT_SECRET`, and `CLIENT_URL` must list the frontend origin(s) (comma-separated) for CORS. If `VITE_API_URL` is unset, production frontend builds call `/api` on the same origin.*

---

### Step 3: Install Dependencies

#### Backend:
```bash
cd backend
npm install
```

#### Frontend:
```bash
cd ../frontend
npm install
```

---

### Step 4: Populate Seed Data

For **local development only** (the script clears all collections and is refused when `NODE_ENV=production`), run the seed command in the `backend/` directory:
```bash
cd backend
npm run seed
```
This populates:
- 3 test users (including Administrator and Standard User).
- 130+ realistic events spread across 14 days from `auth-service`, `notification-service`, `payment-service`, and `system`.
- 35 realistic notifications with varying delivery channels and read states.

---

### Step 5: Start the Application

#### Start Backend (Terminal 1):
```bash
cd backend
npm run dev
# Or: npm start
```
*Backend runs on: `http://localhost:5000`*
*Health endpoint: `http://localhost:5000/api/health`*

#### Start Frontend (Terminal 2):
```bash
cd frontend
npm run dev
```
*Frontend runs on: `http://localhost:5173`*

---

## 🔑 Demo Credentials (local development only)

These accounts exist only in a locally seeded development database. They are never seeded in production, and the demo login buttons are compiled out of production builds unless `VITE_ENABLE_DEMO_LOGIN=true` is set at build time.

| Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@saas.local` | `AdminPass123!` | Full dashboard, all analytics, all events, user management, role modification. |
| **Standard User** | `user@saas.local` | `UserPass123!` | Scoped dashboard, user notifications, filtered analytics. Cannot access `/api/users`. |

*(The login screen also features 1-click **"Admin Demo"** and **"User Demo"** auto-fill buttons for quick testing!)*

---

## 📡 REST API Reference

### Health Check
- `GET /api/health` — Returns system status, DB connection status, Redis status, and uptime.

### Authentication (`/api/auth`)
- `POST /api/auth/register` — Register new user account.
- `POST /api/auth/login` — Authenticate and receive JWT Bearer token.
- `GET /api/auth/me` — Retrieve current user profile (Requires Bearer token).
- `POST /api/auth/logout` — Invalidate client session.

### Users Management (`/api/users`) — Admin Only
- `GET /api/users` — Paginated user directory with search and role filters.
- `GET /api/users/:id` — Retrieve individual user details.
- `PATCH /api/users/:id/role` — Modify user role (`admin` or `user`).
- `PATCH /api/users/:id/status` — Set user status: `active`, `inactive` (deactivated) or `suspended`. Both `inactive` and `suspended` block sign-in and end existing sessions.

### Events Engine (`/api/events`)
- `POST /api/events` — Ingest new application event (Rate limited).
- `GET /api/events` — Paginated event stream (Filters: `service`, `status`, `eventType`, `search`, date range).
- `GET /api/events/:id` — Retrieve full event payload and metadata.
- `GET /api/events/stats` — Quick status & service volume statistics (Cached).
- `POST /api/events/simulate` — Trigger instant service event simulation for testing.

### Notifications Center (`/api/notifications`)
- `POST /api/notifications` — Dispatch new notification (Auto-emits event).
- `GET /api/notifications` — Retrieve notifications with filters (`read`, `type`, `channel`, `status`).
- `PATCH /api/notifications/:id/read` — Mark single notification as read.
- `PATCH /api/notifications/read-all` — Mark all user notifications as read.
- `GET /api/notifications/stats` — Retrieve notification breakdown and unread count (Cached).
- `DELETE /api/notifications/:id` — Remove notification.

### Analytics (`/api/analytics`) — Redis Cached
- `GET /api/analytics/overview?range=7d` — KPI aggregates (total events, users, delivery rates, errors, API requests).
- `GET /api/analytics/timeseries?range=7d` — Chronological timeline buckets for charts.
- `GET /api/analytics/distributions?range=7d` — Service shares, event type breakdown, and delivery channels.

---

## 🚀 Deployment Guidelines

1. **Production Build**:
   ```bash
   cd frontend
   npm run build
   ```
   The static assets are compiled into `frontend/dist`.

2. **Serving Static Frontend from Express (Optional Single Server)**:
   You can serve `frontend/dist` directly using Express `express.static(path.join(__dirname, '../../frontend/dist'))`.

3. **Cloud Deployment (e.g. Render / Railway / AWS / Docker)**:
   - Provide a persistent MongoDB URI (e.g., MongoDB Atlas `mongodb+srv://...`).
   - Provide a managed Redis URL (e.g., Upstash or Redis Cloud `rediss://...`).
   - Configure environment variables: `PORT`, `MONGODB_URI`, `REDIS_URL`, `JWT_SECRET`, and `CLIENT_URL`.
   - Use a strong, unique `JWT_SECRET` and never run `npm run seed` against staging or production (it clears all data and is refused when `NODE_ENV=production`). Create the first admin through a trusted path (e.g. promote an existing account directly in the database), since public registration can never create admins.
