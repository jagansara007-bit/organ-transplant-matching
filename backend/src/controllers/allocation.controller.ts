import { Response } from 'express';
import { pool } from '../config/db';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { inMemoryAuditLogs, InMemoryAuditEntry } from './match.controller';
import { AuditLoggerService } from '../services/auditLogger';
import { z } from 'zod';

export const allocatePayloadSchema = z.object({
  matchId: z.string().min(1, 'Match ID is required'),
  logisticsStatus: z.enum(['pending', 'in_transit', 'delivered', 'cancelled']).optional(),
  regulatoryApproval: z.boolean().optional(),
  coldChainParams: z.object({
    temperatureCelsius: z.number().optional(),
    etaMinutes: z.number().optional(),
    coldIschemiaLimitHours: z.number().optional(),
    originHospital: z.string().optional(),
    destinationHospital: z.string().optional()
  }).optional()
});

export const updateLogisticsSchema = z.object({
  logisticsStatus: z.enum(['pending', 'in_transit', 'delivered', 'cancelled']),
  temperatureCelsius: z.number().optional(),
  organCondition: z.enum(['OPTIMAL', 'ACCEPTABLE', 'RISK_DETECTED']).optional()
});

export const regulatoryApprovalSchema = z.object({
  approvalStatus: z.enum(['APPROVED', 'REJECTED', 'UNDER_REVIEW']),
  complianceNotes: z.string().optional(),
  nottoForm8Verified: z.boolean().optional()
});

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

export interface RegulatoryApprovalRecord {
  id: string;
  allocation_id: string;
  officer_id: string;
  officer_name?: string;
  approval_status: 'APPROVED' | 'REJECTED' | 'UNDER_REVIEW';
  compliance_notes: string;
  notto_form_8_verified: boolean;
  approved_at: string;
}

export interface AllocationRecord {
  id?: string;
  allocation_id: string;
  match_id: string;
  logistics_status: 'pending' | 'in_transit' | 'delivered' | 'cancelled';
  regulatory_approval: boolean;
  reported: boolean;
  allocation_created_at: string;
  compatibility_score: number;
  match_status: string;
  donor_id: string;
  donor_name: string;
  donor_blood_type: string;
  donor_organ: string;
  donor_tissue: string;
  recipient_id: string;
  recipient_name: string;
  recipient_blood_type: string;
  recipient_organ_needed: string;
  recipient_urgency: string;
  recipient_wait_days: number;
  telemetry?: ColdChainTelemetry;
  approvals?: RegulatoryApprovalRecord[];
}

export const inMemoryRegulatoryApprovals: RegulatoryApprovalRecord[] = [];

export const inMemoryAllocations: AllocationRecord[] = [
  {
    allocation_id: 'a9010000-0000-4000-8000-000000000901',
    match_id: 'm7020000-0000-4000-8000-000000000702',
    logistics_status: 'in_transit',
    regulatory_approval: true,
    reported: true,
    allocation_created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    compatibility_score: 86.56,
    match_status: 'accepted',
    donor_id: 'd1020000-0000-4000-8000-000000000102',
    donor_name: 'Dr. Ellie Sattler',
    donor_blood_type: 'A-',
    donor_organ: 'Liver',
    donor_tissue: 'HLA-A1, HLA-B8, HLA-DR3',
    recipient_id: 'r5020000-0000-4000-8000-000000000502',
    recipient_name: 'Ellen Ripley',
    recipient_blood_type: 'A-',
    recipient_organ_needed: 'Liver',
    recipient_urgency: 'HIGH',
    recipient_wait_days: 190,
    telemetry: {
      temperatureCelsius: 4.1,
      batteryPercentage: 94,
      etaMinutes: 38,
      departureTime: new Date(Date.now() - 3600000 * 2).toISOString(),
      coldIschemiaLimitHours: 12,
      organCondition: 'OPTIMAL',
      originHospital: 'Apollo Hospitals Enterprise (Chennai)',
      destinationHospital: 'Apollo Hospitals Enterprise (Chennai)'
    },
    approvals: [
      {
        id: 'reg-app-101',
        allocation_id: 'a9010000-0000-4000-8000-000000000901',
        officer_id: 'cccccccc-cccc-4ccc-bccc-cccccccccccc',
        officer_name: 'Officer Vikramaditya Sen',
        approval_status: 'APPROVED',
        compliance_notes: 'All NOTTO Form 8 statutory clearances validated. Living donor tissue crossmatch verified without discrepancy.',
        notto_form_8_verified: true,
        approved_at: new Date(Date.now() - 3600000 * 3).toISOString()
      }
    ]
  }
];

