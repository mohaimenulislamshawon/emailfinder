# 🚀 Email Finder - Quick Start Guide

## What is This?

A powerful web application that automatically finds contact email addresses from websites.

Enter a website URL → App crawls the site → Extracts emails → Displays in table

---

## Prerequisites

- **Node.js** v14+ ([Download](https://nodejs.org))
- **npm** (comes with Node.js)
- Internet connection

---

## Installation (5 minutes)

### 1. Open Terminal/PowerShell
Navigate to the project folder:
```bash
cd path/to/emailfinder
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start the Server
```bash
npm start
```

You should see:
```
✅ App ready
✅ Server ready at http://localhost:3000
🏃 Worker active and waiting for URLs...
```

---

## Usage

### Open Web Interface
1. Open browser to: `http://localhost:3000`
2. You'll see:
   - Text input for website URL
   - "Submit" button
   - Results table (empty initially)

### Submit a Website
1. Type a website: `google.com` or `https://github.com/contact`
2. Click **Submit**
3. See the notification: "Added to queue"
4. Watch the table - results appear as they're found!

### What to Expect
- **Processing time**: 5-30 seconds depending on website size
- **Results show**:
  - Domain name
  - Number of emails found
  - Email addresses with frequency
  - Top priority email (marked as primary contact)

---

## Best Website Examples to Test

These sites have visible contact emails:

| Website | Why It Works |
|---------|-------------|
| `google.com/contact` | Has press@google.com |
| `mozilla.org/en-US/contact/` | Multiple contact emails |
| `github.com/contact` | Support contact info |
| `facebook.com/help` | Help/contact section |
| `wikipedia.org/wiki/Wikipedia:Contact` | Contact center |

**Don't test with**:
- `example.com` (placeholder, no emails)
- Password-protected sites
- Sites with heavy JavaScript rendering

---

## API Usage (Advanced)

### Submit URL via cURL
```bash
curl -X POST http://localhost:3000/submit \
  -H "Content-Type: application/json" \
  -d '{"url":"google.com"}'
```

### Get Results via cURL
```bash
curl http://localhost:3000/results
```

### Response Format
```json
[
  {
    "domain": "https://google.com",
    "emails_count": 3,
    "top_email": {
      "email": "press@google.com",
      "found_times": 1
    },
    "all_emails": [
      {"email": "press@google.com", "count": 1},
      {"email": "support@google.com", "count": 2}
    ]
  }
]
```

---

## Troubleshooting

### "Cannot find module" error
```bash
npm install
```

### Port 3000 already in use
Forward to different port:
```bash
PORT=3001 npm start
```
Then use `http://localhost:3001`

### No emails found
1. Check if website actually has email addresses
2. Try a different website
3. Check the website isn't blocking automated access

### Server crashes
1. Check Node.js version: `node --version` (should be v14+)
2. Check no other instance running: `taskkill /F /IM node.exe`
3. Restart: `npm start`

---

## Understanding Results

### emails_count
Total number of unique email addresses found on the website

### top_email
The most important email (based on frequency + professional prefix like contact@, info@, support@)

### found_times
How many times the email appeared across all crawled pages

### all_emails
Complete list of all emails found, sorted by frequency

---

## Stop the Server

Press **Ctrl + C** in the terminal running the server.

Or open another terminal:
```bash
taskkill /F /IM node.exe
```

---

## How It Works (Behind the Scenes)

```
1. User submits URL (e.g., "google.com")
   ↓
2. Server adds to queue
   ↓
3. Worker picks from queue
   ↓
4. Fetches website HTML (using Axios)
   ↓
5. Falls back to Playwright if JavaScript rendering needed
   ↓
6. Parses HTML with Cheerio
   ↓
7. Extracts emails using regex patterns
   ↓
8. Crawls up to 50 pages to find all emails
   ↓
9. Ranks by frequency and priority
   ↓
10. Saves results to results.json
   ↓
11. Frontend polls /results endpoint
   ↓
12. Results appear in table!
```

---

## Performance

- **Single URL**: 5-20 seconds
- **Small website**: 10-30 seconds
- **Large website**: 20-60 seconds
- **Processing model**: One website at a time (serial)
- **Auto-crawl depth**: Up to 50 pages per domain

---

## Features

✅ Real-time result updates  
✅ Professional email detection  
✅ Obfuscation cleaning ([at], [dot], etc)  
✅ JavaScript-rendered content support  
✅ Duplicate email removal  
✅ Email frequency ranking  
✅ Progress notifications  
✅ Results persistence  
✅ Mobile-responsive design  

---

## Limitations

⚠️ Can't extract password-protected content  
⚠️ Image-based email text not recognized  
⚠️ Some sites block automated access  
⚠️ Results depend on HTML email visibility  
⚠️ JavaScript-hidden emails may be missed  

---

## Getting Help

1. **Check console logs**: Watch the terminal while processing
2. **Read WORKING_REPORT.md**: Detailed technical information
3. **Check results.json**: Raw results stored here
4. **Wait longer**: Some websites are slow

---

## Next Steps

- Try different websites
- Test the API endpoints
- Integrate results into your workflow
- Use results for outreach/contact tracking

---

**Enjoy finding emails! 🎉**

Questions? Check the browser console (F12) for client-side errors, or the terminal for server logs.
