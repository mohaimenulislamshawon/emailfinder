const axios = require("axios");
const cheerio = require("cheerio");
const { extractEmails } = require("./extractor");
const { normalizeUrl, isSameDomain } = require("./utils");
const { chromium } = require("playwright");

const MAX_PAGES = 15;           // REDUCED: Focus on key pages only (was 50)
const MAX_EMAILS = 10;          // Max emails to extract per domain
const PAGE_TIMEOUT = 6000;      // Timeout for page load (ms) - OPTIMIZED: 6s for faster crawling
const AXIOS_TIMEOUT = 8000;     // Timeout for HTTP request (ms)
const REQUEST_DELAY = 100;      // Delay between requests (ms) - OPTIMIZED: 100ms (we have ConcurrencyLimiter already)
const CONCURRENT_PAGES = 5;     // Process 5 pages simultaneously
const CONCURRENT_FB = 2;        // Facebook: 2 concurrent (rate limit safe)
let lastRequestTime = 0;        // Track last request time for rate limiting

// ⚡ CONCURRENCY MANAGER - Simple queue without external dependencies
class ConcurrencyLimiter {
    constructor(limit) {
        this.limit = limit;
        this.running = 0;
        this.queue = [];
    }

    async run(fn) {
        // Wait if at limit
        while (this.running >= this.limit) {
            await new Promise(resolve => this.queue.push(resolve));
        }
        
        this.running++;
        try {
            return await fn();
        } finally {
            this.running--;
            const resolve = this.queue.shift();
            if (resolve) resolve();
        }
    }
}

// ✅ Add random delay between requests to avoid rate limiting
async function addDelay() {
    const timeSinceLastRequest = Date.now() - lastRequestTime;
    const randomDelay = REQUEST_DELAY + Math.random() * 500; // 500-1000ms delay
    
    if (timeSinceLastRequest < randomDelay) {
        await new Promise(resolve => setTimeout(resolve, randomDelay - timeSinceLastRequest));
    }
    
    lastRequestTime = Date.now();
}

// ✅ List of realistic user agents to rotate
function getRandomUserAgent() {
    const userAgents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/91.0.864.59"
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}

// ✅ Get comprehensive headers to mimic real browser
function getRequestHeaders() {
    return {
        "User-Agent": getRandomUserAgent(),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate",
        "DNT": "1",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Cache-Control": "max-age=0",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Pragma": "no-cache"
    };
}

// ✅ Playwright fallback for JS-rendered content (stealth mode to bypass bot detection)
async function fetchWithJS(url, attempt = 1) {
    let browser = null;
    try {
        await addDelay();
        
        // Check if it's a Facebook URL (needs extra time)
        const isFacebook = url.toLowerCase().includes('facebook.com');
        const timeout = isFacebook ? 15000 : PAGE_TIMEOUT; // 15s for Facebook, 6s for others - OPTIMIZED
        
        console.log(`[JS Render] Fetching ${url} (attempt ${attempt}/3)${isFacebook ? ' [FACEBOOK - EXTENDED WAIT]' : ''}...`);
        
        browser = await chromium.launch({ 
            headless: true,
            args: [
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--no-first-run',
                '--no-default-browser-check'
            ]
        });
        
        const page = await browser.newPage();
        
        // Set realistic headers and viewport
        await page.setViewportSize({ width: 1280, height: 720 });
        await page.setExtraHTTPHeaders(getRequestHeaders());
        
        await page.goto(url, { 
            waitUntil: isFacebook ? "networkidle" : "domcontentloaded", 
            timeout: timeout 
        });
        
        // EXTRA WAIT for Facebook to fully render (JS loads email addresses, etc)
        if (isFacebook) {
            console.log(`   ⏳ Waiting extra 3 seconds for Facebook JS to render...`);
            await page.waitForTimeout(3000);
        }
        
        const content = await page.content();
        return content;
    } catch (err) {
        console.warn(`JS render attempt ${attempt} failed for ${url}: ${err.message}`);
        
        // Retry up to 3 times on error
        if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 2000 * attempt)); // Exponential backoff
            return await fetchWithJS(url, attempt + 1);
        }
        
        return null;
    } finally {
        if (browser) await browser.close();
    }
}

