# GarageFlow — Automotive Garage Management System

GarageFlow is a modern, modular enterprise management platform designed specifically for automotive repair workshops, general mechanics, and electronic diagnostic garages. It provides full end-to-end lifecycle management covering client tracking, vehicle maintenance history, mechanic assignment, appointment scheduling, inventory and spare parts control, work orders, invoicing, and real-time KPI analytics.

---

## Architecture Overview

GarageFlow is built using a clean layered architecture with decoupled microservices orchestrated via Docker Compose:

- **Frontend**: React 18, Vite, Tailwind CSS, `i18next` (bilingual French / English), Axios, Lucide Icons, Recharts
- **Web Server / Reverse Proxy**: Nginx 1.27 (Alpine) serving SPA static assets and reverse-proxying `/api/` to backend
- **Backend**: Python 3.11/3.12, Flask 3.0 REST API (Application Factory pattern, Marshmallow schemas, SQLAlchemy ORM) & Gunicorn WSGI
- **Database**: PostgreSQL 16 (`garageflow_db`) with persistent Docker volume (`garageflow_pgdata`)
- **Authentication & Security**: JWT with role-based access control (`RESPONSABLE` / `MECANICIEN`), Bcrypt password hashing
- **Localization**: Native support for Tunisian automotive standards (immatriculation `123 TU 4567`, phone `+216` 8-digit validation, currency in `TND` with 3 decimals / millimes)

```
                             [ Client Browser ]
                                     |
                           http://localhost:8080
                                     |
                                     v
                  +-------------------------------------+
                  |   frontend: Nginx 1.27 (Alpine)     |
                  |   - Static SPA assets (React build) |
                  |   - Reverse proxy /api/             |
                  +-------------------------------------+
                                     |
                           http://backend:5000/api/
                           (Internal Docker Network)
                                     v
                  +-------------------------------------+
                  |   backend: Flask + Gunicorn WSGI    |
                  |   - REST API & JWT Auth             |
                  |   - Business services & validation  |
                  +-------------------------------------+
                                     |
                           PostgreSQL TCP:5432
                           (Internal Docker Network)
                                     v
                  +-------------------------------------+
                  |   db: PostgreSQL 16 (Alpine)        |
                  |   - Volume: garageflow_pgdata       |
                  |   - Host exposed port: 5433         |
                  +-------------------------------------+
```

---

## Project Structure

```
GarageFlow/
├── backend/                           # Flask REST API backend
│   ├── app/
│   │   ├── __init__.py                # Application factory (create_app)
│   │   ├── config.py                  # Environment-driven configurations
│   │   ├── extensions.py              # Extensions (SQLAlchemy, JWT, CORS, Bcrypt)
│   │   ├── models/                    # SQLAlchemy ORM models (9 entities)
│   │   ├── routes/                    # REST API blueprints
│   │   ├── schemas/                   # Marshmallow validation schemas
│   │   ├── services/                  # Business logic services
│   │   └── utils/                     # Exceptions, error handlers, response formatters
│   ├── Dockerfile                     # Multi-stage production Python image
│   ├── gunicorn.conf.py               # WSGI production server settings
│   ├── requirements.txt               # Production Python dependencies
│   ├── requirements-dev.txt           # Development and testing dependencies
│   └── tests/                         # Automated unit & integration tests (396 tests)
├── frontend/                          # React + Vite frontend SPA
│   ├── Dockerfile                     # Multi-stage build (Node 20 -> Nginx 1.27)
│   ├── nginx.conf                     # Nginx SPA fallback & API reverse proxy
│   ├── package.json                   # NPM dependencies & scripts
│   ├── src/                           # React components, pages, services, context, i18n
│   ├── tailwind.config.js             # Tailwind CSS styling configuration
│   └── vite.config.js                 # Vite bundler & vendor chunking
├── Docs/                              # Documentation, specifications, and UML diagrams
├── migrations/                        # Database schema versioning documentation
├── docker-compose.yml                 # Multi-container Docker orchestration
├── .dockerignore                      # Docker build exclusions
├── .gitignore                         # Git version control exclusions
├── .env.example                       # Template for environment configuration
└── README.md                          # Repository documentation
```

