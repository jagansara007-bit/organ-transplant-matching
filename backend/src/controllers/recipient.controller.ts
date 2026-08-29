import { Request, Response } from 'express';
import { pool } from '../config/db';
import { z } from 'zod';
import { AuditLoggerService } from '../services/auditLogger';

export const registerRecipientSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  nottoRegNumber: z.string().optional(),
  bloodType: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
  organNeeded: z.enum(['Kidney', 'Liver', 'Heart', 'Lungs', 'Pancreas', 'Cornea']),
  urgencyLevel: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
  waitTimeDays: z.number().nonnegative().optional(),
  hospitalId: z.string().optional()
});

export interface RecipientRecord {
  id: string;
  hospital_id?: string;
  full_name: string;
  notto_reg_number: string;
  blood_type: string;
  organ_needed: string;
  urgency_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  wait_time_days: number;
  status: string;
  created_at: string;
}

export const inMemoryRecipients: RecipientRecord[] = [
  { id: 'r5010000-0000-4000-8000-000000000501', hospital_id: '11111111-1111-4111-a111-111111111111', full_name: 'John H. Watson', notto_reg_number: 'NOTTO-REC-2026-001', blood_type: 'O+', organ_needed: 'Kidney', urgency_level: 'CRITICAL', wait_time_days: 410, status: 'waiting', created_at: new Date(Date.now() - 86400000 * 10).toISOString() },
  { id: 'r5020000-0000-4000-8000-000000000502', hospital_id: '22222222-2222-4222-a222-222222222222', full_name: 'Ellen Ripley', notto_reg_number: 'NOTTO-REC-2026-002', blood_type: 'A-', organ_needed: 'Liver', urgency_level: 'HIGH', wait_time_days: 190, status: 'waiting', created_at: new Date(Date.now() - 86400000 * 8).toISOString() },
  { id: 'r5030000-0000-4000-8000-000000000503', hospital_id: '33333333-3333-4333-a333-333333333333', full_name: 'Arthur Dent', notto_reg_number: 'NOTTO-REC-2026-003', blood_type: 'B+', organ_needed: 'Heart', urgency_level: 'CRITICAL', wait_time_days: 85, status: 'waiting', created_at: new Date(Date.now() - 86400000 * 6).toISOString() },
  { id: 'r5040000-0000-4000-8000-000000000504', hospital_id: '11111111-1111-4111-a111-111111111111', full_name: 'James T. Kirk', notto_reg_number: 'NOTTO-REC-2026-004', blood_type: 'O+', organ_needed: 'Kidney', urgency_level: 'MEDIUM', wait_time_days: 280, status: 'waiting', created_at: new Date(Date.now() - 86400000 * 4).toISOString() },
  { id: 'r5050000-0000-4000-8000-000000000505', hospital_id: '22222222-2222-4222-a222-222222222222', full_name: 'Natasha Romanoff', notto_reg_number: 'NOTTO-REC-2026-005', blood_type: 'A-', organ_needed: 'Heart', urgency_level: 'HIGH', wait_time_days: 320, status: 'waiting', created_at: new Date(Date.now() - 86400000 * 2).toISOString() }
];

export const registerRecipient = async (req: Request, res: Response) => {
  const parseResult = registerRecipientSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid recipient registration payload',
      errors: parseResult.error.errors
    });
  }

  const { fullName, nottoRegNumber, bloodType, organNeeded, urgencyLevel, waitTimeDays, hospitalId } = parseResult.data;

  const resolvedNottoReg = nottoRegNumber || `NOTTO-REC-2026-${Math.floor(100 + Math.random() * 900)}`;
  let createdRecipient: RecipientRecord;

  try {
    const query = `
      INSERT INTO recipients (full_name, notto_reg_number, blood_type, organ_needed, urgency_level, wait_time_days, hospital_id, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'waiting')
      RETURNING id, full_name, notto_reg_number, blood_type, organ_needed, urgency_level, wait_time_days, status, created_at;
    `;
    const result = await pool.query(query, [
      fullName,
      resolvedNottoReg,
      bloodType,
      organNeeded,
      urgencyLevel,
      waitTimeDays || 0,
      hospitalId || null
    ]);
    createdRecipient = result.rows[0];
  } catch (err) {
    // Database offline fallback
    createdRecipient = {
      id: `r-${Date.now()}`,
      hospital_id: hospitalId,
      full_name: fullName,
      notto_reg_number: resolvedNottoReg,
      blood_type: bloodType,
      organ_needed: organNeeded,
      urgency_level: urgencyLevel,
      wait_time_days: Number(waitTimeDays || 0),
      status: 'waiting',
      created_at: new Date().toISOString()
    };
    inMemoryRecipients.unshift(createdRecipient);
  }

  // Structured Forensic Audit Log
  AuditLoggerService.logEvent({
    entity_type: 'recipients',
    entity_id: createdRecipient.id,
    action: 'RECIPIENT_WAITLISTED',
    performed_by: (req as any).user?.email || 'hospital_admin',
    performed_by_name: (req as any).user?.full_name,
    performed_by_role: (req as any).user?.user_role,
    hospital_id: hospitalId,
    client_ip: req.ip || req.headers['x-forwarded-for']?.toString() || '127.0.0.1',
    details: {
      organ_needed: organNeeded,
      blood_type: bloodType,
      urgency_level: urgencyLevel,
      notto_reg_number: resolvedNottoReg
    }
  }).catch(() => {});

  return res.status(201).json({
    status: 'success',
    message: 'Recipient registered successfully',
    recipient: createdRecipient
  });
};

export const getRecipients = async (_req: Request, res: Response) => {
  try {
    const query = `
      SELECT id, full_name, notto_reg_number, blood_type, organ_needed, urgency_level, wait_time_days, status, created_at
      FROM recipients
      ORDER BY 
        CASE urgency_level
          WHEN 'CRITICAL' THEN 1
          WHEN 'HIGH' THEN 2
          WHEN 'MEDIUM' THEN 3
          WHEN 'LOW' THEN 4
          ELSE 5
        END,
        wait_time_days DESC,
        created_at DESC;
    `;
    const result = await pool.query(query);

    if (result.rows.length > 0) {
      return res.json({
        status: 'success',
        count: result.rows.length,
        recipients: result.rows
      });
    }
  } catch (err) {
    // Database offline fallback
  }

  // Sort in-memory list by urgency & wait time
  const sorted = [...inMemoryRecipients].sort((a, b) => {
    const order: Record<string, number> = { CRITICAL: 1, HIGH: 2, MEDIUM: 3, LOW: 4 };
    const rankA = order[a.urgency_level] || 5;
    const rankB = order[b.urgency_level] || 5;
    if (rankA !== rankB) return rankA - rankB;
    return b.wait_time_days - a.wait_time_days;
  });

  return res.json({
    status: 'success',
    count: sorted.length,
    recipients: sorted
  });
};
