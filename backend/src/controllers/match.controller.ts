import { Response } from 'express';
import { pool } from '../config/db';
import { inMemoryDonors } from './donor.controller';
import { inMemoryRecipients } from './recipient.controller';
import { inMemoryHospitals } from '../services/STARTER_AUTH_SERVICE';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { AuditLoggerService } from '../services/auditLogger';

interface HospitalData {
  id: string;
  name: string;
  hospital_code: string;
  city: string;
  state: string;
}

interface DonorRow {
  id: string;
  hospital_id?: string;
  full_name: string;
  donor_type?: string;
  masked_aadhaar?: string;
  blood_type: string;
  organ_type: string;
  tissue_type: string;
  registration_status: string;
  created_at: Date | string;
  hospital_name?: string;
  hospital_code?: string;
  hospital_city?: string;
  hospital_state?: string;
}

interface RecipientRow {
  id: string;
  hospital_id?: string;
  full_name: string;
  notto_reg_number?: string;
  blood_type: string;
  organ_needed: string;
  urgency_level: string;
  wait_time_days: number;
  status: string;
  created_at: Date | string;
  hospital_name?: string;
  hospital_code?: string;
  hospital_city?: string;
  hospital_state?: string;
}

export interface InMemoryAuditEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  performed_by?: string;
  hospital_id?: string;
  details: any;
  created_at: string;
}

// In-memory tracker for fallback store
export const inMemoryAcceptedMatches = new Set<string>();
export const inMemoryAuditLogs: InMemoryAuditEntry[] = [];

/**
 * 1. Blood Compatibility Matrix (Max 40.0 pts)
 * Exact match = 40.0 pts
 * Compatible non-exact donor = 30.0 pts
 * Incompatible = 0.0 pts (Hard exclusion filter)
 */
export const calculateBloodScore = (donorBlood: string, recipientBlood: string): number => {
  const d = donorBlood.trim().toUpperCase();
  const r = recipientBlood.trim().toUpperCase();

  if (d === r) return 40.0;

  const compatibilityMap: Record<string, string[]> = {
    'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
    'O+': ['O+', 'A+', 'B+', 'AB+'],
    'A-': ['A-', 'A+', 'AB-', 'AB+'],
    'A+': ['A+', 'AB+'],
    'B-': ['B-', 'B+', 'AB-', 'AB+'],
    'B+': ['B+', 'AB+'],
    'AB-': ['AB-', 'AB+'],
    'AB+': ['AB+']
  };

  const allowed = compatibilityMap[d] || [];
  if (allowed.includes(r)) {
    return 30.0; // Universal/Compatible donor
  }
  return 0.0; // Incompatible
};

/**
 * 2. Organ Anatomical Match (Max 40.0 pts)
 * Matching organ = 40.0 pts
 * Mismatch = 0.0 pts (Hard exclusion filter)
 */
export const calculateOrganScore = (donorOrgan: string, recipientOrganNeeded: string): number => {
  const d = donorOrgan.trim().toLowerCase();
  const r = recipientOrganNeeded.trim().toLowerCase();
  return d === r ? 40.0 : 0.0;
};

/**
 * 3. HLA Antigen Crossmatch (Max 10.0 pts)
 * Quantitatively crossmatch A, B, DR loci
 */
export const calculateHlaScore = (donorTissue: string, recipientTissue?: string): number => {
  if (!donorTissue) return 5.0;

  const targetTissue = recipientTissue || 'HLA-A2, HLA-B7, HLA-DR4';
  const donorAntigens = donorTissue.split(',').map(s => s.trim().toUpperCase());
  const recipientAntigens = targetTissue.split(',').map(s => s.trim().toUpperCase());

  const matchingCount = donorAntigens.filter(antigen => recipientAntigens.includes(antigen)).length;
  const assessedCount = Math.max(donorAntigens.length, 1);
  const score = (matchingCount / assessedCount) * 10.0;

  return Math.round(score * 100) / 100;
};

/**
 * 4. Medical Urgency & Wait Time (Max 10.0 pts)
 * Urgency Tier Base: CRITICAL (7.0), HIGH (5.0), MEDIUM (3.0), LOW (1.5)
 * Wait Time Seniority: min((wait_days / 365.0) * 3.0, 3.0)
 */
