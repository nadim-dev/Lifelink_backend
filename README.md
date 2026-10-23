# 🩸 LifeLink

### Connecting people, hospitals, blood banks, and delivery partners when every moment matters.

LifeLink is a blood donation and emergency coordination platform. Its backend powers account and role-based workflows for donors, people requesting blood, hospitals, blood banks, delivery partners, and administrators. It combines a REST API with real-time Socket.IO connections to coordinate requests, inventory, deliveries, appointments, and notifications.

> **Backend documentation** · Node.js · Express · MongoDB · Redis · Socket.IO

---

## ✨ What LifeLink supports

- **Accounts and secure sessions** — registration, password login and reset, Google login, profile management, and logout.
- **Donor coordination** — donor profiles, location updates, nearby donor discovery, and donor contact workflows.
- **Blood bank operations** — registration, inventory management, incoming requests, approvals, dispatch readiness, and demand prediction.
- **Hospital operations** — registration, emergency and capacity information, doctor schedules, services, facilities, and appointments.
- **Request-to-delivery workflows** — blood requests, status tracking, delivery partner assignment, journey updates, and OTP-assisted pickup and delivery confirmation.
- **Platform support** — notifications, enquiries, support tickets, geocoding, and administrator dashboards and registration reviews.
- **Live updates** — authenticated Socket.IO connections join user, delivery partner, or blood bank rooms.

## 🧭 How the backend is organized

```text
backend/
├── app.js              # Express server, API mounting, and Socket.IO
├── config/             # MongoDB, Redis, and Cloudinary configuration
├── controllers/        # Request handlers and workflow logic
├── middleware/         # Authentication and upload handling
├── models/             # Mongoose data models
├── routes/              # API route definitions
├── services/            # Integrations and reusable services
├── template/            # Email templates
├── utils/               # Sanitization, upload, and location helpers
└── validators/          # Request validation
```

## 🧰 Technology

| Area | Technology |
| --- | --- |
| HTTP API | Node.js, Express 5 |
| Data | MongoDB with Mongoose |
| Sessions | Redis and signed cookies |
| Real-time communication | Socket.IO |
| Uploads and media | Multer and Cloudinary |
| Integrations in source | Google authentication, Geoapify, Resend, and Groq AI SDK |
| Validation and sanitization | Zod and DOMPurify |

Integration availability depends on valid credentials and configuration in your environment.

## 🚀 Get started

### Prerequisites

- Node.js and npm
- A reachable MongoDB database
- A reachable Redis instance
- Provider credentials for any integrations you enable

### Install

Open a terminal in `backend/` and install the dependencies:

```bash
npm install
```

Create `backend/.env` with the core settings:

```env
DB_URL=mongodb_connection_string
REDIS_URL=redis_connection_string
mySecretKey=replace_with_a_long_random_secret
FRONTEND_URL=http://localhost:5173
```

The environment file is ignored by Git. Keep real keys and connection strings private. Features using external providers also need their corresponding variables, including where applicable `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, and `GEOAPIFY_API_KEY`. Check the relevant integration source for its exact configuration before enabling it.

### Start the API

```bash
npm run dev
```

The development script loads `.env`; the server listens at **http://localhost:4000**. For a production-style start, load the environment variables in the process environment, then run:

```bash
npm start
```

MongoDB and Redis connections are initialized at startup. Both services must be available for the backend to start successfully. The frontend origin defaults to `http://localhost:5173`; set `FRONTEND_URL` to the exact frontend origin for your deployment. CORS allows credentials for that origin.

## 🗺️ API map

HTTP endpoints are grouped under `/api`:

| Base path | Area |
| --- | --- |
| `/api/auth` | Registration, login, Google login, session, profiles, password reset, logout, account deletion |
| `/api/donors` | Donor profiles, location, nearby donors, and administrator user operations |
| `/api/blood-banks` | Blood bank profiles, inventory, nearby banks, incoming and outgoing requests, demand prediction |
| `/api/hospitals` | Hospital profiles, emergency capacity, doctors, services, facilities, and hospital administration |
| `/api/blood-requests` | Delivery partner requests, active and completed deliveries, journey and pickup confirmation |
| `/api/delivery-requests` | Pending delivery work, accept/decline, delivery journey, and confirmation |
| `/api/delivery-partners` | Delivery partner registration and profile workflows |
| `/api/appointments` | Appointment booking, personal history, and hospital appointment management |
| `/api/notifications` | Notification workflows |
| `/api/enquiries` | Enquiries |
| `/api/support-tickets` | Support tickets and attachments |
| `/api/geocoding` | Geocoding utilities |
| `/api/admin` | Dashboard statistics, pending registrations, and platform growth |

Routes use authentication and role checks where configured. Consult each file in `routes/` for the available methods, parameters, and access requirements; this overview is not a substitute for endpoint-level API documentation.

## 🔐 Sessions and live connections

HTTP authentication uses a signed `sid` cookie backed by Redis. Socket.IO applies the same session check when a client connects. Authorized connections are assigned role-specific rooms so the application can deliver updates to the relevant users, blood banks, and delivery partners. Configure the frontend origin and cookie signing secret consistently across environments.

## 🧩 Repository notes

- `npm run dev` uses Node's `--env-file=.env` option.
- Uploaded files are handled through dedicated Multer middleware; media configuration is in `config/cloudinary.js`.
- Location helpers use Geoapify when configured. AI demand prediction is implemented through the Groq SDK in `services/ai.service.js` and requires provider access.
- There is no API specification or test script declared in this backend's `package.json` at the time this README was written.

## 🤝 Contributing

1. Create a focused branch for your change.
2. Keep secrets and local `.env` files out of commits.
3. Follow the existing route, controller, model, and middleware structure.
4. Document new environment variables and API behavior alongside the implementation.
5. Before opening a pull request, run the checks appropriate to the change and describe what you verified.

---

<p align="center"><strong>LifeLink — helping communities coordinate blood support when it matters.</strong></p>
