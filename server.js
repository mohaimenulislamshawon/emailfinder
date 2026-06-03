const express = require("express");
const cors = require("cors");
const { crawlWebsite } = require("./crawler");
const { initializeRedis, isRedisEnabled } = require("./redis");
const { initializeQueue, getInMemoryQueue } = require("./queue");
const { normalizeUrl } = require("./utils");
const { isValidUrl } = require("./validator");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// 🟢 In-Memory Results Storage (No Database)
let inMemoryResults = [];

// 🟢 Initialize Redis and Queue
let emailQueue = null;

async function initializeApp() {
    try {
        // Initialize Redis
        await initializeRedis().catch(err => {
            console.warn("Redis init error (will use in-memory):", err.message);
        });
        
        // Initialize Queue
        emailQueue = await initializeQueue();
        console.log("✅ App ready. Queue type:", typeof emailQueue.add);
        
    } catch (err) {
        console.error("❌ Initialization error:", err.message);
    }
}

// 🟢 Process a single job
async function processJob(jobData) {
    try {
        const { url } = jobData;
        console.log(`\n🔍 Processing job: ${url}`);

        if (!url || !isValidUrl(url)) {
            console.error("❌ Invalid URL:", url);
            return { domain: url, error: "Invalid URL" };
        }

        const normalizedUrl = normalizeUrl(url);
        console.log(`📍 Normalized URL: ${normalizedUrl}`);
        
        // Crawl the website
        console.log(`🌐 Starting crawl...`);
        const result = await crawlWebsite(normalizedUrl);
        console.log(`✅ Crawl complete. Found ${result.emails_count || 0} email(s)`);
        
        if (result.top_email) {
            console.log(`   📧 Top email: ${result.top_email.email}`);
        } else {
            console.log(`   ⚠️  No emails found`);
        }

        // Store result in memory only (no database saving)
        inMemoryResults.push(result);
        console.log(`💾 Stored in memory (${inMemoryResults.length} total results)`);

        return result;

    } catch (err) {
        console.error(`❌ Processing error: ${err.message}`);
        console.error(`   Stack: ${err.stack}`);
        const errorResult = { domain: jobData.url, error: err.message };
        // Store error result in memory only
        inMemoryResults.push(errorResult);
        return errorResult;
    }
}

// 🟢 Continuous worker loop - SERIAL processing
async function startWorkerLoop() {
    let isProcessing = false;
    let lastCheckTime = Date.now();
    let checkCount = 0;

    setInterval(async () => {
        checkCount++;
        const now = Date.now();
        const timeSinceLastCheck = now - lastCheckTime;
        
        if (isProcessing) {
            // Still processing from last interval
            return;
        }
        
        const queue = getInMemoryQueue();
        
        if (queue.length === 0) {
            // Queue is empty - this is normal, just wait
            return;
        }
        
        // ✅ Found work to do!
        console.log(`\n⏳ WORKER: Found ${queue.length} job(s) in queue`);
        
        const job = queue.shift();
        isProcessing = true;
        
        console.log(`⏳ Processing: ${job.data.url}`);
        console.log(`   Queue remaining: ${queue.length} job(s)`);
        
        try {
            const startTime = Date.now();
            const result = await processJob(job.data);
            const duration = Date.now() - startTime;
            
            console.log(`✅ Job completed in ${duration}ms`);
            console.log(`   Domain: ${result.domain}`);
            console.log(`   Result: ${result.error ? '❌ ERROR' : '✅ SUCCESS'}`);
        } catch (err) {
            console.error(`❌ Job processing failed: ${err.message}`);
        } finally {
            isProcessing = false;
        }
    }, 500);  // Check every 500ms
}

// 🟢 API: Submit URL
app.post("/submit", async (req, res) => {
    try {
        const { url } = req.body;
        console.log(`\n📨 [SUBMIT] Received URL: ${url}`);

        if (!url) {
            console.log(`❌ [SUBMIT] Empty URL`);
            return res.status(400).json({ error: "URL is required" });
        }

        if (!isValidUrl(url)) {
            console.log(`❌ [SUBMIT] Invalid format: ${url}`);
            return res.status(400).json({ error: "Invalid URL format" });
        }

        const normalizedUrl = normalizeUrl(url);
        console.log(`✅ [SUBMIT] Normalized to: ${normalizedUrl}`);

        // Add to queue
        if (!emailQueue) {
            console.error("❌ [SUBMIT] Queue not initialized!");
            return res.status(500).json({ error: "Queue not available" });
        }

        const job = await emailQueue.add("crawl", { url: normalizedUrl });
        console.log(`✅ [SUBMIT] Added to queue (job ID: ${job.id})`);
        
        // Log queue size
        const queueSize = getInMemoryQueue().length;
        console.log(`📋 [SUBMIT] Queue size now: ${queueSize}`);

        res.json({ 
            success: true,
            message: "URL added to queue",
            url: normalizedUrl,
            queue_size: queueSize
        });
    } catch (err) {
        console.error("❌ [SUBMIT] Error:", err.message);
        res.status(500).json({ error: "Failed to submit URL", details: err.message });
    }
});

// 🟢 API: Get results (from memory, no database)
app.get("/results", (req, res) => {
    console.log(`[GET /results] Returning ${inMemoryResults.length} result(s)`);
    res.json(inMemoryResults);
});

// 🟢 Health check endpoint
app.get("/health", (req, res) => {
    res.json({
        status: "running",
        redis: isRedisEnabled(),
        timestamp: new Date().toISOString()
    });
});

// 🟢 Clear results endpoint (memory only, no database)
app.post("/clear", (req, res) => {
    inMemoryResults = [];
    console.log("🗑️  Results cleared from memory");
    res.json({ success: true, message: "Results cleared" });
});

// 🟢 Start server
async function start() {
    await initializeApp();

    // Start worker loop if using in-memory queue
    // Always start worker loop (works for both Redis and in-memory)
    console.log("🔄 Starting worker (max 5 parallel jobs)...");
    startWorkerLoop();

    // Clear in-memory results on startup
    inMemoryResults = [];
    console.log("🗑️  Memory cleared on startup");

    app.listen(PORT, () => {
        console.log(`✅ Server ready at http://localhost:${PORT}`);
        console.log("🏃 Worker active and waiting for URLs...");
    });
}

start().catch(err => {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
});

module.exports = app;