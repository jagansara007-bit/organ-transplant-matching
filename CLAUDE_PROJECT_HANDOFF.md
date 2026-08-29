# NOTTO VitalSync - Organ Transplant Matching & Cold-Chain Logistics System

## 📌 Executive Summary
**NOTTO VitalSync** is an automated, high-resilience clinical platform designed to optimize organ transplant allocation and cold-chain logistics across Indian hospital networks. It replaces manual, error-prone coordination with a **deterministic 100-point multi-factorial matching algorithm**, **real-time IoT cold-chain telemetry**, **cryptographic 2-Factor Email OTP authorization (Port 465 SSL)**, and a **3-tier failover database architecture** (Cloud Supabase $\to$ Local PostgreSQL $\to$ In-Memory Standby Engine) to ensure **99.99% zero-downtime SLA**.

---

## 🛠️ Full Technology Stack

| Layer | Technologies Used |
|---|---|
| **Frontend UI** | React 18, TypeScript, Vite, TailwindCSS (v4+), Custom Glassmorphism, Material Symbols Outlined, Google Fonts (Plus Jakarta Sans, Inter) |
| **Backend REST Engine** | Node.js (v20+), Express.js, TypeScript, Helmet, CORS, Morgan, Express-Rate-Limit |
| **Data Validation** | Zod (strict runtime schema parsing on all POST/PATCH requests) |
| **2FA & Email Engine** | Nodemailer over **Direct SMTPS (Port 465 SSL)**, Cryptographic 6-digit PINs, Demo bypass `994012` |
| **Multi-Tier Database** | **Tier 1**: Cloud PostgreSQL (Supabase SSL) <br> **Tier 2**: Local PostgreSQL (`localhost:5432`) <br> **Tier 3**: In-Memory Standby Engine (Zero-Downtime Buffer) |
| **Security & Privacy** | SHA-256 Payload Integrity Hashing, Aadhaar Masking (`XXXX-XXXX-8921`), DPDP Act & THOA 2014 Form 8 Regulatory Compliance |

---

## 🧬 1. Deterministic 100-Point Matching Engine

Evaluates donor-recipient pairings in **under 2 milliseconds** (~800,000+ pairings/second) across 4 weighted clinical dimensions:

$$\text{Total Score} = S_{\text{Blood}} (40\text{ pts}) + S_{\text{Organ}} (40\text{ pts}) + S_{\text{HLA}} (10\text{ pts}) + S_{\text{Urgency}} (10\text{ pts})$$

1. **Blood Compatibility ($S_{\text{Blood}}$ — 40 pts)**:
   - Identical ABO: `40.0 pts` | Compatible non-identical (e.g. O- universal): `30.0 pts` | Incompatible: `0.0 pts` (hard filter).
2. **Organ Anatomical Match ($S_{\text{Organ}}$ — 40 pts)**:
   - Matching organ type: `40.0 pts` | Mismatch: `0.0 pts`.
3. **HLA Antigen Crossmatch ($S_{\text{HLA}}$ — 10 pts)**:
   - Evaluates HLA-A, HLA-B, HLA-DR loci match ratio: $\frac{\text{Matching Loci}}{\text{Assessed Loci}} \times 10.0\text{ pts}$.
4. **Clinical Urgency & Seniority ($S_{\text{Urgency}}$ — 10 pts)**:
   - Base Tier: `CRITICAL` (7.0), `HIGH` (5.0), `MEDIUM` (3.0), `LOW` (1.5).
   - Waitlist Seniority: $\min\left(\frac{\text{Wait Days}}{365} \times 3.0, 3.0\right)$.

---

## 🚚 2. Cold-Chain Logistics & Live IoT Telemetry

1. **Dynamic Sensor Telemetry**:
   - Storage Box Core Temperature (`2.0°C – 6.0°C` safe band with temperature spike breach simulator).
   - Ambient Cabin Temperature (`28.4°C`).
   - Carrier Battery Level (`94%`).
   - Live Transit GPS Coordinates & Speed (`420 km/h`, `8,450 ft` green corridor flight path).
2. **Organ-Specific Cold Ischemia Limit Countdown Timer**:
   - **Heart**: 4–6 hrs | **Liver**: 8–12 hrs | **Kidney**: 24–36 hrs | **Lungs**: 6–8 hrs.
   - Urgency color-coding: **Optimal (<50%)**, **Warning (50–85%)**, **Critical Breach (>85%)**.
3. **4-Stage Transit Checkpoints**:
   $$\text{Excision \& Retrieval} \longrightarrow \text{Green Corridor Air Transit} \longrightarrow \text{Hospital Reception} \longrightarrow \text{OT-4 Hand-off}$$
4. **NOTTO Form 8 Statutory Clearance**:
   - 2-Factor Email OTP verification required before statutory sign-off.
   - Hand-off confirmation action transitions status to `delivered` and finalizes logistics.

---

## 🛡️ 3. Multi-Tier Database Connection Pooling & Failover

```
                   ┌──────────────────────────────────────┐
                   │  Incoming Query / Allocation Request │
                   └──────────────────┬───────────────────┘
                                      │
                                      ▼
                        ┌───────────────────────────┐
                        │ Tier 1: Cloud PostgreSQL  │ ──(Success)──► [Live Cloud Supabase]
                        │   (Supabase Managed AWS)  │
                        └─────────────┬─────────────┘
                                      │ (Network/Connection Drop)
                                      ▼
                        ┌───────────────────────────┐
                        │ Tier 2: Local PostgreSQL  │ ──(Success)──► [Local Hospital Node]
                        │    (Port 5432 Fallback)   │
                        └─────────────┬─────────────┘
                                      │ (Offline/Air-gapped)
                                      ▼
                        ┌───────────────────────────┐
                        │ Tier 3: In-Memory Standby │ ──(Guaranteed)► [100% Zero-Downtime SLA]
                        │   (Zero-Downtime Engine)  │
                        └───────────────────────────┘
```

