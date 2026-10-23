::: {align="center"}

# ðŸ©º LifeLink

### 💊 7. Medicine Price Comparison`r`n`r`nMedicine price comparison is planned for a future release. LifeLink aims to make it easier for users to review medicine prices from multiple sources once this feature is developed and integrated.`r`n`r`n### ðŸ”” 8. Notifications & Support

- Notifications for relevant platform events.
- Enquiry handling.
- Support tickets and related workflows.
- Administrator tools for reviewing platform activity and
  registrations.

### ðŸ” 9. Role-Based Experiences & Sessions

LifeLink supports distinct workflows for different platform roles:

---

Role Main responsibilities

---

**Patient / User** Discover healthcare resources, book
appointments, create blood
requests, and follow request
progress

**Donor** Maintain donor information and
participate in donor-discovery
workflows

**Hospital** Manage hospital information,
doctors, services, appointments,
and reported capacity

**Blood Bank** Manage inventory, process blood
requests, and use demand-prediction
functionality

**Delivery Partner** Handle assigned delivery work and
update delivery progress

**Administrator** Review registrations and access
administrative workflows

---

Authentication and authorization should be enforced by the backend for
protected routes and operations. The exact permissions depend on each
route's middleware and controller implementation.

## ðŸ”„ Example Workflows

### Blood request workflow

```text
User creates a blood request
          â†“
Request is processed by the platform
          â†“
Blood bank reviews availability and request
          â†“
Request is accepted and prepared
          â†“
Delivery workflow is initiated, when applicable
          â†“
Delivery partner updates progress
          â†“
Pickup / delivery confirmation
          â†“
Request is completed
```

The actual transitions depend on request status, blood-bank decisions,
inventory, and delivery configuration. Donor discovery may be used when
the required blood is unavailable through the initial route.

### Appointment workflow

```text
User discovers a hospital and doctor
          â†“
Reviews configured doctor availability
          â†“
Requests an appointment
          â†“
Backend checks availability and existing bookings
          â†“
Appointment is created with a time and status
          â†“
User and hospital can review appointment details
```

### Hospital capacity workflow

```text
Hospital operator updates capacity information
          â†“
Backend validates and stores the update
          â†“
Hospital profile / capacity view reflects the data
          â†“
Users can review the reported availability
          â†“
User contacts the hospital to confirm urgent needs
```

## ðŸ§± Technology Stack

---

Layer Technologies Purpose

---

**Frontend** React.js, Vite, User interfaces and
Tailwind CSS role-specific
dashboards

**Backend** Node.js, Express 5 REST API and
application workflows

**Database** MongoDB, Mongoose Users, hospitals,
doctors, appointments,
requests, and related
records

**Session storage** Redis Server-side session
data

**Real-time Socket.IO Live events for
communication** supported workflows

**Media uploads** Multer, Cloudinary File handling and cloud
media storage

**AI integration** AI SDK, Groq provider AI-powered blood-demand
integration prediction workflow

**Authentication Google Auth Library Supported Google
integration** authentication
workflows

**Geocoding** Geoapify integration Supported location and
geocoding features

**Email** Resend Email workflows where
configured

**Validation / Zod, DOMPurify Validation and
sanitization** sanitization in the
relevant application
flows

**Development tools** Git, GitHub, Postman, Version control and API
VS Code development/testing

---

The backend's `package.json` lists the packages above. Frontend
dependencies and any additional ML libraries should be documented from
their respective project manifests. AI behavior depends on the
implemented service, configured model, available data, and provider
credentials.

## ðŸ—ï¸ Backend Architecture

The backend is organized into routes, controllers, models, middleware,
configuration, services, and utility modules.

```text
Client Applications
       â”‚
       â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ REST API requests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
       â”‚                                           â†“
       â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Socket.IO connection â”€â”€â”€> Node.js / Express
                                                   â”‚
                                  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                                  â†“                â†“                â†“
                              Middleware       Controllers      Socket.IO
                          Authentication      & workflows      event rooms
                          Role checks              â”‚
                                                   â†“
                                  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                                  â†“                â†“                â†“
                               MongoDB           Redis          Integrations
                              Application        Sessions      AI / Email /
                                 data                          Media / Maps
```

