import fs from 'fs';
import path from 'path';
import { pool } from '../config/db';

export const runMigrations = async (): Promise<boolean> => {
  console.log('🔄 Running database migrations with STARTER_DATABASE_SCHEMA.sql...');
  try {
    let schemaPath = path.join(__dirname, 'STARTER_DATABASE_SCHEMA.sql');
    if (!fs.existsSync(schemaPath)) {
      schemaPath = path.join(__dirname, 'schema.sql');
    }

    const sql = fs.readFileSync(schemaPath, 'utf-8');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
      console.log('✅ Database migrations executed successfully.');
      console.log('📋 Verified Tables: hospitals, hospital_users, donors, recipients, matches, allocations, regulatory_approvals, audit_log');
      console.log('📊 Verified Views: active_donors, active_recipients, pending_allocations');
      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('❌ Migration failed:', err);
      return false;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('❌ Error reading schema file:', err);
    return false;
  }
};

// If invoked directly from command line (npm run db:migrate)
if (require.main === module) {
  runMigrations()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((err) => {
      console.error('Migration error:', err);
      process.exit(1);
    });
}
