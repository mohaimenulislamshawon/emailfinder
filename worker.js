/**
 * ⚠️  WORKER IS NOW INTEGRATED INTO server.js
 * 
 * The worker process has been consolidated into the main server.js file
 * for better reliability and simpler deployment.
 * 
 * To start the server (which includes the worker):
 *   npm run start
 *   OR
 *   node server.js
 * 
 * The server will automatically:
 * - Initialize Redis connection with fallback to in-memory queue
 * - Start an inline worker to process jobs from the queue
 * - Expose the web UI at http://localhost:3000
 * 
 * For CLI usage (single URL):
 *   node index.js https://example.com
 * 
 * For bulk processing from file:
 *   node producer.js
 */

console.log("ℹ️  Worker is now integrated into server.js");
console.log("ℹ️  Run 'node server.js' to start the application");
process.exit(0);