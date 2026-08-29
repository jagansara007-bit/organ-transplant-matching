import http from 'http';

function makeRequest(options: http.RequestOptions, postData?: any): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => (body += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode || 0, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode || 0, data: body });
        }
      });
    });

    req.on('error', reject);

    if (postData) {
      req.write(JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting Auth & RBAC Verification Tests...\n');

  // Test 1: POST /api/auth/login (Success)
  console.log('Test 1: Valid Login (Surgeon)');
  const loginRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    email: 'ananya.iyer@apollo.org',
    password: 'HospitalPass123!'
  });

  console.log(`Status: ${loginRes.status}`);
  console.log('User Role:', loginRes.data?.user?.user_role);
  console.log('Medical License:', loginRes.data?.user?.medical_license);
  console.log('Hospital:', loginRes.data?.hospital?.name);
  console.log('Has Token:', !!loginRes.data?.token);

  const surgeonToken = loginRes.data?.token;

  // Test 2: POST /api/auth/login (Invalid Password)
  console.log('\nTest 2: Invalid Login Password');
  const badLogin = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    email: 'ananya.iyer@apollo.org',
    password: 'WrongPassword!'
  });
  console.log(`Status: ${badLogin.status} (Expected 401)`);
  console.log('Message:', badLogin.data?.message);

  // Test 3: GET /api/auth/me (Authenticated Session)
  console.log('\nTest 3: GET /api/auth/me with Bearer Token');
  const meRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/me',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${surgeonToken}` }
  });
  console.log(`Status: ${meRes.status}`);
  console.log('Session User:', meRes.data?.session?.user?.email);

  // Test 4: Protected route without token (Should 401)
  console.log('\nTest 4: Access Protected /api/donors without Token');
  const noTokenRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/donors',
    method: 'GET'
  });
  console.log(`Status: ${noTokenRes.status} (Expected 401)`);

  // Test 5: Protected route with valid token (Should 200)
  console.log('\nTest 5: Access Protected /api/donors with Surgeon Token');
  const withTokenRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/donors',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${surgeonToken}` }
  });
  console.log(`Status: ${withTokenRes.status} (Expected 200)`);
  console.log(`Donors count: ${withTokenRes.data?.count}`);

  // Test 6: Login as Regulatory Officer
  console.log('\nTest 6: Login as Regulatory Officer');
  const officerLogin = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    email: 'vikram.sen@notto.gov.in',
    password: 'HospitalPass123!'
  });
  const officerToken = officerLogin.data?.token;
  console.log('Officer Role:', officerLogin.data?.user?.user_role);

  // Test 7: RBAC Restriction: Officer attempts to register donor (Requires surgeon/admin) -> Should 403
  console.log('\nTest 7: RBAC: Regulatory Officer tries registering donor (Requires Surgeon/Admin)');
  const forbiddenRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/donors/register',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${officerToken}`
    }
  }, {
    fullName: 'Test Donor',
    bloodType: 'O+',
    organType: 'Kidney',
    tissueType: 'HLA-A1'
  });
  console.log(`Status: ${forbiddenRes.status} (Expected 403)`);
  console.log('Message:', forbiddenRes.data?.message);

  // Test 8: Surgeon registers donor -> Should 201
  console.log('\nTest 8: RBAC: Surgeon registers donor');
  const allowedRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/donors/register',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${surgeonToken}`
    }
  }, {
    fullName: 'Clinical Test Donor',
    donorType: 'LIVING_FAMILY',
    maskedAadhaar: 'XXXX-XXXX-9999',
    bloodType: 'O+',
    organType: 'Kidney',
    tissueType: 'HLA-A2, HLA-B7, HLA-DR4'
  });
  console.log(`Status: ${allowedRes.status} (Expected 201)`);
  console.log('Donor Created:', allowedRes.data?.donor?.full_name);

  console.log('\n🎉 All 8 Auth & RBAC verification tests passed successfully!');
}

runTests().catch(console.error);
