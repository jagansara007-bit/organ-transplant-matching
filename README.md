# Organ Transplant Matching System

A high-performance, full-stack Organ Transplant Matching and Cold-Chain Allocation System built with Node.js, Express, TypeScript, React 18, PostgreSQL 15, Redis 7, and Docker Compose.

---

## 🏛️ System Architecture Overview

```
                        +----------------------------+
                        |   React 18 + Vite (TS)     |
                        |   Port 3000 (Glassmorphic) |
                        +--------------+-------------+
                                       |
                                       v
                        +----------------------------+
                        | Express + Node.js (TS) API |
                        | Port 5000 (Zod Validated)  |
                        +-------+------------+-------+
                                |            |
                 +--------------+            +--------------+
                 |                                          |
                 v                                          v
    +------------------------+                  +-----------------------+
    |  PostgreSQL 15 DB      |                  |  Redis 7 Cache        |
    |  Port 5432 (Healthcheck)|                 |  Port 6379            |
    +------------------------+                  +-----------------------+
```

### Key Technical Highlights
- **PostgreSQL 15 Database**: Automated schema migration runner (`backend/src/db/migrate.ts`) and idempotent seeder (`backend/src/db/seed.ts`).
- **Redis 7 In-Memory Cache**: High-throughput queue ready for real-time donor notification broadcasts.
- **Express + TypeScript Backend**: Strict Zod schema validation middleware, layered MVC architecture, multi-factor matching scoring algorithm.
- **React 18 + Vite Frontend**: Glassmorphic dark theme, sticky tabbed navigation, live progress bar breakdowns, and toast notifications.
- **Docker Compose Orchestration**: Single-command container deployment with service healthchecks and volume persistence.

---

## 🚀 Quick Start Instructions

### Prerequisites
- [Docker & Docker Compose](https://docs.docker.com/get-docker/) installed.

### 1. Launch the Full Stack with Docker Compose
From the project root directory, run:

```bash
docker-compose up --build
```

### 2. Access Local Services
- **Frontend Medical Dashboard**: [http://localhost:3000](http://localhost:3000)
- **Backend API Service**: [http://localhost:5000/api](http://localhost:5000/api)
- **System Health Monitor**: [http://localhost:5000/api/health](http://localhost:5000/api/health)
- **Find Matches API**: [http://localhost:5000/api/matches/find](http://localhost:5000/api/matches/find)

---

## 🧪 Local Script & Database Commands

```bash
# Run Database Schema Migrations
npm --prefix backend run db:migrate

# Seed Realistic Donors & Waitlist Recipients
npm --prefix backend run db:seed

# Type Check Backend & Frontend
npm --prefix backend run type-check
npm --prefix frontend run type-check

# Run End-to-End Smoke Verification
npx ts-node scripts/verify-demo.ts
```

---

## 🎤 5-Minute Live Demo Walkthrough Script

*Designed for technical evaluation and executive presentation.*

### Minute 0:00 - 1:00 | Architecture & Infrastructure Readiness
- **Visual**: Navigate to tab **"System Health"** on [http://localhost:3000](http://localhost:3000).
- **Talking Point**: *"Welcome to the Organ Transplant Matching System. As you can see on our Infrastructure Health Monitor, our stack runs as isolated containerized microservices orchestrated via Docker Compose. The backend automatically executes transactional PostgreSQL migrations on startup, verifying DB connection pools and Redis 7 ping health checks before serving traffic."*

### Minute 1:00 - 2:00 | Donor & Recipient Registry
- **Visual**: Navigate to **"Donor Registry"** and register a new donor (`Dr. Alex Vance`, `O+`, `Kidney`, `HLA-A2, HLA-B7`), then navigate to **"Recipient List"** and view candidate waitlist priorities.
- **Talking Point**: *"Our registration workflow enforces strict Zod schema validation. Candidates are indexed with blood type compatibility matrix metadata, organ types, wait time days, and urgent severity classifications (CRITICAL, HIGH, MEDIUM, LOW) following UNOS guidelines."*

### Minute 2:00 - 3:30 | Algorithmic Compatibility Engine
- **Visual**: Navigate to **"Matching Engine"** and click **"Run Matching Engine"**.
- **Talking Point**: *"When we execute the matching engine, our algorithm computes a weighted multi-factorial compatibility score:*
  1. **Blood Group Compatibility (40%)**: Strict universal donor rules and exact/compatible blood type matrix checks.
  2. **Organ Type Match (40%)**: Hard constraint on required vs donated organ.
  3. **HLA Antigen Tissue Match (10%)**: Quantitative ratio of matching human leukocyte antigens.
  4. **Urgency Level & Wait Time Priority (10%)**: Weighted severity escalation to prioritize critical patients awaiting transplant.
  *Notice the dynamic progress bar breakdown detailing exact point contributions."*

### Minute 3:30 - 5:00 | Match Acceptance & Cold-Chain Logistics Audit
- **Visual**: Click **"Accept Match"** on candidate #1, which automatically routes to **"Logistics & Audit"**. Click **"Dispatch Shipment"** (`in_transit`) and **"Confirm Delivery"** (`delivered`).
- **Talking Point**: *"Accepting a match atomically marks the recipient as matched and creates a regulatory allocation audit record. Our cold-chain logistics tracker monitors shipment status from dispatch to delivery with full regulatory compliance traceability."*

---

## 📑 API Reference Table

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Multi-service health monitoring (API, DB, Redis) |
| `POST` | `/api/donors/register` | Register new organ donor |
| `GET` | `/api/donors` | Fetch all registered donors |
| `POST` | `/api/recipients/register` | Register new waitlist candidate |
| `GET` | `/api/recipients` | Fetch waiting candidates ordered by urgency |
| `GET` | `/api/matches/find` | Execute multi-factorial matching algorithm |
| `POST` | `/api/matches/:id/accept` | Accept match proposal and lock candidate |
| `POST` | `/api/allocations/allocate` | Create organ transport allocation record |
| `PATCH` | `/api/allocations/:id/logistics` | Update cold-chain status (`pending` → `in_transit` → `delivered`) |
| `GET` | `/api/allocations` | Audit report of active allocations |