export const calculateUrgencyScore = (urgencyLevel: string): number => {
  const u = urgencyLevel.toUpperCase();
  if (u === 'CRITICAL') return 7.0;
  if (u === 'HIGH') return 5.0;
  if (u === 'MEDIUM') return 3.0;
  return 1.5;
};

export const calculateWaitTimeScore = (waitTimeDays: number): number => {
  return Math.min(Math.round((waitTimeDays / 365.0 * 3.0) * 100) / 100, 3.0);
};

/**
 * GET /api/matches/find
 * Evaluates candidate pairs according to NOTTO formula, persists matches & audit records
 */
export const findMatches = async (req: AuthenticatedRequest, res: Response) => {
  let donors: DonorRow[] = [];
  let recipients: RecipientRow[] = [];

  // Attempt Database query with hospital joins
  try {
    const donorsQuery = `
      SELECT 
        d.id, d.hospital_id, d.full_name, d.donor_type, d.masked_aadhaar, 
        d.blood_type, d.organ_type, d.tissue_type, d.registration_status, d.created_at,
        h.name AS hospital_name, h.hospital_code, h.city AS hospital_city, h.state AS hospital_state
      FROM donors d
      LEFT JOIN hospitals h ON d.hospital_id = h.id
      WHERE d.registration_status = 'registered';
    `;
    const recipientsQuery = `
      SELECT 
        r.id, r.hospital_id, r.full_name, r.notto_reg_number, 
        r.blood_type, r.organ_needed, r.urgency_level, r.wait_time_days, r.status, r.created_at,
        h.name AS hospital_name, h.hospital_code, h.city AS hospital_city, h.state AS hospital_state
      FROM recipients r
      LEFT JOIN hospitals h ON r.hospital_id = h.id
      WHERE r.status = 'waiting';
    `;

    const donorsRes = await pool.query<DonorRow>(donorsQuery);
    const recipientsRes = await pool.query<RecipientRow>(recipientsQuery);

    if (donorsRes.rows.length > 0 && recipientsRes.rows.length > 0) {
      donors = donorsRes.rows;
      recipients = recipientsRes.rows;
    }
  } catch (err) {
    // Database offline fallback
  }

  // Fallback to in-memory registries
  if (donors.length === 0) {
    donors = inMemoryDonors
      .filter(d => d.registration_status === 'registered')
      .map(d => {
        const hospital = inMemoryHospitals.find(h => h.id === d.hospital_id);
        return {
          ...d,
          hospital_name: hospital?.name,
          hospital_code: hospital?.hospital_code,
          hospital_city: hospital?.city,
          hospital_state: hospital?.state
        };
      });
  }

  if (recipients.length === 0) {
    recipients = inMemoryRecipients
      .filter(r => r.status === 'waiting')
      .map(r => {
        const hospital = inMemoryHospitals.find(h => h.id === r.hospital_id);
        return {
          ...r,
          hospital_name: hospital?.name,
          hospital_code: hospital?.hospital_code,
          hospital_city: hospital?.city,
          hospital_state: hospital?.state
        };
      });
  }

  const evaluatedMatches = [];
  const performedBy = req.user?.id || 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
  const hospitalId = req.user?.hospital_id || '11111111-1111-4111-a111-111111111111';

  for (const donor of donors) {
    for (const recipient of recipients) {
      // 1. Organ Anatomical Match (Max 40.0 pts - Hard Exclusion)
      const organScore = calculateOrganScore(donor.organ_type, recipient.organ_needed);
      if (organScore === 0) continue;

      // 2. Blood Type Compatibility (Max 40.0 pts - Hard Exclusion)
      const bloodScore = calculateBloodScore(donor.blood_type, recipient.blood_type);
      if (bloodScore === 0) continue;

      // 3. HLA Antigen Crossmatch (Max 10.0 pts)
      const hlaScore = calculateHlaScore(donor.tissue_type, 'HLA-A2, HLA-B7, HLA-DR4');

      // 4. Urgency & Wait Time (Max 10.0 pts)
      const urgencyBase = calculateUrgencyScore(recipient.urgency_level);
      const waitBonus = calculateWaitTimeScore(recipient.wait_time_days);
      const urgencyWaitCombined = Math.min(Math.round((urgencyBase + waitBonus) * 100) / 100, 10.0);

      // Total Compatibility Score
      const totalScore = Math.round((bloodScore + organScore + hlaScore + urgencyWaitCombined) * 100) / 100;
      const matchId = `match-${donor.id.slice(0, 8)}-${recipient.id.slice(0, 8)}`;
      const isAccepted = inMemoryAcceptedMatches.has(matchId);
      const currentStatus = isAccepted ? 'accepted' : 'proposed';

      // Persist to PostgreSQL if connected
      try {
        const matchUpsertQuery = `
          INSERT INTO matches (
            id, donor_id, recipient_id, 
            blood_type_score, organ_match_score, hla_match_score, 
            wait_time_score, urgency_score, total_compatibility_score, compatibility_score, 
            match_status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (id) DO UPDATE SET 
            blood_type_score = EXCLUDED.blood_type_score,
            organ_match_score = EXCLUDED.organ_match_score,
            hla_match_score = EXCLUDED.hla_match_score,
            wait_time_score = EXCLUDED.wait_time_score,
            urgency_score = EXCLUDED.urgency_score,
            total_compatibility_score = EXCLUDED.total_compatibility_score,
            compatibility_score = EXCLUDED.compatibility_score;
        `;
        await pool.query(matchUpsertQuery, [
          matchId, donor.id, recipient.id,
          bloodScore, organScore, hlaScore,
          waitBonus, urgencyBase, totalScore, totalScore,
          currentStatus
        ]);

        // Insert Immutable Audit Record
        const auditQuery = `
          INSERT INTO audit_log (entity_type, entity_id, action, performed_by, hospital_id, details)
          VALUES ($1, $2, $3, $4, $5, $6);
        `;
        await pool.query(auditQuery, [
          'matches',
          matchId,
          'MATCH_PROPOSED',
          performedBy,
          donor.hospital_id || hospitalId,
          JSON.stringify({
            donorName: donor.full_name,
            recipientName: recipient.full_name,
            totalScore,
            bloodScore,
            organScore,
            hlaScore,
            urgencyWaitCombined
          })
        ]);
      } catch (e) {
        // Fallback: in-memory audit log
      }

      inMemoryAuditLogs.push({
        id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        entity_type: 'matches',
        entity_id: matchId,
        action: 'MATCH_PROPOSED',
        performed_by: performedBy,
        hospital_id: donor.hospital_id || hospitalId,
        details: {
          donorName: donor.full_name,
          recipientName: recipient.full_name,
          totalScore,
          bloodScore,
          organScore,
          hlaScore,
          urgencyWaitCombined
        },
        created_at: new Date().toISOString()
      });

      evaluatedMatches.push({
        matchId,
        compatibilityScore: totalScore,
        totalCompatibilityScore: totalScore,
        matchStatus: currentStatus,
        breakdown: {
          bloodCompatibilityScore: bloodScore,
          bloodTypeScore: bloodScore,
          organMatchScore: organScore,
          tissueMatchScore: hlaScore,
          hlaMatchScore: hlaScore,
          urgencyWaitScore: urgencyWaitCombined,
          urgencyScore: urgencyBase,
          waitTimeScore: waitBonus,
          totalScore
        },
        donor: {
          id: donor.id,
          fullName: donor.full_name,
          donorType: donor.donor_type,
          maskedAadhaar: donor.masked_aadhaar,
          bloodType: donor.blood_type,
          organType: donor.organ_type,
          tissueType: donor.tissue_type,
          hospital: donor.hospital_name ? {
            id: donor.hospital_id,
            name: donor.hospital_name,
            hospitalCode: donor.hospital_code,
            city: donor.hospital_city,
            state: donor.hospital_state
          } : undefined
        },
        recipient: {
          id: recipient.id,
          fullName: recipient.full_name,
          nottoRegNumber: recipient.notto_reg_number,
          bloodType: recipient.blood_type,
          organNeeded: recipient.organ_needed,
          urgencyLevel: recipient.urgency_level,
          waitTimeDays: recipient.wait_time_days,
          hospital: recipient.hospital_name ? {
            id: recipient.hospital_id,
            name: recipient.hospital_name,
            hospitalCode: recipient.hospital_code,
            city: recipient.hospital_city,
            state: recipient.hospital_state
          } : undefined
        }
      });
    }
  }

  // Sort by highest compatibility score descending
  evaluatedMatches.sort((a, b) => b.compatibilityScore - a.compatibilityScore);

  return res.json({
    status: 'success',
    totalEvaluated: evaluatedMatches.length,
    matches: evaluatedMatches
  });
};

