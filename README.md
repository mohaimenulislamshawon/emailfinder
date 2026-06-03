# 📧 Email Finder Tool

A powerful bulk email finder that extracts email addresses from multiple websites automatically.

## ✨ Features

- 🔍 **Bulk Processing**: Submit multiple URLs at once
- 🌐 **Deep Crawling**: Automatically crawls websites to depth 2
- 📊 **Smart Deduplication**: Counts email frequency across pages
- 🚀 **Fast Processing**: Parallel job queue with Redis (or in-memory fallback)
- 🎯 **Smart Email Selection**: Prioritizes professional email addresses (contact@, info@, etc.)
- 🎨 **Modern UI**: Clean, fast, responsive web interface
- ⚡ **Real-time Updates**: Results appear as they're found
- 🔄 **Dual Rendering**: Uses both Axios + Playwright for maximum success

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Server
```bash
npm start
```
or
```bash
node server.js
```

### 3. Open in Browser
```
http://localhost:3000
```

## 📖 Usage

### Web Interface
1. Enter one or more URLs (one per line)
2. Click "🔍 Find Emails"
3. Results appear in real-time as processing completes
4. Click "🗑️ Clear Results" to reset

### Command Line (Single URL)
```bash
node index.js https://example.com
```

### Bulk Processing from Code
```bash
node producer.js
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│         Web Browser (Frontend)             │
│         - Submit URLs                      │
│         - View Results                     │
└──────────────┬──────────────────────────────┘
               │ HTTP/JSON
┌──────────────▼──────────────────────────────┐
│         Express Server                      │
│  - POST /submit → Add to queue             │
│  - GET /results → Fetch results            │
│  - POST /clear → Clear results             │
└────────┬─────────────────────┬──────────────┘
         │                     │
    ┌────▼────┐           ┌────▼────┐
    │  Queue  │           │ Worker  │
    │ Redis   │           │ (Inline)│
    │ or      │           │ Process │
    │In-Memory│◄──────────┤ Crawls  │
    └─────────┘           │ URLs    │
         │                └────┬────┘
         │                     │
         └─────►┌──────────────▼────────┐
                │    Crawler Engine     │
                │  - Fetch with Axios  │
                │  - Fetch with JS     │
                │  - Extract Emails    │
                │  - Save to JSON      │
                └──────────────────────┘
```

## 📁 Project Structure

```
emailfinder/
├── server.js              # Main Express server + inline worker
├── crawler.js             # Website crawling engine
├── extractor.js           # Email extraction logic
├── redis.js               # Redis connection with fallback
├── queue.js               # Job queue management
├── utils.js               # URL parsing & validation
├── validator.js           # Input validation
├── index.js               # CLI interface (single URL)
├── producer.js            # Bulk job producer
├── worker.js              # Info about integrated worker
├── results.json           # Results storage
├── package.json           # Dependencies
├── public/
│   ├── index.html         # Web UI
│   ├── script.js          # Frontend logic
│   └── style.css          # Styling
└── README.md              # This file
```

## ⚙️ Configuration

### Redis
The application attempts to connect to a remote Redis instance. If Redis is unavailable, it falls back to an in-memory queue.

**To use cloud Redis** (default):
- The credentials are built-in
- Connection automatically retries and falls back if unavailable

**To use local Redis**:
1. Install & run Redis locally
2. Update `redis.js`:
```javascript
const connection = new IORedis({
    host: "localhost",
    port: 6379
});
```

## 🔍 How It Works

### Crawling Process
1. **Normalize URL** - Convert to proper format (https://...)
2. **Fetch Page** - Try Axios first (fast), fallback to Playwright (JS-rendered)
3. **Extract Emails** - Multiple patterns:
   - Standard email regex
   - Mailto links
   - Obfuscated emails (at, dot replacements)
4. **Find Links** - Parse HTML for internal links
5. **Repeat** - Crawl linked pages (depth 0-1)
6. **Score** - Count frequency, prioritize professional addresses
7. **Save** - Store results to JSON file
8. **Update** - Frontend polls every 2 seconds

### Email Extraction
- Supports standard emails: `user@example.com`
- Handles obfuscated: `user[at]example[dot]com`
- Finds mailto links: `<a href="mailto:..."`
- Validates format and removes duplicates
- Prioritizes: `contact@`, `info@`, `support@`, `hello@`, `admin@`, `mail@`

## 🚨 Troubleshooting

### Server Won't Start
```bash
# Check Node version (v14+ required)
node --version

# Check port is not in use
netstat -ano | findstr :3000  # Windows
lsof -i :3000                  # Mac/Linux
```

### No Results Appearing
- Check browser console for errors (F12)
- Check server logs for crawling errors
- Ensure URLs are formatted correctly
- Some websites may block scraping (add User-Agent)

### Redis Connection Errors
- Normal! Falls back to in-memory queue
- Check logs for "Using in-memory queue (fallback)"

### Timeouts on Large Sites
- Max pages: 30 per domain
- Max emails: 5 per domain
- Adjust in `crawler.js` (MAX_PAGES, MAX_EMAILS)

## 📊 API Endpoints

| Endpoint | Method | Body | Response |
|----------|--------|------|----------|
| `/submit` | POST | `{url}` | Success/Error |
| `/results` | GET | - | Array of results |
| `/clear` | POST | - | Success/Error |
| `/health` | GET | - | Status info |

## 🎯 Performance

- **Single URL**: 10-30 seconds (with JS rendering)
- **Bulk (10-100 URLs)**: Parallel processing
- **Memory**: ~200MB base + ~50MB per active crawl
- **CPU**: Scales with Playwright processes (max 5 concurrent)

## 🔒 Security

- ✅ HTML escaping in frontend
- ✅ Input validation on submission
- ✅ URL validation before crawling
- ✅ No sensitive data logging
- ✅ Results stored locally only

## 📦 Dependencies

| Package | Purpose |
|---------|---------|
| `express` | Web framework |
| `axios` | HTTP requests |
| `cheerio` | HTML parsing |
| `playwright` | JS rendering |
| `bullmq` | Job queue |
| `ioredis` | Redis client |
| `tldts` | Domain parsing |
| `cors` | CORS middleware |

## 🤝 Contributing

Suggestions and improvements welcome!

### Ideas for Enhancement
- [ ] Email validation API integration
- [ ] Export to CSV/Excel
- [ ] Scheduled recurring crawls
- [ ] Email database integration
- [ ] Advanced filtering options
- [ ] Progress bar for jobs
- [ ] History tracking

## 📝 License

ISC

## 🆘 Support

For issues:
1. Check the Troubleshooting section
2. Review server logs
3. Check browser console (F12)
4. Verify URLs are accessible

---

**Happy scraping! 🎉**
