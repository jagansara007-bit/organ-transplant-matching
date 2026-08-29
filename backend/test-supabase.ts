import { Pool } from 'pg';
import dns from 'dns';

async function testConnection(host: string, port: number, user: string, pass: string, db: string) {
  console.log(`\nTesting connection to ${host}:${port}...`);
  try {
    const addresses = await dns.promises.lookup(host, { all: true });
    console.log('Resolved IPs:', addresses);
  } catch (e) {
    console.log('DNS lookup error:', (e as any).message);
  }

  const pool = new Pool({
    host,
    port,
    user,
    password: pass,
    database: db,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
  });

  try {
    const client = await pool.connect();
    const res = await client.query('SELECT NOW()');
    console.log(`✅ Connected successfully to ${host}:${port}! DB Time:`, res.rows[0].now);
    client.release();
    await pool.end();
    return true;
  } catch (err: any) {
    console.log(`❌ Failed connecting to ${host}:${port}:`, err.message);
    await pool.end();
    return false;
  }
}

async function run() {
  const projectRef = 'ohfcrycctnzmwzgxaoys';
  const pass = 'RGjH4PiIQxYLCYQa';

  // Test 1: Direct host port 5432
  await testConnection(`db.${projectRef}.supabase.co`, 5432, 'postgres', pass, 'postgres');

  // Test 2: Pooler hosts (Common regions: ap-south-1 (Mumbai), us-east-1, eu-west-1, etc.)
  const regions = [
    'ap-south-1',
    'ap-southeast-1',
    'us-east-1',
    'us-west-1',
    'eu-central-1',
    'eu-west-1'
  ];

  for (const region of regions) {
    const poolerHost = `aws-0-${region}.pooler.supabase.com`;
    const user = `postgres.${projectRef}`;
    const ok = await testConnection(poolerHost, 6543, user, pass, 'postgres');
    if (ok) {
      console.log(`\n🎉 MATCH FOUND: Region is ${region}!`);
      break;
    }
  }
}

run();