// ✅ Fetch page with retry logic and anti-blocking measures
async function fetchPage(url, attempt = 1) {
    try {
        await addDelay();
        
        const res = await axios.get(url, {
            timeout: AXIOS_TIMEOUT,
            headers: getRequestHeaders(),
            maxRedirects: 5,
            // Don't reject on any status code, we'll handle them manually
            validateStatus: () => true
        });
        
        // Handle different status codes
        if (res.status === 403 || res.status === 429) {
            console.warn(`[Blocked ${res.status}] ${url} - Using Playwright instead...`);
            return await fetchWithJS(url);
        }
        
        if (res.status === 403 || res.status === 429) {
            console.warn(`Rate limited or blocked: ${url}`);
            return null;
        }
        
        if (res.status >= 500) {
            console.warn(`Server error ${res.status} for ${url}`);
            if (attempt < 3) {
                const delay = 2000 * attempt;
                console.log(`Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return await fetchPage(url, attempt + 1);
            }
            return null;
        }
        
        if (res.status >= 400) {
            console.warn(`HTTP ${res.status} for ${url}`);
            return null;
        }
        
        return res.data;
    } catch (err) {
        if (err.code === 'ECONNABORTED') {
            console.warn(`[Timeout] ${url} - Using Playwright...`);
            return await fetchWithJS(url);
        }
        
        if (err.message.includes('ECONNREFUSED') || err.message.includes('ENOTFOUND')) {
            console.warn(`[Connection Error] ${url}: ${err.message}`);
            return null;
        }
        
        // Retry on network errors
        if (attempt < 2) {
            const delay = 1500 * attempt;
            console.log(`[Retry ${attempt}] Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return await fetchPage(url, attempt + 1);
        }
        
        console.warn(`[Failed] ${url}: ${err.message}`);
        return null;
    }
}

// ✅ IMPROVED: Detect target pages (pages likely to have contact emails)
function isTargetPage(url) {
    const lower = url.toLowerCase();
    
    // These pages commonly have contact/business emails
    const targets = [
        "/contact",
        "/contact-us",
        "/contactus",
        "/get-in-touch",
        "/getintouch",
        "/reach-us",
        "/reachout",
        "/about",
        "/about-us",
        "/aboutus",
        "/team",
        "/our-team",
        "/ourteam",
        "/staff",
        "/people",
        "/privacy",
        "/privacy-policy",
        "/privacypolicy",
        "/terms",
        "/terms-of-service",
        "/termsofservice",
        "/tos",
        "/legal",
        "/disclaimer",
        "/write-for-us",
        "/write-for-us/",
        "/writeforus",
        "/guest-post",
        "/guestpost",
        "/contribute",
        "/contributor",
        "/contributors",
        "/collaboration",
        "/partner",
        "/partners",
        "/join",
        "/join-us",
        "/joinus",
        "/careers",
        "/career",
        "/jobs",
        "/feedback",
        "/contact-us",
        "/support",
        "/help",
        "/faq",
        "/frequently-asked",
        "/advertise",
        "/advertising",
        "/media-kit",
        "/pressroom",
        "/press",
    ];
    
    return targets.some(target => lower.includes(target));
}

// ✅ ENHANCED: Find Facebook URLs using 5 detection strategies (including icons!)
function findFacebookUrls(html) {
    try {
        const fbUrls = new Set();
        const $ = cheerio.load(html);
        
        // Strategy 1: Direct href links
        $('a').each((_, el) => {
            const href = $(el).attr('href');
            if (href && href.toLowerCase().includes('facebook.com')) {
                fbUrls.add(href);
            }
        });
        
        // Strategy 2: Text content
        $('a').each((_, el) => {
            const text = $(el).text().toLowerCase().trim();
            if ((text.includes('facebook') || text === 'f') && $(el).attr('href')) {
                fbUrls.add($(el).attr('href'));
            }
        });
        
        // Strategy 3: Icon attributes (SVG/IMG with facebook labels) - YOUR FIX!
        $('svg, img').each((_, el) => {
            const ariaLabel = $(el).attr('aria-label') || '';
            const title = $(el).attr('title') || '';
            const alt = $(el).attr('alt') || '';
            
            if (ariaLabel.toLowerCase().includes('facebook') || 
                title.toLowerCase().includes('facebook') || 
                alt.toLowerCase().includes('facebook')) {
                const parent = $(el).closest('a');
                if (parent.attr('href')) {
                    fbUrls.add(parent.attr('href'));
                }
            }
        });
        
        // Strategy 4: Data attributes (widget embeds)
        $('[data-href*="facebook"]').each((_, el) => {
            const dataHref = $(el).attr('data-href');
            if (dataHref) fbUrls.add(dataHref);
        });
        
        // Strategy 5: Raw regex search
        const fbRegex = /https?:\/\/(?:www\.)?facebook\.com\/[^\s"'<>]+/gi;
        const matches = html.match(fbRegex);
        if (matches) {
            matches.forEach(url => fbUrls.add(url));
        }
        
        // Clean and return
        return Array.from(fbUrls)
            .map(u => {
                u = u.trim();
                if (!u.startsWith('http')) u = 'https://' + u;
                return u;
            })
            .slice(0, 5); // Top 5 results
    } catch (err) {
        console.warn("Facebook detection error:", err.message);
        return [];
    }
}

// ✅ Check if URL is a social media page (Facebook, LinkedIn, etc)
function isSocialMediaLink(url) {
    const lower = url.toLowerCase();
    
    const socialDomains = [
        "facebook.com",
        "linkedin.com",
        "twitter.com",
        "x.com",
        "instagram.com",
        "youtube.com"
    ];
    
    return socialDomains.some(domain => lower.includes(domain));
}

// ✅ Filter only useful/static pages
// ✅ IMPROVED: Filter only useful pages (block junk + limit depth)
function isValidPage(url) {
    const lower = url.toLowerCase();
    
    // Block junk pages (blogs, articles, categories, etc)
    const blocked = [
        "/blog/",
        "/post/",
        "/posts/",
        "/news/",
        "/article/",
        "/articles/",
        "/category/",
        "/categories/",
        "/tag/",
        "/tags/",
        "/author/",
        "/authors/",
        "/page/",
        "/pages/",
        "/archive/",
        "/search",
        "/filter",
        "/sort",
        "/product/",
        "/products/",
        "/shop/",
        "/cart",
        "/checkout",
        "/gallery/",
        "/portfolio/",
        "/work/",
        "/project/",
        "/event/",
        "/calendar"
    ];
    
    // Block if contains any junk pattern
    if (blocked.some(b => lower.includes(b))) {
        return false;
    }
    
    // Limit depth - avoid deep nested pages (most emails on top-level pages)
    const pathParts = url.split('/').filter(p => p && p !== 'http:' && p !== 'https:');
    if (pathParts.length > 4) { // Max 4 levels deep (domain.com/a/b/c)
        return false;
    }
    
    return true;
}


// ✅ Main crawler function - Target specific pages + social media
async function crawlWebsite(startUrl) {
    try {
        const baseUrl = normalizeUrl(startUrl);
        
        if (!baseUrl) {
            return {
                domain: startUrl,
                top_email: null,
                error: "Invalid URL"
            };
        }

        let emailsFound = {}; // { email: count }
        const socialMediaLinks = new Set(); // Collect social media links
        const facebookUrls = new Set(); // Collect Facebook URLs specifically
        
        // ============================================
        // STEP 1: HOMEPAGE ANALYSIS (Homepage First!)
        // ============================================
        console.log(`\n[1/6] 📍 HOMEPAGE ANALYSIS - Extracting structure...`);
        let html = await fetchPage(baseUrl);
        let homepageEmails = 0;
        let homepageFb = 0;
        let homepageSocial = 0;
        
        if (html) {
            // Extract emails from homepage
            const emails = extractEmails(html, baseUrl);
            emails.forEach(e => {
                if (!emailsFound[e]) emailsFound[e] = 0;
                emailsFound[e]++;
            });
            homepageEmails = emails.length;
            
            // Extract Facebook URLs from homepage
            const fbUrls = findFacebookUrls(html);
            fbUrls.forEach(url => facebookUrls.add(url));
            homepageFb = fbUrls.length;
            
            // Extract social media links from homepage
            const $ = cheerio.load(html);
            $('a').each((_, el) => {
                const href = $(el).attr('href');
                if (href && isSocialMediaLink(href) && !href.toLowerCase().includes('facebook')) {
                    socialMediaLinks.add(href);
                    homepageSocial++;
                }
            });
            
            console.log(`   ✅ Homepage found: ${homepageEmails} emails, ${homepageFb} FB URLs, ${homepageSocial} social links`);
        }
        
        // Stop if we already found enough emails from homepage
        if (Object.keys(emailsFound).length >= MAX_EMAILS) {
            console.log(`   ⏭️  Already found ${Object.keys(emailsFound).length} emails on homepage, skipping pages`);
            return formatResult(baseUrl, emailsFound);
        }

        // ============================================
        // STEP 2: EXTRACT KEY PAGES FROM HOMEPAGE
        // ============================================
        console.log(`\n[2/6] 🔍 EXTRACTING KEY PAGES from homepage...`);
        const targetPages = new Set();
        
        // Parse homepage to find all target pages
        if (html) {
            const $ = cheerio.load(html);
            const links = [];
            
            $('a').each((_, el) => {
                let link = $(el).attr('href');
                if (!link) return;
                
                // Convert relative to absolute
                if (link.startsWith('/')) {
                    link = baseUrl + link;
                } else if (link.startsWith('.')) {
                    link = baseUrl + '/' + link;
                }
                
                links.push(link);
            });
            
            // Find target pages and other social media
            links.forEach(link => {
                if (isSocialMediaLink(link)) {
                    if (!link.toLowerCase().includes('facebook')) {
                        socialMediaLinks.add(link);
                    }
                } else if (isSameDomain(baseUrl, link) && isValidPage(link) && isTargetPage(link)) {
                    targetPages.add(link);
                }
            });
        }
        
        // Limit target pages to top 8 (quality over quantity)
        const limitedTargets = Array.from(targetPages).slice(0, 8);
        console.log(`   ✅ Identified ${limitedTargets.length} key pages to visit`);
        
        // ============================================
        // STEP 3: VISIT KEY PAGES
        // ============================================
        console.log(`\n[3/6] 📄 VISITING KEY PAGES...`);
        
        // Step 3: ⚡ PARALLEL - Crawl all target pages simultaneously
        if (limitedTargets.length > 0 && Object.keys(emailsFound).length < MAX_EMAILS) {
            console.log(`   ⚡ Processing ${limitedTargets.length} pages in parallel (${Math.min(limitedTargets.length, CONCURRENT_PAGES)} at a time)...`);
            
            // Create concurrency limiter for parallel processing
            const limiter = new ConcurrencyLimiter(CONCURRENT_PAGES);
            
            // Create promises for all pages
            const pagePromises = limitedTargets.map((targetUrl, index) => 
                limiter.run(async () => {
                    if (Object.keys(emailsFound).length >= MAX_EMAILS) return null;
                    
                    try {
                        const html = await fetchPage(targetUrl);
                        if (!html) return null;
                        
                        const pageEmails = extractEmails(html, targetUrl);
                        const pageFbUrls = findFacebookUrls(html);
                        
                        // Extract social media links
                        const socialLinks = [];
                        const $ = cheerio.load(html);
                        $('a').each((_, el) => {
                            const href = $(el).attr('href');
                            if (href && isSocialMediaLink(href) && !href.toLowerCase().includes('facebook')) {
                                socialLinks.push(href);
                            }
                        });
                        
                        return { targetUrl, pageEmails, pageFbUrls, socialLinks };
                    } catch (err) {
                        console.warn(`Failed to process ${targetUrl}: ${err.message}`);
                        return null;
                    }
                })
            );
            
            // Wait for all pages to complete
            const results = await Promise.all(pagePromises);
            
            // Merge results
            results.forEach(result => {
                if (!result) return;
                
                result.pageEmails.forEach(e => {
                    if (!emailsFound[e]) emailsFound[e] = 0;
                    emailsFound[e]++;
                });
                
                result.pageFbUrls.forEach(url => facebookUrls.add(url));
                
                result.socialLinks.forEach(link => socialMediaLinks.add(link));
            });
            
            console.log(`   ✅ Parallel crawl complete`);
        }

        // Step 4: ⚡ PARALLEL - Crawl Facebook pages (rate limit safe: 2 concurrent)
        if (facebookUrls.size > 0 && Object.keys(emailsFound).length < MAX_EMAILS) {
            const fbPages = Array.from(facebookUrls).slice(0, 3); // Limit to 3 Facebook pages
            console.log(`\n[4/6] 🔵 FACEBOOK PAGES - Found ${fbPages.length} page(s) to crawl (max 2 concurrent)`);
            
            const fbLimiter = new ConcurrencyLimiter(CONCURRENT_FB);
            
            const fbPromises = fbPages.map(fbUrl =>
                fbLimiter.run(async () => {
                    if (Object.keys(emailsFound).length >= MAX_EMAILS) return null;
                    
                    try {
                        const html = await fetchPage(fbUrl);
                        if (!html) return null;
                        
                        const emails = extractEmails(html, fbUrl);
                        return { fbUrl, emails };
                    } catch (err) {
                        console.warn(`Failed to crawl Facebook ${fbUrl}: ${err.message}`);
                        return null;
                    }
                })
            );
            
            const fbResults = await Promise.all(fbPromises);
            
            fbResults.forEach(result => {
                if (!result) return;
                result.emails.forEach(e => {
                    if (!emailsFound[e]) emailsFound[e] = 0;
                    emailsFound[e]++;
                });
            });
        }

        // Step 5: ⚡ PARALLEL - Crawl other social media pages if still need emails
        if (socialMediaLinks.size > 0 && Object.keys(emailsFound).length < MAX_EMAILS) {
            const limitedSocialMedia = Array.from(socialMediaLinks).slice(0, 3); // Limit to 3 social media pages
            console.log(`\n[5/6] 🔗 OTHER SOCIAL MEDIA - Found ${limitedSocialMedia.length} page(s) to crawl (max 2 concurrent)`);
            
            const socialLimiter = new ConcurrencyLimiter(CONCURRENT_FB);
            
            const socialPromises = limitedSocialMedia.map(socialUrl =>
                socialLimiter.run(async () => {
                    if (Object.keys(emailsFound).length >= MAX_EMAILS) return null;
                    
                    try {
                        const html = await fetchPage(socialUrl);
                        if (!html) return null;
                        
                        const emails = extractEmails(html, socialUrl);
                        return { socialUrl, emails };
                    } catch (err) {
                        console.warn(`Failed to crawl social media ${socialUrl}: ${err.message}`);
                        return null;
                    }
                })
            );
            
            const socialResults = await Promise.all(socialPromises);
            
            socialResults.forEach(result => {
                if (!result) return;
                result.emails.forEach(e => {
                    if (!emailsFound[e]) emailsFound[e] = 0;
                    emailsFound[e]++;
                });
            });
        } else if (facebookUrls.size === 0 && socialMediaLinks.size === 0) {
            console.log(`\n[4/6] ℹ️  No Facebook or social media links found`);
        } else {
            console.log(`\n[6/6] ⏭️  Already found enough emails`);
        }

        console.log(`\n✅ COMPLETE - Found ${Object.keys(emailsFound).length} unique emails\n`);
        return formatResult(baseUrl, emailsFound);

    } catch (err) {
        console.error("Crawler error:", err.message);
        return {
            domain: startUrl,
            top_email: null,
            error: err.message
        };
    }
}

// ✅ Format result
function formatResult(domain, emailsFound) {
    const entries = Object.entries(emailsFound);

    if (entries.length === 0) {
        return {
            domain,
            top_email: null,
            emails_count: 0
        };
    }

    // Sort by frequency
    entries.sort((a, b) => b[1] - a[1]);

    let bestEmail = entries[0];

    // If all appear once, prefer professional emails
    if (entries.every(e => e[1] === 1)) {
        const priority = ["info@", "contact@", "support@", "hello@", "admin@", "mail@"];
        for (const prefix of priority) {
            const found = entries.find(e => e[0].startsWith(prefix));
            if (found) {
                bestEmail = found;
                break;
            }
        }
    }

    return {
        domain,
        top_email: {
            email: bestEmail[0],
            found_times: bestEmail[1]
        },
        emails_count: entries.length,
        all_emails: entries.map(e => ({ email: e[0], count: e[1] }))
    };
}

module.exports = { crawlWebsite };