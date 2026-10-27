﻿# 🩺 LifeLink

### AI-Powered Healthcare & Emergency Assistance System

**Connecting patients, hospitals, doctors, blood banks, donors, and
delivery partners --- when every moment matters.**

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?style=for-the-badge&logo=socketdotio&logoColor=white)
------------------------------------------------------------------------

## 🌟 Overview

**LifeLink** is a healthcare coordination platform designed to make
essential healthcare services easier to discover and coordinate from one
place. It goes beyond blood donation by bringing together **doctor
appointments, hospital information, emergency capacity, blood requests,
donor discovery, delivery coordination, and medicine price comparison**
in a unified experience.

During an emergency, people may need to contact multiple relatives to
find a blood donor or visit several hospitals before discovering whether
an appropriate facility is available. LifeLink aims to reduce this
coordination burden by helping users find relevant services and follow
requests through a more organized digital workflow.

The platform provides separate experiences for patients, hospitals,
blood banks, delivery partners, and administrators. It also includes an
AI-based blood-demand prediction capability intended to help blood banks
plan inventory more effectively.

> **Our mission:** Make healthcare resources easier to find, healthcare
> workflows easier to coordinate, and critical information easier to
> access.

## 🚨 The Problem

Healthcare coordination can become fragmented when people need help
quickly:

-   🩸 **Finding blood:** Families may have to call relatives, send
    messages, or post on social media to locate a suitable blood group.
-   🏥 **Finding hospital resources:** People may struggle to identify
    nearby hospitals and understand reported bed or ICU availability.
-   👨‍⚕️ **Accessing doctors:** Patients need a clear way to discover
    doctors, check availability, and book appointments.
-   🚑 **Coordinating delivery:** Blood requests can involve multiple
    parties, making status visibility and delivery coordination
    important.
-   💊 **Comparing medicine prices:** Patients may need to compare
    prices across available medicine sources instead of checking each
    source individually.
-   📊 **Planning blood inventory:** Blood banks can benefit from using
    historical demand data to anticipate future requirements.

LifeLink brings these related workflows together instead of treating
each need as a completely separate experience.

## 💡 Our Solution

LifeLink offers a connected healthcare workflow with features such as:

-   Discovering nearby hospitals, blood banks, and donors using
    location-based search.
-   Viewing hospital information, reported capacity, emergency status,
    doctors, and services.
-   Booking appointments with doctors based on their configured
    availability.
-   Creating and tracking blood requests.
-   Coordinating blood-bank processing and delivery-partner workflows.
-   Receiving real-time updates through Socket.IO where implemented.
-   Supporting blood banks with AI-based blood-demand prediction.
-   Comparing medicine prices across supported sources.
-   Managing notifications, enquiries, and support tickets.

**Important:** Hospital capacity, stock, and emergency information
depend on the data supplied and maintained by participating facilities.
LifeLink should not be treated as a guarantee of live clinical capacity
or a substitute for contacting emergency services.

## ✨ Key Features

### 🩸 1. Blood Request & Blood Bank Coordination

-   Create blood requests with relevant blood group, component, and unit
    details.
-   Discover nearby blood banks using location-based search.
-   Support blood-bank inventory management and request-processing
    workflows.
-   Track request status as it progresses through the configured
    workflow.
-   Support donor discovery when suitable blood is not available through
    the initial route.
-   Coordinate dispatch and delivery workflows with delivery partners.

### 🤖 2. AI-Based Blood Demand Prediction

LifeLink includes an AI-based blood-demand prediction capability
intended to help blood banks anticipate future requirements and plan
inventory.

Potential benefits include:

-   Identifying demand patterns from available historical data.
-   Supporting blood-group or component-level planning when the data
    supports it.
-   Helping staff identify potential shortages earlier.
-   Supporting better-informed inventory decisions.

Prediction quality depends on the data, model, and evaluation process.
The prediction is decision support, not a guarantee of future demand or
a replacement for blood-bank expertise.

### 🏥 3. Hospital Discovery & Capacity Information

-   Discover nearby hospitals using location information.
-   View hospital profiles and available services.
-   Present reported bed-capacity information, including configured
    categories such as general wards, private rooms, and ICU beds.
