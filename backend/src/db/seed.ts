import { pool } from '../config/db';

export const seedDatabase = async (): Promise<boolean> => {
  console.log('🌱 Starting idempotent database seeding with Indian clinical registry data...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 0. Clean existing tables for idempotent execution
    await client.query(`
      TRUNCATE 
        audit_log, 
        regulatory_approvals, 
        allocations, 
        matches, 
        recipients, 
        donors, 
        hospital_users, 
        hospitals 
      CASCADE
    `);
    console.log('🧹 Cleaned existing database records.');

    // 1. Seed 3 Verified Hospitals
    const hospitalQuery = `
      INSERT INTO hospitals (id, name, hospital_code, city, state, verification_status)
      VALUES 
        ('11111111-1111-4111-a111-111111111111', 'All India Institute of Medical Sciences (AIIMS)', 'AIIMS-DEL-01', 'New Delhi', 'Delhi', 'verified'),
        ('22222222-2222-4222-a222-222222222222', 'Apollo Hospitals Enterprise', 'APOLLO-CHE-02', 'Chennai', 'Tamil Nadu', 'verified'),
        ('33333333-3333-4333-a333-333333333333', 'Fortis Memorial Research Institute', 'FMRI-GGN-03', 'Gurugram', 'Haryana', 'verified')
      RETURNING id, name, hospital_code;
    `;
    const hospitalRes = await client.query(hospitalQuery);
    console.log(`🏥 Seeded ${hospitalRes.rows.length} verified hospitals.`);

    const aiimsId = hospitalRes.rows[0].id;
    const apolloId = hospitalRes.rows[1].id;
    const fortisId = hospitalRes.rows[2].id;

    // 2. Seed 3 Authorized Hospital Users (Admin, Transplant Surgeon, Regulatory Officer)
    const defaultPasswordHash = '$2a$10$wT0E8k2sSjLkJL1WpPnUSe9Z1tqU7U/mXyE97h6Z8v6bY6Hqg2q7e'; // HospitalPass123!
    const usersQuery = `
      INSERT INTO hospital_users (id, hospital_id, full_name, email, password_hash, medical_license, role, is_authorized)
      VALUES 
        ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', $1, 'Dr. Rajesh Sharma', 'rajesh.sharma@aiims.edu', '${defaultPasswordHash}', 'MCI-DEL-10482', 'ADMIN', true),
        ('bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', $2, 'Dr. Ananya Iyer', 'ananya.iyer@apollo.org', '${defaultPasswordHash}', 'MCI-TN-89211', 'TRANSPLANT_SURGEON', true),
        ('cccccccc-cccc-4ccc-cccc-cccccccccccc', $3, 'Officer Vikramaditya Sen', 'vikram.sen@notto.gov.in', '${defaultPasswordHash}', 'NOTTO-REG-0994', 'REGULATORY_OFFICER', true)
      RETURNING id, full_name, role;
    `;
    const usersRes = await client.query(usersQuery, [aiimsId, apolloId, fortisId]);
    console.log(`👨‍⚕️ Seeded ${usersRes.rows.length} authorized hospital users.`);

    const adminUserId = usersRes.rows[0].id;
    const regulatoryOfficerId = usersRes.rows[2].id;

    // 3. Seed 5 Deceased / Living Family Donors with Masked Aadhaar Numbers
    const donorQuery = `
      INSERT INTO donors (id, hospital_id, full_name, donor_type, masked_aadhaar, blood_type, organ_type, tissue_type, registration_status)
      VALUES 
        ('d1010000-0000-4000-8000-000000000101', $1, 'Dr. Alan Grant', 'DECEASED', 'XXXX-XXXX-8921', 'O+', 'Kidney', 'HLA-A2, HLA-B7, HLA-DR4', 'registered'),
        ('d1020000-0000-4000-8000-000000000102', $2, 'Sarah Connor', 'LIVING_FAMILY', 'XXXX-XXXX-3412', 'A-', 'Liver', 'HLA-A1, HLA-B8, HLA-DR3', 'registered'),
        ('d1030000-0000-4000-8000-000000000103', $3, 'Bruce Wayne', 'DECEASED', 'XXXX-XXXX-7654', 'B+', 'Heart', 'HLA-A3, HLA-B27, HLA-DR1', 'registered'),
        ('d1040000-0000-4000-8000-000000000104', $1, 'Diana Prince', 'LIVING_FAMILY', 'XXXX-XXXX-9081', 'O+', 'Kidney', 'HLA-A2, HLA-B44, HLA-DR4', 'registered'),
        ('d1050000-0000-4000-8000-000000000105', $2, 'Clark Kent', 'DECEASED', 'XXXX-XXXX-5543', 'A-', 'Heart', 'HLA-A24, HLA-B35, HLA-DR11', 'registered')
      RETURNING id, full_name, donor_type, masked_aadhaar, organ_type;
    `;
    const donorRes = await client.query(donorQuery, [aiimsId, apolloId, fortisId]);
    console.log(`🫀 Seeded ${donorRes.rows.length} donors with masked Aadhaar numbers.`);

    // 4. Seed 5 Waitlisted Recipients with valid NOTTO Registration Numbers
    const recipientQuery = `
      INSERT INTO recipients (id, hospital_id, full_name, notto_reg_number, blood_type, organ_needed, urgency_level, wait_time_days, status)
      VALUES 
        ('f5010000-0000-4000-8000-000000000501', $1, 'John H. Watson', 'NOTTO-REC-2026-001', 'O+', 'Kidney', 'CRITICAL', 410, 'waiting'),
        ('f5020000-0000-4000-8000-000000000502', $2, 'Ellen Ripley', 'NOTTO-REC-2026-002', 'A-', 'Liver', 'HIGH', 190, 'waiting'),
        ('f5030000-0000-4000-8000-000000000503', $3, 'Arthur Dent', 'NOTTO-REC-2026-003', 'B+', 'Heart', 'CRITICAL', 85, 'waiting'),
        ('f5040000-0000-4000-8000-000000000504', $1, 'James T. Kirk', 'NOTTO-REC-2026-004', 'O+', 'Kidney', 'MEDIUM', 280, 'waiting'),
        ('f5050000-0000-4000-8000-000000000505', $2, 'Natasha Romanoff', 'NOTTO-REC-2026-005', 'A-', 'Heart', 'HIGH', 320, 'waiting')
      RETURNING id, full_name, notto_reg_number, organ_needed, urgency_level;
    `;
    const recipientRes = await client.query(recipientQuery, [aiimsId, apolloId, fortisId]);
    console.log(`📋 Seeded ${recipientRes.rows.length} waitlisted recipients with valid NOTTO registration numbers.`);

    // 5. Seed Matches
    const matchQuery = `
      INSERT INTO matches (
        id, donor_id, recipient_id, 
        blood_type_score, organ_match_score, hla_match_score, wait_time_score, urgency_score, 
        total_compatibility_score, compatibility_score, match_status
      ) VALUES 
        ('c7010000-0000-4000-8000-000000000701', 'd1010000-0000-4000-8000-000000000101', 'f5010000-0000-4000-8000-000000000501', 40.00, 40.00, 10.00, 3.00, 7.00, 100.00, 100.00, 'proposed'),
        ('c7020000-0000-4000-8000-000000000702', 'd1020000-0000-4000-8000-000000000102', 'f5020000-0000-4000-8000-000000000502', 40.00, 40.00, 0.00, 1.56, 5.00, 86.56, 86.56, 'accepted')
      RETURNING id;
    `;
    const matchRes = await client.query(matchQuery);
    console.log(`🔗 Seeded ${matchRes.rows.length} match pairings.`);

    // 6. Seed Allocations
    const allocationQuery = `
      INSERT INTO allocations (id, match_id, logistics_status, regulatory_approval, reported)
      VALUES 
        ('a9010000-0000-4000-8000-000000000901', 'c7020000-0000-4000-8000-000000000702', 'in_transit', true, true)
      RETURNING id;
    `;
    const allocationRes = await client.query(allocationQuery);
    const allocationId = allocationRes.rows[0].id;
    console.log('🚚 Seeded active allocation record.');

    // 7. Seed Regulatory Approvals
    await client.query(`
      INSERT INTO regulatory_approvals (allocation_id, officer_id, approval_status, compliance_notes)
      VALUES ($1, $2, 'APPROVED', 'NOTTO Form 8 & State Authorization Committee clearance verified.');
    `, [allocationId, regulatoryOfficerId]);
    console.log('⚖️ Seeded regulatory approval record.');

    // 8. Seed Audit Log Entries
    await client.query(`
      INSERT INTO audit_log (entity_type, entity_id, action, performed_by, details)
      VALUES 
        ('HOSPITAL', $1, 'HOSPITAL_VERIFIED', $2, '{"details": "AIIMS New Delhi verified for Organ Retrieval and Transplantation"}'),
        ('DONOR', 'd1010000-0000-4000-8000-000000000101', 'DONOR_REGISTERED', $2, '{"maskedAadhaar": "XXXX-XXXX-8921", "type": "DECEASED"}'),
        ('RECIPIENT', 'r5010000-0000-4000-8000-000000000501', 'RECIPIENT_WAITLISTED', $2, '{"nottoRegNumber": "NOTTO-REC-2026-001", "urgency": "CRITICAL"}'),
        ('ALLOCATION', $3, 'ALLOCATION_APPROVED', $4, '{"status": "in_transit", "nottoCompliance": true}')
    `, [aiimsId, adminUserId, allocationId, regulatoryOfficerId]);
    console.log('📜 Seeded initial compliance audit log entries.');

    await client.query('COMMIT');
    console.log('🎉 Idempotent database seeding completed successfully!');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Database seeding error:', err);
    return false;
  } finally {
    client.release();
  }
};

// If invoked directly from command line (npm run db:seed)
if (require.main === module) {
  seedDatabase()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((err) => {
      console.error('Fatal seed script error:', err);
      process.exit(1);
    });
}