- **Mutation Write Queue Buffer**: Buffers write mutations (`INSERT`, `UPDATE`, `DELETE`) during offline standby and replays them upon database reconnection.
- **Zero Unhandled Promise Rejections**: Client error listeners isolate transient socket dropouts.

---

## 🔐 4. API Security Hardening & Rate Limiting

- **Rate Limiters (`express-rate-limit`)**:
  - `/api/auth/login`: 5 attempts / min.
  - `/api/auth/request-otp`: 3 requests / hour.
  - `/api/matches`: 100 requests / min.
  - `/api/*`: 300 requests / min.
- **Identity Privacy Masking**: Aadhaar numbers stored/displayed as `XXXX-XXXX-8921` (DPDP Act).
- **Forensic Audit Logger**:
  - Automatically generates **SHA-256 payload integrity hashes** for every action.
  - Captures `operator_name`, `operator_role`, `client_ip`, `timestamp`, `entity_type`, and `details`.

---

## 📡 5. Complete REST API Surface Reference

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/health` | Multi-tier health and infrastructure latency status | Public |
| `GET` | `/api/health/diagnostics` | Deep benchmark diagnostics & throughput test | Public |
| `POST` | `/api/auth/login` | Staff login returning signed JWT | Public |
| `POST` | `/api/auth/request-otp` | Sends 5-min cryptographic OTP over SMTPS Port 465 | Public |
| `POST` | `/api/auth/verify-otp` | Validates OTP / Demo bypass code (`994012`) | Public |
| `GET` | `/api/donors` | Retrieves registered donor records (masked Aadhaar) | `Bearer JWT` |
| `POST` | `/api/donors` | Enrolls new donor with Zod schema sanitization | `Bearer JWT` |
| `GET` | `/api/recipients` | Retrieves sorted waitlist candidate registry | `Bearer JWT` |
| `POST` | `/api/recipients` | Registers candidate with urgency rating | `Bearer JWT` |
| `GET` | `/api/matches` | Runs 100-point algorithm and returns scored pairings | `Bearer JWT` |
| `POST` | `/api/matches/:id/accept` | Surgeon accepts match & initializes logistics | `Bearer JWT` |
| `GET` | `/api/allocations` | Retrieves active cold-chain in-transit tracking feeds | `Bearer JWT` |
| `POST` | `/api/allocations/allocate` | Dispatches allograft with cold-chain telemetry | `Bearer JWT` |
| `PATCH` | `/api/allocations/:id/logistics` | Updates transit status & temperature | `Bearer JWT` |
| `POST` | `/api/allocations/:id/regulatory-approval` | Records 2FA Form 8 statutory sign-off | `Bearer JWT` |
| `GET` | `/api/allocations/audit-trail` | Returns forensic ledger with SHA-256 hashes | `Bearer JWT` |

---

## 🧪 6. Automated Resilience Test Results (`npm run test:resilience`)

```
========================================================================================
📊 PERFORMANCE & RESILIENCE TEST RESULTS SUMMARY
========================================================================================
┌─────────┬────────────────────────────────────────────┬──────────────┬─────────────────────────────────────────────┬───────────────────────────────────────┬──────────────────────────────────────┬──────────┐
│ (index) │ testName                                   │ category     │ metric                                      │ target                                │ result                               │ status   │
├─────────┼────────────────────────────────────────────┼──────────────┼─────────────────────────────────────────────┼───────────────────────────────────────┼──────────────────────────────────────┼──────────┤
│ 0       │ '1,000 Pairings Match Algorithm Benchmark' │ 'BENCHMARK'  │ '1.24 ms (8,06,452 pairings/sec)'           │ '< 150 ms'                            │ '1.24 ms (Optimal)'                  │ 'PASSED' │
│ 1       │ 'REST API Latency Distribution'            │ 'BENCHMARK'  │ 'Avg: 4.19ms | p50: 3.32ms | p95: 7.16ms'   │ 'p95 < 300 ms'                        │ 'p95 = 7.16 ms'                      │ 'PASSED' │
│ 2       │ 'Cloud DB Disconnect & Standby Cutover'    │ 'FAILOVER'   │ 'Cutover Tier: IN_MEMORY_STANDBY in 2.92ms' │ '< 500ms cutover & 0 HTTP 500s'       │ 'HTTP 200 OK (IN_MEMORY_STANDBY)'    │ 'PASSED' │
│ 3       │ '2FA Invalid PIN Rejection & Demo Bypass'  │ 'FAILOVER'   │ 'Rejects invalid PINs & Unlocks on 994012'  │ 'Zero False Positives & Bypass Ready' │ 'Invalid Blocked + 994012 Verified'  │ 'PASSED' │
│ 4       │ 'NOTTO Form 8 SHA-256 Audit Integrity'     │ 'COMPLIANCE' │ 'SHA-256: 9e0527fd09d06810...'              │ '64-char Hex Hash & Client IP Logged' │ 'Cryptographically Sealed (SHA-256)' │ 'PASSED' │
└─────────┴────────────────────────────────────────────┴──────────────┴─────────────────────────────────────────────┴───────────────────────────────────────┴──────────────────────────────────────┴──────────┘
```
