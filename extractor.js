function cleanObfuscated(text) {
    return text
        .replace(/\s?\[at\]\s?|\s?\(at\)\s?|\s?\{at\}\s?/gi, "@")
        .replace(/\s?\[dot\]\s?|\s?\(dot\)\s?|\s?\{dot\}\s?/gi, ".")
        .replace(/\s+at\s+/gi, "@")
        .replace(/\s+dot\s+/gi, ".");
}

function decodeHtmlEntities(str) {
    const map = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#39;': "'",
        '&apos;': "'"
    };
    return str.replace(/&[a-z]+;/gi, (entity) => map[entity] || entity);
}

function isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    
    // Remove common invalid patterns
    if (email.includes('example.com') || email.includes('test.com') || email.includes('[')) {
        return false;
    }
    
    // Standard email regex
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    return emailRegex.test(email.trim());
}

function extractEmails(html, url = '') {
    let emails = new Set();

    try {
        // Decode & clean
        let text = decodeHtmlEntities(html);
        text = cleanObfuscated(text);

        // Standard regex for emails in text
        const regex = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
        const matches = text.match(regex);
        
        if (matches) {
            matches.forEach(e => {
                const cleanEmail = e.toLowerCase().trim();
                if (isValidEmail(cleanEmail)) {
                    emails.add(cleanEmail);
                }
            });
        }

        // Mailto links
        const mailtoRegex = /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
        let match;
        while ((match = mailtoRegex.exec(html)) !== null) {
            const cleanEmail = match[1].toLowerCase().trim();
            if (isValidEmail(cleanEmail)) {
                emails.add(cleanEmail);
            }
        }

        // Email in href attributes (contact forms, links)
        const hrefRegex = /href="([^"]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})[^"]*)"/gi;
        while ((match = hrefRegex.exec(html)) !== null) {
            const email = match[2]?.toLowerCase().trim();
            if (email && isValidEmail(email)) {
                emails.add(email);
            }
        }
    } catch (err) {
        console.error("Email extraction error:", err.message);
    }

    return Array.from(emails);
}

module.exports = { extractEmails };