### Backend repository structure

```text
backend/
â”œâ”€â”€ app.js
â”œâ”€â”€ config/
â”‚   â”œâ”€â”€ mongoose.js
â”‚   â”œâ”€â”€ redis.js
â”‚   â””â”€â”€ cloudinary.js
â”œâ”€â”€ controllers/
â”œâ”€â”€ middleware/
â”œâ”€â”€ models/
â”œâ”€â”€ routes/
â”œâ”€â”€ services/
â”œâ”€â”€ template/
â”œâ”€â”€ utils/
â””â”€â”€ validators/
```

The structure above is a high-level overview; individual files may vary
as the project evolves.

### REST API areas

The backend mounts API route groups under `/api`:

---

Base path Responsibility

---

`/api/auth` Registration, login, sessions,
profiles, password reset, logout,
and account workflows

`/api/donors` Donor profiles, location, nearby
discovery, and related workflows

`/api/blood-banks` Blood-bank profiles, inventory,
requests, nearby discovery, and
demand prediction

`/api/hospitals` Hospital profiles, doctors,
services, facilities, capacity, and
hospital workflows

`/api/blood-requests` Blood-request and related delivery
workflows

`/api/delivery-requests` Delivery work, acceptance, status
updates, and confirmation

`/api/delivery-partners` Delivery-partner registration and
profile workflows

`/api/appointments` Appointment booking, history, and
hospital appointment management

`/api/notifications` Notification workflows

`/api/enquiries` Enquiries

`/api/support-tickets` Support tickets and attachments

`/api/geocoding` Geocoding utilities

`/api/admin` Administrative statistics,
registration reviews, and
platform-management workflows

---

Consult the route files for the exact HTTP methods, request schemas, and
authorization rules. This table is an overview rather than a complete
API specification.

## âš¡ Real-Time Communication

LifeLink uses Socket.IO for supported live workflows.

The backend checks the session during Socket.IO connection setup and
associates authorized clients with role-specific rooms, such as user,
blood-bank, and delivery-partner rooms. This allows the application to
send relevant events to connected clients.

The current backend's Socket.IO role checks should be reviewed whenever
new roles or workflows are added. In particular, ensure hospital and
administrator socket access is explicitly authorized if those roles
require live events.

## ðŸ”’ Security Considerations

Security is essential because LifeLink handles personal and
healthcare-related coordination data.

- Use signed cookies and server-side sessions over HTTPS in
  production.
- Keep session secrets, database URLs, provider API keys, and
  credentials in environment variables.
- Enforce authorization on the server for every protected action.
- Validate incoming request data and sanitize fields where
  appropriate.
- Restrict CORS to trusted frontend origins.
- Apply secure cookie settings appropriate to the deployed domains.
- Protect file uploads with type, size, and authorization checks.
- Avoid logging passwords, session IDs, tokens, or other sensitive
  information.
- Use least-privilege database credentials and restrict access to
  infrastructure services.
- Review rate limits, audit logging, and operational monitoring before
  production use.

LifeLink is a coordination platform; it does not replace professional
medical judgment, emergency services, blood-bank eligibility checks, or
hospital confirmation.

## ðŸ–¥ï¸ Requirements

For local backend development, you need:

- Node.js compatible with the project's dependencies.
- npm.
- A reachable MongoDB instance.
- A reachable Redis instance.
- Provider credentials for integrations you want to use.
- The frontend repository if you want to run the full application.

## ðŸš€ Getting Started

### 1. Clone the repository

```bash
git clone <YOUR_BACKEND_REPOSITORY_URL>
cd Lifelink_backend
```

Replace the placeholder with your actual repository URL.

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a local `.env` file in the backend root. The following names
reflect the backend configuration shown in the project; verify any
additional provider-specific variables in the relevant files.

```env
# Database
DB_URL=mongodb_connection_string

# Redis sessions
REDIS_URL=redis_connection_string

# Signed cookies
mySecretKey=replace_with_a_long_random_secret

# Frontend origin used by CORS and Socket.IO
FRONTEND_URL=http://localhost:5173

# Add integration credentials when required
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
GEOAPIFY_API_KEY=
```

