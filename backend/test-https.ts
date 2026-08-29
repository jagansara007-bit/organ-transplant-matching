import https from 'https';

function testHttps() {
  const url = 'https://ohfcrycctnzmwzgxaoys.supabase.co/rest/v1/';
  console.log(`Testing HTTPS endpoint: ${url}...`);

  https.get(url, (res) => {
    console.log(`✅ HTTPS Status: ${res.statusCode} ${res.statusMessage}`);
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      console.log('Response body:', body.slice(0, 200));
    });
  }).on('error', (err) => {
    console.log('❌ HTTPS Error:', err.message);
  });
}

testHttps();
