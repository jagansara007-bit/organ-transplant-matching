import { Pool } from 'pg';

async function testPooler(region: string) {
  const host = `aws-0-${region}.pooler.supabase.com`;
  const user = `postgres.ohfcrycctnzmwzgxaoys`;
  const pass = `RGjH4PiIQxYLCYQa`;
  
  const pool = new Pool({
    host,
    port: 5432,
    user,
    password: pass,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 4000
  });

  try {
    const client = await pool.connect();
    const res = await client.query('SELECT NOW()');
    console.log(`✅ SUCCESS! Connected to ${region} on port 5432! Time:`, res.rows[0].now);
    client.release();
    await pool.end();
    return true;
  } catch (err: any) {
    console.log(`Failed ${region}:`, err.message);
    await pool.end();
    return false;
  }
}

async function main() {
  const regions = [
    'ap-south-1',       // Mumbai
    'ap-southeast-1',   // Singapore
    'ap-southeast-2',   // Sydney
    'ap-northeast-1',   // Tokyo
    'us-east-1',        // N. Virginia
    'us-east-2',        // Ohio
    'us-west-1',        // N. California
    'us-west-2',        // Oregon
    'eu-central-1',     // Frankfurt
    'eu-west-1',        // Ireland
    'eu-west-2',        // London
    'eu-west-3',        // Paris
    'sa-east-1',        // São Paulo
    'ca-central-1',     // Canada
    'me-central-1'      // Middle East
  ];

  for (const r of regions) {
    const ok = await testPooler(r);
    if (ok) {
      console.log(`\n🎉 PERFECT! Active Supabase Pooler Region is: aws-0-${r}.pooler.supabase.com:5432`);
      break;
    }
  }
}

main();
