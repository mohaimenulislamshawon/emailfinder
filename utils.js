const { parse } = require("tldts");

function normalizeUrl(url) {
    if (!url) return null;
    
    url = url.trim();
    
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = "https://" + url;
    }

    // Remove trailing slash and hash/query params for base URL
    return url.replace(/\/$/, "").split("?")[0].split("#")[0];
}

function isSameDomain(base, target) {
    try {
        const baseDomain = parse(base).domain;
        const targetDomain = parse(target).domain;

        if (!baseDomain || !targetDomain) return false;
        return baseDomain === targetDomain;
    } catch (err) {
        console.error("Domain comparison error:", err.message);
        return false;
    }
}

function getDomain(url) {
    try {
        const parsed = parse(url);
        return parsed.domain || null;
    } catch {
        return null;
    }
}

module.exports = {
    normalizeUrl,
    isSameDomain,
    getDomain
};