---

## Quick Start with Docker Compose (Recommended)

### 1. Prerequisites
- Docker Engine 24+ & Docker Compose v2.20+
- Host port `8080` free (configurable via `FRONTEND_PORT`)
- Host port `5433` free (configurable via `DB_HOST_PORT`)

### 2. Environment Configuration
Copy the configuration template:
```bash
cp .env.example .env
```
Ensure you provide secure random values for `SECRET_KEY`, `JWT_SECRET_KEY`, and `POSTGRES_PASSWORD`.

### 3. Build & Run Services
```bash
# Build images
docker compose build

# Start services in detached mode
docker compose up -d

# Verify health status of all containers
docker compose ps
```

### 4. Accessing the Application
- **Web Interface**: [http://localhost:8080](http://localhost:8080)
- **API Health Check**: [http://localhost:8080/api/v1/health](http://localhost:8080/api/v1/health)
- **PostgreSQL Database**: Accessible on host at `localhost:5433`

### 5. Managing Containers
```bash
# View live logs
docker compose logs -f

# Stop containers (preserves database data)
docker compose stop

# Restart containers
docker compose restart

# Full shutdown (preserves volume garageflow_pgdata)
docker compose down
```

---

## Local Development (Native Mode)

### Prerequisites
- Python 3.11+ or 3.12+
- Node.js 20+ & npm 10+
- PostgreSQL 16 (running on localhost:5432)

### Backend Setup
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install -r requirements-dev.txt

# Start Flask development server
flask --app "app:create_app()" run --port 5000
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
# Dev server runs on http://localhost:5173
```

---

## API Overview

All API endpoints follow RESTful conventions, return structured JSON, and require a JWT Bearer token in the `Authorization` header (except `/api/v1/auth/login` and `/api/v1/health`).

| Endpoint Prefix | Description | Access Role |
| :--- | :--- | :--- |
| `GET /api/v1/health` | Service health status and version | Public |
| `/api/v1/auth` | User login, token refresh, and profile (`/me`) | Public / Authenticated |
| `/api/v1/clients` | Client directory, contact details, history | Responsable, Mécanicien (Read) |
| `/api/v1/vehicules` | Vehicle registry, serial numbers, mileage | Responsable, Mécanicien (Read) |
| `/api/v1/mecaniciens` | Mechanic personnel, specialties, workloads | Responsable |
| `/api/v1/reparations` | Work orders, diagnostics, workflow status, parts | Responsable, Mécanicien |
| `/api/v1/pieces` | Spare parts catalog, inventory management, low-stock | Responsable, Mécanicien |
| `/api/v1/factures` | Invoice creation, payment tracking, totals | Responsable |
| `/api/v1/rendez-vous` | Appointment scheduling, calendar management | Responsable |
| `/api/v1/dashboard` | Workshop KPI summary, revenue metrics, alerts | Responsable |

---

## Automated Testing Suite

GarageFlow includes a comprehensive automated test suite guaranteeing business logic, validation rules, role permissions, and database constraints.

### Running Backend Tests
```bash
cd backend
source venv/bin/activate
pytest tests/ -v
```
- **396 unit & integration tests** passing (100% pass rate)
- Tests run against an isolated test database (`garageflow_test_db`) with safety guards preventing any execution on the live database.

### Running Frontend Build & Type Validation
```bash
cd frontend
npm run build
```
Validates Vite bundler compilation, vendor chunk optimization, and asset generation.

---

## Database Management & Persistence

- **Data Persistence**: Database storage is bound to the Docker named volume `garageflow_pgdata`, surviving container updates and restarts.
- **Strict Isolation**: Host PostgreSQL (`localhost:5432`) and Docker PostgreSQL (`localhost:5433`) run completely isolated without port or data collisions.
- **Non-destructive Invariance**: Schema migrations strictly follow non-destructive transactional scripts documented in `migrations/README.md`.

---

## Screenshots

*(Screenshots of the Dashboard, Repair Workflows, Invoicing, and Inventory Management will be added here).*

---

## License

This project is currently proprietary. License terms to be confirmed prior to public distribution.