Use the exact MongoDB environment variable expected by
`config/mongoose.js`. If that file reads `MONGODB_URI` rather than
`DB_URL`, use `MONGODB_URI`. Likewise, add AI-provider and email
variables using the exact names read by their service modules.

**Never commit your `.env` file or real credentials to GitHub.** Keep
`.env` excluded by `.gitignore`.

### 4. Start the backend

Development:

```bash
npm run dev
```

Production-style start:

```bash
npm start
```

The backend's development command loads `.env` through Node's
`--env-file` option. The production command expects environment
variables to be supplied by the hosting platform.

The server should listen on `process.env.PORT` when deployed and may use
a local fallback such as `4000` during development. MongoDB and Redis
must be reachable if the application requires both during startup.

### 5. Run the frontend

Open a separate terminal in the frontend directory, install its
dependencies, and start it using the scripts defined in the frontend's
`package.json`.

Set the frontend API base URL to the backend URL for the environment you
are using. Configure CORS and cookie settings to match the frontend
origin.

## â˜ï¸ Deployment Notes

Before deploying:

1.  Provision MongoDB and Redis and verify connectivity from the hosting
    environment.
2.  Configure all required environment variables in the hosting
    dashboard.
3.  Set the backend start command to `npm start`.
4.  Ensure the HTTP server listens on `process.env.PORT`.
5.  Set `FRONTEND_URL` to the deployed frontend origin.
6.  Configure cookie security and cross-origin credentials for
    production.
7.  Configure Socket.IO's allowed origin to match the frontend.
8.  Confirm provider credentials and external API access.
9.  Test login, session persistence, appointments, blood requests,
    uploads, and real-time events after deployment.
10. Review logs for connection errors, failed integrations, and
    unexpected restarts.

Do not expose MongoDB or Redis publicly unless necessary and properly
secured. Prefer private networking where supported by the hosting
provider.

## ðŸ§ª Testing Checklist

Before a release, verify the workflows that apply to the current
implementation:

- [ ] User registration, login, logout, and session expiration.
- [ ] Role-based access to protected endpoints.
- [ ] Donor registration, location updates, and nearby discovery.
- [ ] Blood-bank inventory updates and request status transitions.
- [ ] Blood requests when stock is available and when it is
      unavailable.
- [ ] Appointment booking with unavailable doctors and already-booked
      times.
- [ ] Hospital capacity and emergency-status updates.
- [ ] Delivery assignment, status updates, and pickup/delivery
      confirmation.
- [ ] Socket.IO authentication and event-room authorization.
- [ ] File uploads and provider integrations.
- [ ] AI demand-prediction behavior with representative data.
- [ ] Medicine price comparison when the feature is developed.
- [ ] Production CORS, cookies, and environment variables.

## ðŸ›£ï¸ Future Improvements

Potential areas for further development include:

- More hospital and blood-bank integrations.
- Better demand forecasting and model evaluation.
- Stronger validation of inventory and capacity updates.
- Improved notifications and delivery-status visibility.
- More comprehensive API documentation and automated tests.
- Audit trails for sensitive operations.
- Monitoring, alerting, and production-readiness improvements.
- Better accessibility and multilingual support.

These are potential enhancements, not claims that every item is already
implemented.

## ðŸ¤ Contributing

Contributions and feedback are welcome.

1.  Create a focused branch for your change.
2.  Keep changes consistent with the existing route/controller/model
    structure.
3.  Never commit secrets or local environment files.
4.  Document new environment variables and endpoint behavior.
5.  Test the affected workflows before submitting a pull request.
6.  Describe what changed and which checks were performed.

## âš ï¸ Disclaimer

LifeLink is designed to support healthcare discovery and coordination.
It is not a substitute for emergency medical services, clinical advice,
verified blood-bank procedures, or direct confirmation from hospitals.
Blood eligibility, stock, hospital capacity, medicine availability, and
pricing must be confirmed with the relevant provider. AI predictions are
estimates and should be reviewed by qualified personnel.

---

::: {align="center"}

### â¤ï¸ LifeLink

**Connecting every link in healthcare.**

_Built to help people find the right healthcare resource when it matters
most._
:::