-   Show the hospital's emergency status when provided.
-   Help users compare relevant hospital information before contacting a
    facility.

Capacity and emergency status should be kept up to date by authorized
hospital staff. Users should confirm availability directly with the
hospital, particularly during emergencies.

### 👨‍⚕️ 4. Doctor Discovery & Appointment Booking

-   Browse doctors associated with hospitals.
-   View specialties, experience, consultation fees, and configured
    availability.
-   Book appointments based on the doctor's availability and the
    application's booking rules.
-   Let hospital operators review and manage appointment workflows.
-   View appointment status and appointment history.

### 🚚 5. Delivery Coordination & Tracking

-   Support delivery-partner workflows for blood requests.
-   Assign or offer delivery work according to the configured dispatch
    process.
-   Track delivery progress through status updates.
-   Support pickup and delivery confirmation using OTP-assisted
    workflows where configured.
-   Send relevant real-time updates to connected users and delivery
    partners.

### 📍 6. Location-Based Discovery

-   Work with geographical coordinates to discover nearby healthcare
    resources.
-   Support nearby donor, hospital, and blood-bank searches.
-   Use geospatial database queries where configured.
-   Use a geocoding provider for supported location-related workflows.

Location results depend on the accuracy and freshness of stored
coordinates and provider data.

### 💊 7. Medicine Price Comparison

LifeLink extends beyond blood workflows with medicine price comparison
across supported sources. The goal is to help users review available
price information more conveniently.

Displayed prices, availability, and product details depend on the
integrated sources and should be verified before purchase. This feature
does not replace medical advice or a prescription from a qualified
professional.

### 🔔 8. Notifications & Support

-   Notifications for relevant platform events.
-   Enquiry handling.
-   Support tickets and related workflows.
-   Administrator tools for reviewing platform activity and
    registrations.

### 🔐 9. Role-Based Experiences & Sessions

LifeLink supports distinct workflows for different platform roles:

  -----------------------------------------------------------------------
  Role                                Main responsibilities
  ----------------------------------- -----------------------------------
  **Patient / User**                  Discover healthcare resources, book
                                      appointments, create blood
                                      requests, and follow request
                                      progress

  **Donor**                           Maintain donor information and
                                      participate in donor-discovery
                                      workflows

  **Hospital**                        Manage hospital information,
                                      doctors, services, appointments,
                                      and reported capacity

  **Blood Bank**                      Manage inventory, process blood
                                      requests, and use demand-prediction
                                      functionality

  **Delivery Partner**                Handle assigned delivery work and
                                      update delivery progress

  **Administrator**                   Review registrations and access
                                      administrative workflows
  -----------------------------------------------------------------------

Authentication and authorization should be enforced by the backend for
protected routes and operations. The exact permissions depend on each
route's middleware and controller implementation.

## 🔄 Example Workflows

### Blood request workflow

``` text
User creates a blood request
          ↓
Request is processed by the platform
          ↓
Blood bank reviews availability and request
          ↓
Request is accepted and prepared
          ↓
Delivery workflow is initiated, when applicable
          ↓
Delivery partner updates progress
          ↓
Pickup / delivery confirmation
          ↓
Request is completed
```

The actual transitions depend on request status, blood-bank decisions,
inventory, and delivery configuration. Donor discovery may be used when
the required blood is unavailable through the initial route.

### Appointment workflow

``` text
User discovers a hospital and doctor
          ↓
Reviews configured doctor availability
          ↓
Requests an appointment
          ↓
Backend checks availability and existing bookings
          ↓
Appointment is created with a time and status
          ↓
User and hospital can review appointment details
```

### Hospital capacity workflow

``` text
Hospital operator updates capacity information
          ↓
Backend validates and stores the update
          ↓
Hospital profile / capacity view reflects the data
          ↓
Users can review the reported availability
          ↓
User contacts the hospital to confirm urgent needs
```

