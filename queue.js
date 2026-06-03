let emailQueue = null;
let inMemoryQueue = [];

// ALWAYS use in-memory queue (simple, fast, works)
async function initializeQueue() {
    inMemoryQueue = [];
    
    emailQueue = {
        add: async (name, data) => {
            const job = { name, data, id: Date.now(), timestamp: Date.now() };
            inMemoryQueue.push(job);
            console.log(`📋 Added to queue → Size now: ${inMemoryQueue.length}`);
            return job;
        },
        getRepeatableJobs: async () => [],
        close: async () => {}
    };
    
    console.log("✅ Queue initialized (in-memory, instant processing)");
    return emailQueue;
}

module.exports = { 
    emailQueue: () => emailQueue,
    initializeQueue,
    getInMemoryQueue: () => inMemoryQueue,
    isUsingInMemory: () => useInMemory
};