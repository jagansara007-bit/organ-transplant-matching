import { Request, Response } from 'express';
import { pool } from '../config/db';
import { z } from 'zod';
import { maskAadhaar } from '../utils/masking';
import { AuditLoggerService } from '../services/auditLogger';

export const registerDonorSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  bloodType: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
  organType: z.enum(['Kidney', 'Liver', 'Heart', 'Lungs', 'Pancreas', 'Cornea']),
  tissueType: z.string().min(1, 'Tissue HLA profile is required'),
  donorType: z.enum(['DECEASED', 'LIVING_FAMILY']).optional(),
  maskedAadhaar: z.string().optional(),
  hospitalId: z.string().optional()
});

export interface DonorRecord {
  id: string;
  hospital_id?: string;
  full_name: string;
  donor_type: 'DECEASED' | 'LIVING_FAMILY';
  masked_aadhaar: string;
  blood_type: string;
  organ_type: string;
  tissue_type: string;
  registration_status: string;
  created_at: string;
}

export const inMemoryDonors: DonorRecord[] = [
  { id: 'd1010000-0000-4000-8000-000000000101', hospital_id: '11111111-1111-4111-a111-111111111111', full_name: 'Dr. Alan Grant', donor_type: 'DECEASED', masked_aadhaar: 'XXXX-XXXX-8921', blood_type: 'O+', organ_type: 'Kidney', tissue_type: 'HLA-A2, HLA-B7, HLA-DR4', registration_status: 'registered', created_at: new Date(Date.now() - 86400000 * 5).toISOString() },
  { id: 'd1020000-0000-4000-8000-000000000102', hospital_id: '22222222-2222-4222-a222-222222222222', full_name: 'Sarah Connor', donor_type: 'LIVING_FAMILY', masked_aadhaar: 'XXXX-XXXX-3412', blood_type: 'A-', organ_type: 'Liver', tissue_type: 'HLA-A1, HLA-B8, HLA-DR3', registration_status: 'registered', created_at: new Date(Date.now() - 86400000 * 4).toISOString() },
  { id: 'd1030000-0000-4000-8000-000000000103', hospital_id: '33333333-3333-4333-a333-333333333333', full_name: 'Bruce Wayne', donor_type: 'DECEASED', masked_aadhaar: 'XXXX-XXXX-7654', blood_type: 'B+', organ_type: 'Heart', tissue_type: 'HLA-A3, HLA-B27, HLA-DR1', registration_status: 'registered', created_at: new Date(Date.now() - 86400000 * 3).toISOString() },
  { id: 'd1040000-0000-4000-8000-000000000104', hospital_id: '11111111-1111-4111-a111-111111111111', full_name: 'Diana Prince', donor_type: 'LIVING_FAMILY', masked_aadhaar: 'XXXX-XXXX-9081', blood_type: 'O+', organ_type: 'Kidney', tissue_type: 'HLA-A2, HLA-B44, HLA-DR4', registration_status: 'registered', created_at: new Date(Date.now() - 86400000 * 2).toISOString() },
  { id: 'd1050000-0000-4000-8000-000000000105', hospital_id: '22222222-2222-4222-a222-222222222222', full_name: 'Clark Kent', donor_type: 'DECEASED', masked_aadhaar: 'XXXX-XXXX-5543', blood_type: 'A-', organ_type: 'Heart', tissue_type: 'HLA-A24, HLA-B35, HLA-DR11', registration_status: 'registered', created_at: new Date(Date.now() - 86400000 * 1).toISOString() }
];

export const registerDonor = async (req: Request, res: Response) => {
  const parseResult = registerDonorSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid donor registration payload',
      errors: parseResult.error.errors
    });
  }

  const { fullName, bloodType, organType, tissueType, donorType, maskedAadhaar: rawAadhaar, hospitalId } = parseResult.data;

  const resolvedDonorType = donorType === 'LIVING_FAMILY' ? 'LIVING_FAMILY' : 'DECEASED';
  const resolvedAadhaar = maskAadhaar(rawAadhaar);

  let createdDonor: DonorRecord;

  try {
    const query = `
      INSERT INTO donors (full_name, donor_type, masked_aadhaar, blood_type, organ_type, tissue_type, hospital_id, registration_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'registered')
      RETURNING id, full_name, donor_type, masked_aadhaar, blood_type, organ_type, tissue_type, registration_status, created_at;
    `;
    const result = await pool.query(query, [fullName, resolvedDonorType, resolvedAadhaar, bloodType, organType, tissueType, hospitalId || null]);
    createdDonor = result.rows[0];
  } catch (err) {
    // Database offline fallback
    createdDonor = {
      id: `d-${Date.now()}`,
      hospital_id: hospitalId,
      full_name: fullName,
      donor_type: resolvedDonorType,
      masked_aadhaar: resolvedAadhaar,
      blood_type: bloodType,
      organ_type: organType,
      tissue_type: tissueType,
      registration_status: 'registered',
      created_at: new Date().toISOString()
    };
    inMemoryDonors.unshift(createdDonor);
  }

  // Forensic Audit Log with SHA-256 integrity hash
  AuditLoggerService.logEvent({
    entity_type: 'donors',
    entity_id: createdDonor.id,
    action: 'DONOR_ENROLLED',
    performed_by: (req as any).user?.email || 'hospital_admin',
    performed_by_name: (req as any).user?.full_name,
    performed_by_role: (req as any).user?.user_role,
    hospital_id: hospitalId,
    client_ip: req.ip || req.headers['x-forwarded-for']?.toString() || '127.0.0.1',
    details: {
      organ_type: organType,
      blood_type: bloodType,
      donor_type: resolvedDonorType,
      masked_aadhaar: resolvedAadhaar
    }
  }).catch(() => {});

  return res.status(201).json({
    status: 'success',
    message: 'Donor registered successfully',
    donor: createdDonor
  });
};

export const getDonors = async (_req: Request, res: Response) => {
  try {
    const query = `
      SELECT id, full_name, donor_type, masked_aadhaar, blood_type, organ_type, tissue_type, registration_status, created_at
      FROM donors
      ORDER BY created_at DESC;
    `;
    const result = await pool.query(query);

    if (result.rows.length > 0) {
      return res.json({
        status: 'success',
        count: result.rows.length,
        donors: result.rows
      });
    }
  } catch (err) {
    // Database offline fallback
  }

  return res.json({
    status: 'success',
    count: inMemoryDonors.length,
    donors: inMemoryDonors
  });
};
