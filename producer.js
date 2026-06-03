const { emailQueue, initializeQueue } = require("./queue");
const { initializeRedis } = require("./redis");

const websites = [
    "example.com",
    "github.com",
    "nodejs.org"
];

(async () => {
    try {
        // Initialize Redis
        await initializeRedis();

        // Initialize Queue
        const queue = await initializeQueue();

        console.log("📋 Adding websites to queue...\n");

        for (let site of websites) {
            await queue.add("crawl", { url: site });
            console.log("✅ Added:", site);
        }

        console.log("\n✅ All URLs queued for processing");
        process.exit(0);
    } catch (err) {
        console.error("❌ Error:", err.message);
        process.exit(1);
    }
})();