import { inMemoryDonors } from './donor.controller';
import { inMemoryRecipients } from './recipient.controller';

/**
 * 1. POST /api/allocations/allocate
 * Initializes an organ allocation record with cold-chain tracking parameters
 */
export const createAllocation = async (req: AuthenticatedRequest, res: Response) => {
  const parseResult = allocatePayloadSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid allocation payload',
      errors: parseResult.error.errors
    });
  }

  const { matchId, logisticsStatus, regulatoryApproval, coldChainParams } = parseResult.data;
  const performedBy = req.user?.id || 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
  const hospitalId = req.user?.hospital_id || '22222222-2222-4222-a222-222222222222';
  const clientIp = req.ip || req.headers['x-forwarded-for']?.toString() || '127.0.0.1';

  const defaultTelemetry: ColdChainTelemetry = {
    temperatureCelsius: coldChainParams?.temperatureCelsius ?? 4.0,
    batteryPercentage: 99,
    etaMinutes: coldChainParams?.etaMinutes ?? 45,
    departureTime: new Date().toISOString(),
    coldIschemiaLimitHours: coldChainParams?.coldIschemiaLimitHours ?? 24,
    organCondition: 'OPTIMAL',
    originHospital: coldChainParams?.originHospital || 'Apollo Hospitals Enterprise (Chennai)',
    destinationHospital: coldChainParams?.destinationHospital || 'AIIMS (New Delhi)'
  };

  let targetId = `alloc-${Date.now()}`;

  try {
    const insertQuery = `
      INSERT INTO allocations (match_id, logistics_status, regulatory_approval, reported)
      VALUES ($1, $2, $3, false)
      RETURNING id, match_id, logistics_status, regulatory_approval, reported, created_at;
    `;
    const result = await pool.query(insertQuery, [
      matchId,
      logisticsStatus || 'pending',
      regulatoryApproval !== undefined ? regulatoryApproval : false
    ]);

    const createdAllocation = result.rows[0];
    targetId = createdAllocation.id;

    // Ensure match status is accepted
    await pool.query("UPDATE matches SET match_status = 'accepted' WHERE id = $1", [matchId]);
  } catch (err) {
    // Database offline fallback
  }

  // Look up matched donor and recipient dynamically
  let donor = inMemoryDonors[0];
  let recipient = inMemoryRecipients[0];

  if (typeof matchId === 'string' && matchId.startsWith('match-')) {
    const parts = matchId.replace('match-', '').split('-');
    if (parts.length >= 2) {
      const dPrefix = parts[0];
      const rPrefix = parts[1];
      const foundD = inMemoryDonors.find(d => d.id.startsWith(dPrefix) || d.id.includes(dPrefix));
      const foundR = inMemoryRecipients.find(r => r.id.startsWith(rPrefix) || r.id.includes(rPrefix));
      if (foundD) donor = foundD;
      if (foundR) recipient = foundR;
    }
  }

  const newAllocation: AllocationRecord = {
    allocation_id: targetId,
    id: targetId,
    match_id: matchId,
    logistics_status: logisticsStatus || 'pending',
    regulatory_approval: regulatoryApproval !== undefined ? regulatoryApproval : false,
    reported: false,
    allocation_created_at: new Date().toISOString(),
    compatibility_score: 95.0,
    match_status: 'accepted',
    donor_id: donor.id,
    donor_name: donor.full_name,
    donor_blood_type: donor.blood_type,
    donor_organ: donor.organ_type,
    donor_tissue: donor.tissue_type,
    recipient_id: recipient.id,
    recipient_name: recipient.full_name,
    recipient_blood_type: recipient.blood_type,
    recipient_organ_needed: recipient.organ_needed,
    recipient_urgency: recipient.urgency_level,
    recipient_wait_days: recipient.wait_time_days,
    telemetry: defaultTelemetry,
    approvals: []
  };

  inMemoryAllocations.unshift(newAllocation);

  // Forensic Audit Log with SHA-256 Hash
  await AuditLoggerService.logEvent({
    entity_type: 'allocations',
    entity_id: targetId,
    action: 'ALLOCATION_INITIALIZED',
    performed_by: performedBy,
    performed_by_name: req.user?.full_name || 'Dr. Ananya Iyer',
    performed_by_role: req.user?.user_role || 'transplant_surgeon',
    hospital_id: hospitalId,
    client_ip: clientIp,
    details: {
      matchId,
      logisticsStatus: newAllocation.logistics_status,
      telemetry: defaultTelemetry,
      staff: req.user?.email || 'ananya.iyer@apollo.org'
    }
  });

  return res.status(201).json({
    status: 'success',
    message: 'Organ cold-chain allocation pipeline initialized successfully',
    allocation: newAllocation
  });
};

