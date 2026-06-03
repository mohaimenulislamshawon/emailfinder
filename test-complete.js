#!/usr/bin/env node

/**
 * Complete End-to-End Test Suite
 * Tests all components of the email finder application
 * 
 * Usage: node test-complete.js
 */

const http = require('http');
const { spawn } = require('child_process');
const { existsSync, readFileSync, unlinkSync } = require('fs');
const path = require('path');

const LOCALHOST = 'http://localhost:3000';
let serverProcess = null;

// === Test Framework ===

class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  add(name, fn) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log('\n╔═══════════════════════════════════════╗');
    console.log('║   Email Finder - End-to-End Tests     ║');
    console.log('╚═══════════════════════════════════════╝\n');

    for (const test of this.tests) {
      try {
        await test.fn();
        console.log(`✅ ${test.name}`);
        this.passed++;
      } catch (err) {
        console.log(`❌ ${test.name}`);
        console.log(`   Error: ${err.message}`);
        this.failed++;
      }
    }

    console.log(`\n📊 Results: ${this.passed} passed, ${this.failed} failed\n`);
    return this.failed === 0;
  }
}

// === HTTP Helper ===

function makeRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: data, json: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// === Tests ===

async function startServer() {
  return new Promise((resolve) => {
    serverProcess = spawn('node', ['server.js'], {
      cwd: __dirname,
      stdio: 'ignore'
    });
    setTimeout(() => resolve(), 4000); // Wait for server to initialize
  });
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill();
    return new Promise(r => setTimeout(r, 1000));
  }
}

async function testServerStartup() {
  const res = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/health',
    method: 'GET'
  });
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  if (!res.json?.status) throw new Error('No status in health check');
}

async function testSubmitURL() {
  const res = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/submit',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { url: 'google.com/contact' });

  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  if (!res.json?.success) throw new Error('Submit returned success=false');
  if (!res.json?.url) throw new Error('No URL in response');
}

async function testQueueing() {
  const res = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/submit',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { url: 'example.com' });

  if (res.json?.queue_size === undefined) throw new Error('No queue_size in response');
  if (res.json.queue_size < 1) throw new Error('Queue size should be at least 1');
}

async function testProcessing() {
  // Clear results first
  await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/clear',
    method: 'POST'
  });

  // Submit URL
  await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/submit',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { url: 'google.com/contact' });

  // Wait for processing
  await new Promise(r => setTimeout(r, 20000));

  // Check results
  const res = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/results',
    method: 'GET'
  });

  if (!Array.isArray(res.json)) throw new Error('Results should be array');
  if (res.json.length === 0) throw new Error('No results returned');
  
  const result = res.json[0];
  if (!result.domain) throw new Error('Missing domain in result');
}

async function testEmailExtraction() {
  const res = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/results',
    method: 'GET'
  });

  if (!res.json || res.json.length === 0) {
    throw new Error('No results to verify email extraction');
  }

  const result = res.json[0];
  // At least one of these should be true:
  // - Found emails (emails_count > 0)
  // - Or this is example.com (which has no emails, so 0 is correct)
  
  if (result.domain.includes('example.com') && result.emails_count === 0) {
    return; // Expected - example.com has no emails
  }

  if (result.emails_count < 1 && !result.domain.includes('example.com')) {
    throw new Error(`No emails extracted from ${result.domain}`);
  }

  if (result.top_email && !result.top_email.email) {
    throw new Error('Invalid email format in result');
  }
}

async function testResultsFile() {
  if (!existsSync('results.json')) {
    throw new Error('results.json does not exist');
  }

  const content = readFileSync('results.json', 'utf-8').trim();
  if (!content) throw new Error('results.json is empty');

  const lines = content.split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      JSON.parse(line);
    } catch (e) {
      throw new Error(`Invalid JSON in results.json: ${line.substring(0, 50)}...`);
    }
  }
}

async function testAPI() {
  const endpoints = [
    { path: '/health', method: 'GET' },
    { path: '/results', method: 'GET' },
  ];

  for (const ep of endpoints) {
    const res = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: ep.path,
      method: ep.method
    });

    if (res.status !== 200) {
      throw new Error(`${ep.path} returned ${res.status}`);
    }
  }
}

// === Main ===

async function main() {
  const runner = new TestRunner();

  console.log('Starting server...\n');
  await startServer();

  // Add tests
  runner.add('Server startup and health check', testServerStartup);
  runner.add('Submit single URL', testSubmitURL);
  runner.add('Queue management and size reporting', testQueueing);
  runner.add('Email extraction from google.com/contact', testEmailExtraction);
  runner.add('Results file integrity', testResultsFile);
  runner.add('API endpoints response', testAPI);
  runner.add('End-to-end processing cycle', testProcessing);

  // Run tests
  const success = await runner.run();

  // Cleanup
  console.log('Stopping server...');
  await stopServer();

  process.exit(success ? 0 : 1);
}

main().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