## 🧱 Technology Stack

  -----------------------------------------------------------------------
  Layer                   Technologies            Purpose
  ----------------------- ----------------------- -----------------------
  **Frontend**            React.js, Vite,         User interfaces and
                          Tailwind CSS            role-specific
                                                  dashboards

  **Backend**             Node.js, Express 5      REST API and
                                                  application workflows

  **Database**            MongoDB, Mongoose       Users, hospitals,
                                                  doctors, appointments,
                                                  requests, and related
                                                  records

  **Session storage**     Redis                   Server-side session
                                                  data

  **Real-time             Socket.IO               Live events for
  communication**                                 supported workflows

  **Media uploads**       Multer, Cloudinary      File handling and cloud
                                                  media storage

  **AI integration**      AI SDK, Groq provider   AI-powered blood-demand
                          integration             prediction workflow

  **Authentication        Google Auth Library     Supported Google
  integration**                                   authentication
                                                  workflows

  **Geocoding**           Geoapify integration    Supported location and
                                                  geocoding features

  **Email**               Resend                  Email workflows where
                                                  configured

  **Validation /          Zod, DOMPurify          Validation and
  sanitization**                                  sanitization in the
                                                  relevant application
                                                  flows

  **Development tools**   Git, GitHub, Postman,   Version control and API
                          VS Code                 development/testing
  -----------------------------------------------------------------------

The backend's `package.json` lists the packages above. Frontend
dependencies and any additional ML libraries should be documented from
their respective project manifests. AI behavior depends on the
implemented service, configured model, available data, and provider
credentials.

## 🏗️ Backend Architecture

The backend is organized into routes, controllers, models, middleware,
configuration, services, and utility modules.

``` text
Client Applications
       │
       ├──────────── REST API requests ────────────┐
       │                                           ↓
       └──────────── Socket.IO connection ───> Node.js / Express
                                                   │
                                  ┌────────────────┼────────────────┐
                                  ↓                ↓                ↓
                              Middleware       Controllers      Socket.IO
                          Authentication      & workflows      event rooms
                          Role checks              │
                                                   ↓
                                  ┌────────────────┼────────────────┐
                                  ↓                ↓                ↓
                               MongoDB           Redis          Integrations
                              Application        Sessions      AI / Email /
                                 data                          Media / Maps
```

### Backend repository structure

``` text
backend/
├── app.js
├── config/
│   ├── mongoose.js
│   ├── redis.js
│   └── cloudinary.js
├── controllers/
├── middleware/
├── models/
├── routes/
├── services/
├── template/
├── utils/
└── validators/
```

The structure above is a high-level overview; individual files may vary
as the project evolves.

### REST API areas

The backend mounts API route groups under `/api`:

  -----------------------------------------------------------------------
  Base path                           Responsibility
  ----------------------------------- -----------------------------------
  `/api/auth`                         Registration, login, sessions,
                                      profiles, password reset, logout,
                                      and account workflows

  `/api/donors`                       Donor profiles, location, nearby
                                      discovery, and related workflows

  `/api/blood-banks`                  Blood-bank profiles, inventory,
                                      requests, nearby discovery, and
                                      demand prediction

  `/api/hospitals`                    Hospital profiles, doctors,
                                      services, facilities, capacity, and
                                      hospital workflows

  `/api/blood-requests`               Blood-request and related delivery
                                      workflows

  `/api/delivery-requests`            Delivery work, acceptance, status
                                      updates, and confirmation

  `/api/delivery-partners`            Delivery-partner registration and
                                      profile workflows

  `/api/appointments`                 Appointment booking, history, and
                                      hospital appointment management

  `/api/notifications`                Notification workflows

  `/api/enquiries`                    Enquiries

  `/api/support-tickets`              Support tickets and attachments

  `/api/geocoding`                    Geocoding utilities

  `/api/admin`                        Administrative statistics,
                                      registration reviews, and
                                      platform-management workflows
  -----------------------------------------------------------------------

Consult the route files for the exact HTTP methods, request schemas, and
authorization rules. This table is an overview rather than a complete
API specification.

## ⚡ Real-Time Communication

LifeLink uses Socket.IO for supported live workflows.

The backend checks the session during Socket.IO connection setup and
associates authorized clients with role-specific rooms, such as user,
blood-bank, and delivery-partner rooms. This allows the application to
send relevant events to connected clients.