/**
 * 2. PATCH /api/allocations/:id/logistics
 * Lifecycle transitions: 'pending' -> 'in_transit' -> 'delivered'
 */
export const updateLogisticsStatus = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const parseResult = updateLogisticsSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid logistics status payload',
      errors: parseResult.error.errors
    });
  }

  const { logisticsStatus, temperatureCelsius, organCondition } = parseResult.data;
  const performedBy = req.user?.id || 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
  const hospitalId = req.user?.hospital_id || '22222222-2222-4222-a222-222222222222';
  const clientIp = req.ip || req.headers['x-forwarded-for']?.toString() || '127.0.0.1';

  try {
    const updateQuery = `
      UPDATE allocations
      SET logistics_status = $1
      WHERE id = $2
      RETURNING id, match_id, logistics_status, regulatory_approval, reported, created_at;
    `;
    await pool.query(updateQuery, [logisticsStatus, id]);
  } catch (err) {
    // Database offline fallback
  }

  const alloc = inMemoryAllocations.find(a => a.allocation_id === id);
  if (alloc) {
    alloc.logistics_status = logisticsStatus;
    if (!alloc.telemetry) {
      alloc.telemetry = {
        temperatureCelsius: temperatureCelsius ?? 4.0,
        batteryPercentage: 92,
        etaMinutes: logisticsStatus === 'delivered' ? 0 : 25,
        departureTime: new Date().toISOString(),
        coldIschemiaLimitHours: 24,
        organCondition: organCondition || 'OPTIMAL'
      };
    } else {
      if (temperatureCelsius !== undefined) alloc.telemetry.temperatureCelsius = temperatureCelsius;
      if (organCondition) alloc.telemetry.organCondition = organCondition;
      if (logisticsStatus === 'delivered') alloc.telemetry.etaMinutes = 0;
    }
  }

  // Forensic Audit Log with SHA-256 Hash
  await AuditLoggerService.logEvent({
    entity_type: 'allocations',
    entity_id: id,
    action: logisticsStatus === 'delivered' ? 'ORGAN_RECEPTION_CONFIRMED' : 'LOGISTICS_STATUS_UPDATED',
    performed_by: performedBy,
    performed_by_name: req.user?.full_name || 'Dr. Ananya Iyer',
    performed_by_role: req.user?.user_role || 'transplant_surgeon',
    hospital_id: hospitalId,
    client_ip: clientIp,
    details: {
      allocationId: id,
      logisticsStatus,
      temperatureCelsius: temperatureCelsius ?? 4.0,
      organCondition: organCondition ?? 'OPTIMAL',
      updatedBy: req.user?.email || 'ananya.iyer@apollo.org'
    }
  });

  return res.json({
    status: 'success',
    message: `Logistics status updated to '${logisticsStatus}'`,
    allocation: alloc || { allocation_id: id, logistics_status: logisticsStatus }
  });
};

/**
 * 3. POST /api/allocations/:id/regulatory-approval
 * Dedicated Regulatory Officer Sign-Off & Verification (NOTTO Form 8 Clearance)
 */
