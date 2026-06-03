const { crawlWebsite } = require("./crawler");
const { normalizeUrl } = require("./utils");

(async () => {
    const inputUrl = process.argv[2];

    if (!inputUrl) {
        console.log("Usage: node index.js https://example.com");
        process.exit(1);
    }

    const url = normalizeUrl(inputUrl);
    console.log("🔍 Crawling:", url);
    console.log("⏳ This may take a minute...\n");

    const result = await crawlWebsite(url);

    console.log("\n==== RESULT ====\n");
    console.log(JSON.stringify(result, null, 2));
})();