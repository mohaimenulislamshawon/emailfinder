function isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function isValidUrl(url) {
    try {
        new URL(url.startsWith('http') ? url : 'https://' + url);
        return true;
    } catch {
        return false;
    }
}

function sanitizeUrl(url) {
    if (!url) return null;
    url = url.trim();
    if (!url.startsWith('http')) {
        url = 'https://' + url;
    }
    return url;
}

module.exports = { 
    isValidEmail,
    isValidUrl,
    sanitizeUrl
};