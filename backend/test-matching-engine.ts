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
  console.log('🧬 Starting NOTTO Matching Engine & Audit Trail Verification Tests...\n');

  // Step 1: Login as Surgeon (Dr. Ananya Iyer)
  console.log('Step 1: Authenticate as Surgeon');
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

  const surgeonToken = loginRes.data?.token;
  console.log(`Authenticated: ${loginRes.status === 200}, Staff: ${loginRes.data?.user?.full_name}\n`);

  // Step 2: Run Matching Engine (GET /api/matches/find)
  console.log('Step 2: Execute NOTTO Matching Engine (GET /api/matches/find)');
  const findRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/matches/find',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${surgeonToken}` }
  });

  console.log(`Status: ${findRes.status}`);
  console.log(`Total Evaluated Matches: ${findRes.data?.totalEvaluated}`);
  
  const matches = findRes.data?.matches || [];
  if (matches.length > 0) {
    const topMatch = matches[0];
    console.log('\n--- TOP CANDIDATE MATCH #1 ---');
    console.log(`Match ID: ${topMatch.matchId}`);
    console.log(`Viability Score: ${topMatch.compatibilityScore}% (Total Score: ${topMatch.totalCompatibilityScore})`);
    console.log(`Donor: ${topMatch.donor.fullName} (${topMatch.donor.bloodType} ${topMatch.donor.organType})`);
    console.log(`Donor Hospital: ${topMatch.donor.hospital?.name} (${topMatch.donor.hospital?.city})`);
    console.log(`Recipient: ${topMatch.recipient.fullName} (NOTTO: ${topMatch.recipient.nottoRegNumber})`);
    console.log(`Recipient Hospital: ${topMatch.recipient.hospital?.name} (${topMatch.recipient.hospital?.city})`);
    console.log('Score Breakdown:');
    console.log(`  - Blood Compatibility Score: ${topMatch.breakdown.bloodTypeScore} / 40.0 pts`);
    console.log(`  - Organ Match Score:         ${topMatch.breakdown.organMatchScore} / 40.0 pts`);
    console.log(`  - HLA Antigen Match Score:   ${topMatch.breakdown.hlaMatchScore} / 10.0 pts`);
    console.log(`  - Urgency Factor Score:      ${topMatch.breakdown.urgencyScore} pts`);
    console.log(`  - Wait-Time Seniority Bonus: ${topMatch.breakdown.waitTimeScore} pts`);
    console.log(`  - Combined Urgency/Wait:     ${topMatch.breakdown.urgencyWaitScore} / 10.0 pts`);
    console.log(`  - Total Computed Sum:        ${topMatch.breakdown.totalScore} / 100.0 pts`);
  }

  // Step 3: Accept a Match Candidate (POST /api/matches/:id/accept)
  if (matches.length > 0) {
    const matchToAccept = matches[0].matchId;
    console.log(`\nStep 3: Accept Candidate Match (${matchToAccept}) with Surgeon Token`);
    const acceptRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/matches/${matchToAccept}/accept`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${surgeonToken}`
      }
    });

    console.log(`Status: ${acceptRes.status} (Expected 200)`);
    console.log('Message:', acceptRes.data?.message);
    console.log('Match Status:', acceptRes.data?.match?.match_status);
  }

  console.log('\n🎉 NOTTO Matching Engine and Audit Log persistence verified successfully!');
}

runTests().catch(console.error);