The current backend's Socket.IO role checks should be reviewed whenever
new roles or workflows are added. In particular, ensure hospital and
administrator socket access is explicitly authorized if those roles
require live events.

## 🔒 Security Considerations

Security is essential because LifeLink handles personal and
healthcare-related coordination data.

-   Use signed cookies and server-side sessions over HTTPS in
    production.
-   Keep session secrets, database URLs, provider API keys, and
    credentials in environment variables.
-   Enforce authorization on the server for every protected action.
-   Validate incoming request data and sanitize fields where
    appropriate.
-   Restrict CORS to trusted frontend origins.
-   Apply secure cookie settings appropriate to the deployed domains.
-   Protect file uploads with type, size, and authorization checks.
-   Avoid logging passwords, session IDs, tokens, or other sensitive
    information.
-   Use least-privilege database credentials and restrict access to
    infrastructure services.
-   Review rate limits, audit logging, and operational monitoring before
    production use.

LifeLink is a coordination platform; it does not replace professional
medical judgment, emergency services, blood-bank eligibility checks, or
hospital confirmation.

## 🖥️ Requirements

For local backend development, you need:

-   Node.js compatible with the project's dependencies.
-   npm.
-   A reachable MongoDB instance.
-   A reachable Redis instance.
-   Provider credentials for integrations you want to use.
-   The frontend repository if you want to run the full application.

## 🚀 Getting Started

### 1. Clone the repository

``` bash
git clone <YOUR_BACKEND_REPOSITORY_URL>
cd Lifelink_backend
```

Replace the placeholder with your actual repository URL.

### 2. Install dependencies

``` bash
npm install
```

### 3. Configure environment variables

Create a local `.env` file in the backend root. The following names
reflect the backend configuration shown in the project; verify any
additional provider-specific variables in the relevant files.

``` env
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

``` bash
npm run dev
```

Production-style start:

``` bash
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

## ☁️ Deployment Notes

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

## 🧪 Testing Checklist

Before a release, verify the workflows that apply to the current
implementation:

-   [ ] User registration, login, logout, and session expiration.
-   [ ] Role-based access to protected endpoints.
-   [ ] Donor registration, location updates, and nearby discovery.
-   [ ] Blood-bank inventory updates and request status transitions.
-   [ ] Blood requests when stock is available and when it is
    unavailable.
-   [ ] Appointment booking with unavailable doctors and already-booked
    times.
-   [ ] Hospital capacity and emergency-status updates.
-   [ ] Delivery assignment, status updates, and pickup/delivery
    confirmation.
-   [ ] Socket.IO authentication and event-room authorization.
-   [ ] File uploads and provider integrations.
-   [ ] AI demand-prediction behavior with representative data.
-   [ ] Medicine price comparison results and source freshness.
-   [ ] Production CORS, cookies, and environment variables.

## 🛣️ Future Improvements

Potential areas for further development include:

-   More hospital and blood-bank integrations.
-   Better demand forecasting and model evaluation.
-   Stronger validation of inventory and capacity updates.
-   Improved notifications and delivery-status visibility.
-   More comprehensive API documentation and automated tests.
-   Audit trails for sensitive operations.
-   Monitoring, alerting, and production-readiness improvements.
-   Better accessibility and multilingual support.

These are potential enhancements, not claims that every item is already
implemented.

## 🤝 Contributing

Contributions and feedback are welcome.

1.  Create a focused branch for your change.
2.  Keep changes consistent with the existing route/controller/model
    structure.
3.  Never commit secrets or local environment files.
4.  Document new environment variables and endpoint behavior.
5.  Test the affected workflows before submitting a pull request.
6.  Describe what changed and which checks were performed.

## ⚠️ Disclaimer

LifeLink is designed to support healthcare discovery and coordination.
It is not a substitute for emergency medical services, clinical advice,
verified blood-bank procedures, or direct confirmation from hospitals.
Blood eligibility, stock, hospital capacity, medicine availability, and
pricing must be confirmed with the relevant provider. AI predictions are
estimates and should be reviewed by qualified personnel.

------------------------------------------------------------------------

### ❤️ LifeLink

**Connecting every link in healthcare.**

*Built to help people find the right healthcare resource when it matters
most.*