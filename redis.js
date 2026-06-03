const IORedis = require("ioredis");

let connection = null;
let useRedis = false;

async function initializeRedis() {
    // Default to in-memory (fast path)
    useRedis = false;
    
    try {
        connection = new IORedis({
            host: "redis-17317.crce262.us-east-1-1.ec2.cloud.redislabs.com",
            port: 17317,
            password: "Myc9ZJWODpCCPBtMLUPcpfns2CMkDIhf",
            maxRetriesPerRequest: null,
            connectTimeout: 3000,
            retryStrategy: (times) => {
                if (times > 2) {
                    console.warn("⚠️  Redis unavailable, using in-memory queue");
                    useRedis = false;
                    return null;
                }
                return Math.min(times * 50, 1000);
            }
        });

        connection.on("connect", () => {
            console.log("✅ Redis connected");
            useRedis = true;
        });

        connection.on("error", (err) => {
            console.warn(`⚠️  Redis error (using in-memory queue): ${err.message}`);
            useRedis = false;
        });

        // Try to ping Redis (non-blocking)
        connection.ping().then(() => {
            useRedis = true;
            console.log("✅ Redis ready");
        }).catch(() => {
            useRedis = false;
        });

    } catch (err) {
        console.warn(`⚠️  Redis init failed: ${err.message}`);
        useRedis = false;
    }
    
    return connection;
}

module.exports = { 
    connection,
    initializeRedis,
    isRedisEnabled: () => useRedis
};