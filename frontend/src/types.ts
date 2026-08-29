export interface StaffUser {
  id: string;
  hospital_id: string;
  full_name: string;
  email: string;
  user_role: 'hospital_admin' | 'transplant_surgeon' | 'regulatory_officer' | string;
  medical_license?: string;
  is_authorized?: boolean;
}

export interface HospitalInfo {
  id: string;
  name: string;
  hospital_code: string;
  city: string;
  state: string;
  verification_status: string;
}

export interface AuthSession {
  token: string;
  user: StaffUser;
  hospital?: HospitalInfo;
}

export interface Donor {
  id: string;
  hospital_id?: string;
  hospital_name?: string;
  full_name: string;
  donor_type?: 'DECEASED' | 'LIVING_FAMILY';
  masked_aadhaar?: string;
  blood_type: string;
  organ_type: string;
  tissue_type: string;
  registration_status: string;
  created_at: string;
}

export interface Recipient {
  id: string;
  hospital_id?: string;
  hospital_name?: string;
  full_name: string;
  notto_reg_number?: string;
  blood_type: string;
  organ_needed: string;
  urgency_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  wait_time_days: number;
  status: string;
  created_at: string;
}

export interface MatchBreakdown {
  bloodCompatibilityScore: number;
  bloodTypeScore?: number;
  organMatchScore: number;
  tissueMatchScore: number;
  hlaMatchScore?: number;
  urgencyWaitScore: number;
  urgencyScore?: number;
  waitTimeScore?: number;
  totalScore?: number;
}

export interface EvaluatedMatch {
  matchId: string;
  compatibilityScore: number;
  totalCompatibilityScore?: number;
  matchStatus?: string;
  breakdown: MatchBreakdown;
  donor: {
    id: string;
    fullName: string;
    donorType?: string;
    maskedAadhaar?: string;
    bloodType: string;
    organType: string;
    tissueType: string;
    hospital?: {
      id?: string;
      name?: string;
      hospitalCode?: string;
      city?: string;
      state?: string;
    };
  };
  recipient: {
    id: string;
    fullName: string;
    nottoRegNumber?: string;
    bloodType: string;
    organNeeded: string;
    urgencyLevel: string;
    waitTimeDays: number;
    hospital?: {
      id?: string;
      name?: string;
      hospitalCode?: string;
      city?: string;
      state?: string;
    };
  };
}

export interface MatchesSearchResponse {
  status: string;
  totalEvaluated: number;
  matches: EvaluatedMatch[];
}

export interface ColdChainTelemetry {
  temperatureCelsius: number;
  batteryPercentage: number;
  etaMinutes: number;
  departureTime: string;
  coldIschemiaLimitHours: number;
  organCondition: 'OPTIMAL' | 'ACCEPTABLE' | 'RISK_DETECTED';
  originHospital?: string;
  destinationHospital?: string;
}

export interface RegulatoryApproval {
  id: string;
  allocation_id: string;
  officer_id: string;
  officer_name?: string;
  approval_status: 'APPROVED' | 'REJECTED' | 'UNDER_REVIEW';
  compliance_notes: string;
  notto_form_8_verified: boolean;
  approved_at: string;
}

export interface Allocation {
  allocation_id: string;
  id?: string;
  logistics_status: 'pending' | 'in_transit' | 'delivered';
  regulatory_approval: boolean;
  reported: boolean;
  allocation_created_at: string;
  match_id: string;
  compatibility_score: number;
  match_status: string;
  donor_id: string;
  donor_name: string;
  donor_blood_type: string;
  donor_organ: string;
  recipient_id: string;
  recipient_name: string;
  recipient_blood_type: string;
  recipient_organ_needed: string;
  recipient_urgency: string;
  donor_tissue?: string;
  recipient_wait_days?: number;
  telemetry?: ColdChainTelemetry;
  approvals?: RegulatoryApproval[];
}

export interface AuditLogRecord {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  details: any;
  created_at: string;
  performed_by_name?: string;
  performed_by_email?: string;
  performed_by_role?: string;
  hospital_name?: string;
  hospital_code?: string;
  client_ip?: string;
  payload_sha256_hash?: string;
}

export interface ServiceHealth {
  status: 'up' | 'down' | 'connected' | 'disconnected' | string;
  label?: string;
}

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'error' | string;
  sla?: string;
  timestamp: string;
  apiGateway?: {
    status: string;
    port: number;
    latencyMs: number;
    label: string;
  };
  database?: {
    status: string;
    activeTier: 'SUPABASE_CLOUD' | 'LOCAL_POSTGRES' | 'IN_MEMORY_STANDBY' | string;
    activeTierLabel: string;
    tierDescription: string;
    latencyMs: number;
    poolStats?: {
      totalCount: number;
      idleCount: number;
      waitingCount: number;
    };
    disasterRecoveryReady?: boolean;
  };
  redisCache?: {
    status: string;
    label: string;
    latencyMs: number;
  };
  iotTelemetry?: {
    status: string;
    rate: string;
    activeSensors: string[];
    label: string;
  };
  compliance?: {
    thoa2014Certified: boolean;
    auditLedgerImmutable: boolean;
    failoverMode: string;
  };
  services?: {
    api?: ServiceHealth;
    postgres?: ServiceHealth;
    redis?: ServiceHealth;
  };
}

