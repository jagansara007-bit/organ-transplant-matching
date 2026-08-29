-- ============================================================================
-- STARTER DATABASE SCHEMA: Organ Transplant Matching & Regulatory Allocation System
-- Tables: hospitals, hospital_users, donors, recipients, matches, allocations, regulatory_approvals, audit_log
-- Views: active_donors, active_recipients, pending_allocations
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. HOSPITALS TABLE
CREATE TABLE IF NOT EXISTS hospitals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    hospital_code VARCHAR(50) UNIQUE NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    verification_status VARCHAR(50) NOT NULL DEFAULT 'verified' CHECK (verification_status IN ('verified', 'pending', 'suspended')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. HOSPITAL USERS TABLE
CREATE TABLE IF NOT EXISTS hospital_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    medical_license VARCHAR(100),
    role VARCHAR(50) NOT NULL CHECK (role IN ('ADMIN', 'TRANSPLANT_SURGEON', 'REGULATORY_OFFICER', 'hospital_admin', 'transplant_surgeon', 'regulatory_officer')),
    is_authorized BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. DONORS TABLE
CREATE TABLE IF NOT EXISTS donors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id UUID REFERENCES hospitals(id) ON DELETE SET NULL,
    full_name VARCHAR(255) NOT NULL,
    donor_type VARCHAR(50) NOT NULL CHECK (donor_type IN ('DECEASED', 'LIVING_FAMILY')),
    masked_aadhaar VARCHAR(20) NOT NULL,
    blood_type VARCHAR(5) NOT NULL,
    organ_type VARCHAR(50) NOT NULL,
    tissue_type VARCHAR(100) NOT NULL,
    registration_status VARCHAR(50) NOT NULL DEFAULT 'registered' CHECK (registration_status IN ('registered', 'allocated', 'transplanted', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. RECIPIENTS TABLE
CREATE TABLE IF NOT EXISTS recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id UUID REFERENCES hospitals(id) ON DELETE SET NULL,
    full_name VARCHAR(255) NOT NULL,
    notto_reg_number VARCHAR(50) UNIQUE NOT NULL,
    blood_type VARCHAR(5) NOT NULL,
    organ_needed VARCHAR(50) NOT NULL,
    urgency_level VARCHAR(20) NOT NULL CHECK (urgency_level IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
    wait_time_days INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'matched', 'transplanted', 'delisted')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. MATCHES TABLE
CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donor_id UUID NOT NULL REFERENCES donors(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES recipients(id) ON DELETE CASCADE,
    blood_type_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    organ_match_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    hla_match_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    wait_time_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    urgency_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    total_compatibility_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    compatibility_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    match_status VARCHAR(50) NOT NULL DEFAULT 'proposed' CHECK (match_status IN ('proposed', 'confirmed', 'accepted', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. ALLOCATIONS TABLE
CREATE TABLE IF NOT EXISTS allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    logistics_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (logistics_status IN ('pending', 'in_transit', 'delivered', 'cancelled')),
    regulatory_approval BOOLEAN NOT NULL DEFAULT false,
    reported BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. REGULATORY APPROVALS TABLE
CREATE TABLE IF NOT EXISTS regulatory_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    allocation_id UUID NOT NULL REFERENCES allocations(id) ON DELETE CASCADE,
    officer_id UUID NOT NULL REFERENCES hospital_users(id) ON DELETE CASCADE,
    approval_status VARCHAR(50) NOT NULL DEFAULT 'APPROVED' CHECK (approval_status IN ('APPROVED', 'REJECTED', 'UNDER_REVIEW')),
    compliance_notes TEXT,
    approved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. AUDIT LOG TABLE
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    performed_by UUID REFERENCES hospital_users(id) ON DELETE SET NULL,
    hospital_id UUID REFERENCES hospitals(id) ON DELETE SET NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- SQL VIEWS
-- ============================================================================

-- VIEW 1: Active Donors
CREATE OR REPLACE VIEW active_donors AS
SELECT 
    d.id AS donor_id,
    d.full_name,
    d.donor_type,
    d.masked_aadhaar,
    d.blood_type,
    d.organ_type,
    d.tissue_type,
    d.registration_status,
    d.created_at,
    h.id AS hospital_id,
    h.name AS hospital_name,
    h.city AS hospital_city,
    h.state AS hospital_state
FROM donors d
LEFT JOIN hospitals h ON d.hospital_id = h.id
WHERE d.registration_status = 'registered';

-- VIEW 2: Active Recipients
CREATE OR REPLACE VIEW active_recipients AS
SELECT 
    r.id AS recipient_id,
    r.full_name,
    r.notto_reg_number,
    r.blood_type,
    r.organ_needed,
    r.urgency_level,
    r.wait_time_days,
    r.status,
    r.created_at,
    h.id AS hospital_id,
    h.name AS hospital_name,
    h.city AS hospital_city,
    h.state AS hospital_state
FROM recipients r
LEFT JOIN hospitals h ON r.hospital_id = h.id
WHERE r.status = 'waiting';

-- VIEW 3: Pending Allocations
CREATE OR REPLACE VIEW pending_allocations AS
SELECT 
    a.id AS allocation_id,
    a.match_id,
    a.logistics_status,
    a.regulatory_approval,
    a.reported,
    a.created_at AS allocation_date,
    m.total_compatibility_score,
    m.compatibility_score,
    d.id AS donor_id,
    d.full_name AS donor_name,
    d.organ_type,
    d.blood_type AS donor_blood_type,
    r.id AS recipient_id,
    r.full_name AS recipient_name,
    r.notto_reg_number,
    r.blood_type AS recipient_blood_type,
    r.urgency_level
FROM allocations a
JOIN matches m ON a.match_id = m.id
JOIN donors d ON m.donor_id = d.id
JOIN recipients r ON m.recipient_id = r.id
WHERE a.logistics_status IN ('pending', 'in_transit');
