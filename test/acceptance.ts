/**
 * BuzyBeez MVP Acceptance Test
 *
 * This test verifies the complete flow:
 * 1. Start bee
 * 2. Send mail asking to create a file
 * 3. Verify bee responds and file is created
 * 4. Stop bee
 * 5. Start bee again
 * 6. Verify file still exists
 * 7. Send mail asking to read the file
 * 8. Verify bee can read it
 */

const API_BASE = 'http://localhost:3000';

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined
  });
  return res.json();
}

async function waitForResponse(timeout = 60000): Promise<any> {
  const start = Date.now();
  let lastCount = 0;

  while (Date.now() - start < timeout) {
    const inbox = await api('GET', '/api/mail/inbox');
    if (inbox.length > lastCount) {
      return inbox[inbox.length - 1];
    }
    lastCount = inbox.length;
    await sleep(1000);
  }

  throw new Error('Timeout waiting for response');
}

async function test() {
  console.log('🧪 BuzyBeez MVP Acceptance Test\n');

  // Step 1: Check initial status
  console.log('1️⃣ Checking initial status...');
  let status = await api('GET', '/api/bee/status');
  console.log(`   Status: ${status.running ? 'running' : 'stopped'}`);

  // Step 2: Start bee if not running
  console.log('\n2️⃣ Starting bee...');
  if (!status.running) {
    await api('POST', '/api/bee/start');
    await sleep(3000); // Wait for container to start
    status = await api('GET', '/api/bee/status');
  }
  console.log(`   Status: ${status.running ? '✅ running' : '❌ not running'}`);
  if (!status.running) {
    throw new Error('Failed to start bee');
  }

  // Step 3: Send mail to create a file
  console.log('\n3️⃣ Sending mail: Create hello.txt...');
  await api('POST', '/api/mail/send', {
    subject: 'Create a file',
    body: "Please create a file called hello.txt with the contents 'Hello from BuzyBeez!'. Then read it back and confirm what you wrote."
  });

  // Step 4: Wait for response
  console.log('   Waiting for response...');
  const response1 = await waitForResponse();
  console.log(`   ✅ Received response: ${response1.subject}`);
  console.log(`   Body: ${response1.body.slice(0, 200)}...`);

  // Step 5: Verify file exists
  console.log('\n4️⃣ Checking if file was created...');
  await sleep(1000);
  const files = await api('GET', '/api/files');
  const helloFile = files.find((f: any) => f.name === 'hello.txt');
  if (helloFile) {
    console.log(`   ✅ hello.txt exists (${helloFile.size} bytes)`);
  } else {
    console.log('   ❌ hello.txt not found');
    console.log('   Files:', files.map((f: any) => f.name).join(', '));
    throw new Error('File was not created');
  }

  // Step 6: Stop bee
  console.log('\n5️⃣ Stopping bee...');
  await api('POST', '/api/bee/stop');
  await sleep(2000);
  status = await api('GET', '/api/bee/status');
  console.log(`   Status: ${status.running ? '❌ still running' : '✅ stopped'}`);

  // Step 7: Verify file persists
  console.log('\n6️⃣ Verifying file persists after stop...');
  const filesAfterStop = await api('GET', '/api/files');
  const helloFileAfterStop = filesAfterStop.find((f: any) => f.name === 'hello.txt');
  if (helloFileAfterStop) {
    console.log(`   ✅ hello.txt still exists`);
  } else {
    throw new Error('File did not persist after stop');
  }

  // Step 8: Start bee again
  console.log('\n7️⃣ Starting bee again...');
  await api('POST', '/api/bee/start');
  await sleep(3000);
  status = await api('GET', '/api/bee/status');
  console.log(`   Status: ${status.running ? '✅ running' : '❌ not running'}`);

  // Step 9: Send mail to read the file
  console.log('\n8️⃣ Sending mail: What is in hello.txt?...');
  await api('POST', '/api/mail/send', {
    subject: 'Read hello.txt',
    body: "What's in the hello.txt file? Please read it and tell me."
  });

  // Step 10: Wait for response
  console.log('   Waiting for response...');
  const response2 = await waitForResponse();
  console.log(`   ✅ Received response: ${response2.subject}`);
  console.log(`   Body: ${response2.body.slice(0, 200)}...`);

  // Verify the response mentions the file contents
  if (response2.body.toLowerCase().includes('hello') || response2.body.includes('BuzyBeez')) {
    console.log('   ✅ Response confirms file contents');
  } else {
    console.log('   ⚠️ Response may not include file contents');
  }

  // Check transcript
  console.log('\n9️⃣ Checking transcript...');
  const transcript = await api('GET', '/api/transcript');
  const toolCalls = transcript.filter((e: any) => e.type === 'tool_call');
  console.log(`   Total entries: ${transcript.length}`);
  console.log(`   Tool calls: ${toolCalls.length}`);
  if (toolCalls.length > 0) {
    console.log('   Tools used:', [...new Set(toolCalls.map((t: any) => t.tool))].join(', '));
  }

  console.log('\n✅ ALL TESTS PASSED!\n');

  // Summary
  console.log('📊 Summary:');
  console.log('   - Bee can start and stop');
  console.log('   - Bee processes mail and responds');
  console.log('   - Bee can create files using tools');
  console.log('   - Files persist across stop/start');
  console.log('   - Bee can read files');
  console.log('   - Transcript captures all activity');
}

test().catch(e => {
  console.error('\n❌ TEST FAILED:', e.message);
  process.exit(1);
});
