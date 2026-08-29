import crypto from 'crypto';
import { pool } from '../config/db';

export interface ForensicAuditEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  performed_by: string;
  performed_by_name?: string;
  performed_by_role?: string;
  hospital_id: string;
  hospital_name?: string;
  client_ip: string;
  payload_sha256_hash: string;
  details: Record<string, any>;
  created_at: string;
}

export const inMemoryForensicAuditTrail: ForensicAuditEntry[] = [];

export class AuditLoggerService {
  /**
   * Logs a structured forensic compliance audit event with SHA-256 integrity hash
   */
  static async logEvent(params: {
    entity_type: string;
    entity_id: string;
    action: string;
    performed_by: string;
    performed_by_name?: string;
    performed_by_role?: string;
    hospital_id?: string;
    hospital_name?: string;
    client_ip?: string;
    details: Record<string, any>;
  }): Promise<ForensicAuditEntry> {
    const {
      entity_type,
      entity_id,
      action,
      performed_by,
      performed_by_name,
      performed_by_role,
      hospital_id = '22222222-2222-4222-a222-222222222222',
      hospital_name = 'Apollo Hospitals Enterprise',
      client_ip = '127.0.0.1',
      details
    } = params;

    // Compute cryptographic SHA-256 integrity hash of payload details
    const serializedDetails = JSON.stringify(details);
    const payload_sha256_hash = crypto.createHash('sha256').update(serializedDetails).digest('hex');

    const auditId = `aud-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const timestamp = new Date().toISOString();

    const entry: ForensicAuditEntry = {
      id: auditId,
      entity_type,
      entity_id,
      action,
      performed_by,
      performed_by_name: performed_by_name || 'Hospital Personnel',
      performed_by_role: performed_by_role || 'CLINICAL_STAFF',
      hospital_id,
      hospital_name,
      client_ip,
      payload_sha256_hash,
      details,
      created_at: timestamp
    };

    // Store in-memory
    inMemoryForensicAuditTrail.unshift(entry);

    // Persist to PostgreSQL if connected
    try {
      const insertQuery = `
        INSERT INTO audit_log (entity_type, entity_id, action, performed_by, hospital_id, details)
        VALUES ($1, $2, $3, $4, $5, $6);
      `;
      await pool.query(insertQuery, [
        entity_type,
        entity_id,
        action,
        performed_by,
        hospital_id,
        JSON.stringify({
          ...details,
          _forensic_meta: {
            client_ip,
            payload_sha256_hash,
            performed_by_name,
            performed_by_role
          }
        })
      ]);
    } catch {
      // Offline fallback
    }

    console.log(`📜 [FORENSIC_AUDIT_LOG] Action: ${action} | Entity: ${entity_type}:${entity_id} | Hash: ${payload_sha256_hash.slice(0, 16)}... | IP: ${client_ip}`);
    return entry;
  }

  static getAuditLogs(): ForensicAuditEntry[] {
    return inMemoryForensicAuditTrail;
  }
}
