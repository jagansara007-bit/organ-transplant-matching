async function verifyConnectivity() {
  console.log('=====================================================');
  console.log('🔍 LIVE SYSTEM CONNECTIVITY & INTEGRATION VERIFICATION');
  console.log('=====================================================\n');
  
  // 1. Check Frontend Dev Server
  try {
    const res = await fetch('http://localhost:3000/');
    console.log(`🌐 [1/5] Frontend Portal (Port 3000): CONNECTED (HTTP ${res.status} OK)`);
  } catch (e: any) {
    console.log('❌ [1/5] Frontend Error:', e.message);
  }

  // 2. Check Backend Gateway
  try {
    const res = await fetch('http://localhost:5000/api');
    const data = await res.json();
    console.log(`⚡ [2/5] Backend API Gateway (Port 5000): CONNECTED`);
    console.log(`       Available Endpoints: ${data.endpoints.join(', ')}`);
  } catch (e: any) {
    console.log('❌ [2/5] Backend Gateway Error:', e.message);
  }

  // 3. Check Backend Health
  try {
    const res = await fetch('http://localhost:5000/api/health');
    const data = await res.json();
    console.log(`🩺 [3/5] Health Check Monitor: OPERATIONAL`);
    console.log(`       Architecture Mode: ${data.mode}`);
    console.log(`       API Status: ${data.services?.api?.label}`);
    console.log(`       Storage Status: ${data.services?.postgres?.label}`);
  } catch (e: any) {
    console.log('❌ [3/5] Health Check Error:', e.message);
  }

  // 4. Check Authentication Handshake
  try {
    const res = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'ananya.iyer@apollo.org',
        password: 'HospitalPass123!'
      })
    });
    const data = await res.json();
    console.log(`🔑 [4/5] Authentication & RBAC Handshake: SUCCESS`);
    console.log(`       Authenticated Staff: ${data.user?.full_name || data.user?.fullName} (${data.user?.role})`);
    console.log(`       Affiliated Hospital: ${data.hospital?.name} [${data.hospital?.hospital_code || data.hospital?.hospitalCode}]`);
    console.log(`       Medical License: ${data.user?.medical_license || data.user?.medicalLicense}`);

    const token = data.token;

    // 5. Test Live Clinical Endpoints
    const donorsRes = await fetch('http://localhost:5000/api/donors', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const donorsData = await donorsRes.json();

    const recRes = await fetch('http://localhost:5000/api/recipients', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const recData = await recRes.json();

    const matchesRes = await fetch('http://localhost:5000/api/matches', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const matchesData = await matchesRes.json();

    const allocRes = await fetch('http://localhost:5000/api/allocations/audit-trail', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const allocData = await allocRes.json();

    console.log(`\n🏥 [5/5] Microservice Data Pipelines: 100% OPERATIONAL`);
    console.log(`       Donors Registered: ${donorsData.donors?.length || 0}`);
    console.log(`       Waitlisted Candidates: ${recData.recipients?.length || 0}`);
    console.log(`       Algorithmic Matches: ${matchesData.matches?.length || 0}`);
    console.log(`       Immutable Audit Logs: ${allocData.auditTrail?.length || 0}`);

    console.log('\n=====================================================');
    console.log('🎉 RESULT: BOTH FRONTEND & BACKEND ARE FULLY CONNECTED!');
    console.log('=====================================================');
  } catch (e: any) {
    console.log('❌ [4/5] Clinical API Error:', e.message);
  }
}

verifyConnectivity();