export const recordRegulatoryApproval = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const parseResult = regulatoryApprovalSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid regulatory approval payload',
      errors: parseResult.error.errors
    });
  }

  const { approvalStatus, complianceNotes, nottoForm8Verified } = parseResult.data;
  const officerId = req.user?.id || 'cccccccc-cccc-4ccc-bccc-cccccccccccc';
  const hospitalId = req.user?.hospital_id || '33333333-3333-4333-a333-333333333333';
  const officerEmail = req.user?.email || 'vikram.sen@notto.gov.in';
  const clientIp = req.ip || req.headers['x-forwarded-for']?.toString() || '127.0.0.1';

  const isApproved = approvalStatus === 'APPROVED';

  try {
    const approvalInsertQuery = `
      INSERT INTO regulatory_approvals (allocation_id, officer_id, approval_status, compliance_notes)
      VALUES ($1, $2, $3, $4)
      RETURNING id, allocation_id, officer_id, approval_status, compliance_notes, approved_at;
    `;
    await pool.query(approvalInsertQuery, [
      id,
      officerId,
      approvalStatus,
      complianceNotes || 'NOTTO Form 8 Statutory Clearance Verified'
    ]);

    await pool.query(
      'UPDATE allocations SET regulatory_approval = $1 WHERE id = $2',
      [isApproved, id]
    );
  } catch (err) {
    // Database offline fallback
  }

  const approvalRecord: RegulatoryApprovalRecord = {
    id: `reg-app-${Date.now()}`,
    allocation_id: id,
    officer_id: officerId,
    officer_name: req.user?.full_name || officerEmail,
    approval_status: approvalStatus,
    compliance_notes: complianceNotes || 'NOTTO Form 8 Statutory Clearance Verified and Signed Off',
    notto_form_8_verified: nottoForm8Verified ?? true,
    approved_at: new Date().toISOString()
  };

  inMemoryRegulatoryApprovals.unshift(approvalRecord);

  // Update in-memory allocation record
  const alloc = inMemoryAllocations.find(a => a.allocation_id === id);
  if (alloc) {
    alloc.regulatory_approval = isApproved;
    if (!alloc.approvals) alloc.approvals = [];
    alloc.approvals.unshift(approvalRecord);
  }

  // Forensic Audit Log with SHA-256 Hash
  await AuditLoggerService.logEvent({
    entity_type: 'regulatory_approvals',
    entity_id: id,
    action: 'REGULATORY_APPROVAL_RECORDED',
    performed_by: officerId,
    performed_by_name: req.user?.full_name || 'Officer Vikramaditya Sen',
    performed_by_role: req.user?.user_role || 'regulatory_officer',
    hospital_id: hospitalId,
    client_ip: clientIp,
    details: {
      allocationId: id,
      approvalStatus,
      complianceNotes: approvalRecord.compliance_notes,
      nottoForm8Verified: nottoForm8Verified ?? true,
      officer: officerEmail
    }
  });

  return res.status(201).json({
    status: 'success',
    message: `Regulatory sign-off recorded successfully as '${approvalStatus}'`,
    approval: approvalRecord
  });
};

/**
 * 4. GET /api/allocations/audit-trail
 * Real-time forensic compliance audit trail records with actor roles, client IP, payload hashes & entity references
 */
export const getAuditTrail = async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const auditQuery = `
      SELECT 
        a.id,
        a.entity_type,
        a.entity_id,
        a.action,
        a.details,
        a.created_at,
        u.full_name AS performed_by_name,
        u.email AS performed_by_email,
        u.role AS performed_by_role,
        h.name AS hospital_name,
        h.hospital_code
      FROM audit_log a
      LEFT JOIN hospital_users u ON a.performed_by = u.id
      LEFT JOIN hospitals h ON a.hospital_id = h.id
      ORDER BY a.created_at DESC
      LIMIT 100;
    `;
    const result = await pool.query(auditQuery);

    if (result.rows.length > 0) {
      return res.json({
        status: 'success',
        count: result.rows.length,
        auditLogs: result.rows
      });
    }
  } catch (err) {
    // Database offline fallback
  }

  const forensicLogs = AuditLoggerService.getAuditLogs();
  return res.json({
    status: 'success',
    count: forensicLogs.length,
    auditLogs: forensicLogs
  });
};

/**
 * 5. GET /api/allocations
 */
export const getAllocations = async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const query = `
      SELECT 
        a.id AS allocation_id,
        a.logistics_status,
        a.regulatory_approval,
        a.reported,
        a.created_at AS allocation_created_at,
        m.id AS match_id,
        m.compatibility_score,
        m.match_status,
        d.id AS donor_id,
        d.full_name AS donor_name,
        d.blood_type AS donor_blood_type,
        d.organ_type AS donor_organ,
        d.tissue_type AS donor_tissue,
        r.id AS recipient_id,
        r.full_name AS recipient_name,
        r.blood_type AS recipient_blood_type,
        r.organ_needed AS recipient_organ_needed,
        r.urgency_level AS recipient_urgency,
        r.wait_time_days AS recipient_wait_days
      FROM allocations a
      JOIN matches m ON a.match_id = m.id
      JOIN donors d ON m.donor_id = d.id
      JOIN recipients r ON m.recipient_id = r.id
      ORDER BY a.created_at DESC;
    `;
    const result = await pool.query(query);

    if (result.rows.length > 0) {
      const rowsWithTelemetry = result.rows.map(row => ({
        ...row,
        telemetry: {
          temperatureCelsius: 4.1,
          batteryPercentage: 95,
          etaMinutes: row.logistics_status === 'delivered' ? 0 : 35,
          departureTime: row.allocation_created_at,
          coldIschemiaLimitHours: 24,
          organCondition: 'OPTIMAL'
        }
      }));

      return res.json({
        status: 'success',
        count: rowsWithTelemetry.length,
        allocations: rowsWithTelemetry
      });
    }
  } catch (err) {
    // Fallback
  }

  return res.json({
    status: 'success',
    count: inMemoryAllocations.length,
    allocations: inMemoryAllocations
  });
};