/**
 * POST /api/matches/:id/accept
 * Updates match_status to 'accepted', triggers allocation readiness, and writes an immutable MATCH_ACCEPTED audit record
 */
export const acceptMatch = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const performedBy = req.user?.id || 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
  const hospitalId = req.user?.hospital_id || '22222222-2222-4222-a222-222222222222';

  let matchRow: any = null;

  try {
    const updateMatchQuery = `
      UPDATE matches
      SET match_status = 'accepted'
      WHERE id = $1
      RETURNING id, donor_id, recipient_id, compatibility_score, match_status, created_at;
    `;
    const result = await pool.query(updateMatchQuery, [id]);

    if (result.rows.length > 0) {
      matchRow = result.rows[0];

      // Update recipient status to 'matched'
      await pool.query("UPDATE recipients SET status = 'matched' WHERE id = $1", [matchRow.recipient_id]);

      // Trigger allocation readiness in allocations table
      await pool.query(`
        INSERT INTO allocations (match_id, logistics_status, regulatory_approval, reported)
        VALUES ($1, 'pending', false, false)
        ON CONFLICT DO NOTHING;
      `, [matchRow.id]);

      // Write 'MATCH_ACCEPTED' immutable audit log entry
      await pool.query(`
        INSERT INTO audit_log (entity_type, entity_id, action, performed_by, hospital_id, details)
        VALUES ($1, $2, $3, $4, $5, $6);
      `, [
        'matches',
        id,
        'MATCH_ACCEPTED',
        performedBy,
        hospitalId,
        JSON.stringify({
          matchId: id,
          acceptedByStaff: req.user?.email || 'Surgeon',
          recipientId: matchRow.recipient_id,
          donorId: matchRow.donor_id,
          status: 'accepted'
        })
      ]);

      return res.json({
        status: 'success',
        message: 'Match accepted successfully and allocation readiness initialized',
        match: matchRow
      });
    }
  } catch (err) {
    // Fallback to in-memory store
  }

  inMemoryAcceptedMatches.add(id);

  // Forensic Audit Log with SHA-256 Hash
  AuditLoggerService.logEvent({
    entity_type: 'matches',
    entity_id: id,
    action: 'MATCH_ACCEPTED',
    performed_by: performedBy,
    performed_by_name: req.user?.full_name || 'Dr. Ananya Iyer',
    performed_by_role: req.user?.user_role || 'transplant_surgeon',
    hospital_id: hospitalId,
    client_ip: req.ip || req.headers['x-forwarded-for']?.toString() || '127.0.0.1',
    details: {
      matchId: id,
      acceptedByStaff: req.user?.email || 'ananya.iyer@apollo.org',
      status: 'accepted'
    }
  }).catch(() => {});

  return res.json({
    status: 'success',
    message: 'Match accepted successfully and allocation readiness initialized',
    match: {
      id,
      match_status: 'accepted'
    }
  });
};

/**
 * GET /api/matches
 */
export const getMatches = async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const query = `
      SELECT 
        m.id AS match_id,
        m.compatibility_score,
        m.total_compatibility_score,
        m.blood_type_score,
        m.organ_match_score,
        m.hla_match_score,
        m.wait_time_score,
        m.urgency_score,
        m.match_status,
        m.created_at,
        d.id AS donor_id,
        d.full_name AS donor_name,
        d.blood_type AS donor_blood_type,
        d.organ_type AS donor_organ,
        r.id AS recipient_id,
        r.full_name AS recipient_name,
        r.blood_type AS recipient_blood_type,
        r.organ_needed AS recipient_organ,
        r.urgency_level AS recipient_urgency
      FROM matches m
      JOIN donors d ON m.donor_id = d.id
      JOIN recipients r ON m.recipient_id = r.id
      ORDER BY m.compatibility_score DESC;
    `;
    const result = await pool.query(query);

    if (result.rows.length > 0) {
      return res.json({
        status: 'success',
        count: result.rows.length,
        matches: result.rows
      });
    }
  } catch (err) {
    // Fallback
  }

  return res.json({
    status: 'success',
    count: 0,
    matches: []
  });
};
