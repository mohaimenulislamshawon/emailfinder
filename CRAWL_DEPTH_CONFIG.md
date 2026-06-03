# 📍 Crawl Depth Configuration - Updated

## What Changed

The crawler now has a configurable `MAX_CRAWL_DEPTH` setting that limits how deep into a website's URL structure the crawler searches for emails.

---

## Depth Levels Explained

| Depth | Example URL | Description |
|-------|-------------|-------------|
| **0** | `example.com` | Homepage only (root directory) |
| **1** | `example.com/about` | One level deep (first subdirectory) |
| **2** | `example.com/about/team` | Two levels deep (second subdirectory) |
| **3** | `example.com/about/team/members` | Three levels deep |

---

## Current Configuration

**File**: [crawler.js](crawler.js#L11)

```javascript
const MAX_CRAWL_DEPTH = 1;      // 0 = homepage only, 1 = homepage + one level deep
```

### What This Means

✅ **Will crawl**:
- `example.com` (root)
- `example.com/contact` (1 level)
- `example.com/about` (1 level)
- `example.com/team` (1 level)

❌ **Will NOT crawl**:
- `example.com/about/team` (2 levels - too deep)
- `example.com/contact/form/page` (3 levels - too deep)

---

## How to Change

### To Search Homepage Only (Depth 0)
```javascript
const MAX_CRAWL_DEPTH = 0;
```

### To Search 2 Levels Deep
```javascript
const MAX_CRAWL_DEPTH = 2;
```

### To Search 3 Levels Deep
```javascript
const MAX_CRAWL_DEPTH = 3;
```

---

## Performance Impact

| Depth | Speed | Coverage | Typical Use |
|-------|-------|----------|-------------|
| 0 | ⚡ Fastest | Small | Quick check |
| 1 | 🟢 Fast | Good | **Recommended** |
| 2 | 🟡 Moderate | Better | Thorough search |
| 3+ | 🔴 Slow | Comprehensive | Deep crawl |

---

## Example Crawl Patterns

### Depth 0 (Homepage Only)
```
START: example.com
  └─ Extract emails from homepage
  └─ Don't follow any links
```

### Depth 1 (Homepage + One Level)
```
START: example.com
  ├─ Extract emails from homepage
  └─ Follow links like:
     ├─ example.com/about        (crawl & extract)
     ├─ example.com/contact      (crawl & extract)
     ├─ example.com/services     (crawl & extract)
     └─ example.com/team         (crawl & extract)
```

### Depth 2 (Two Levels Deep)
```
START: example.com
  ├─ example.com/about
  │   ├─ example.com/about/team         (crawl & extract)
  │   └─ example.com/about/history      (crawl & extract)
  └─ example.com/contact
      ├─ example.com/contact/form       (crawl & extract)
      └─ example.com/contact/support    (crawl & extract)
```

---

## Current Setting

**Your current setting: `MAX_CRAWL_DEPTH = 1`**

This means:
- ✅ Homepage will be searched
- ✅ First-level pages like `/about`, `/contact`, `/team` will be searched
- ❌ Pages 2+ levels deep like `/about/team` will be skipped

---

## Modify Crawl Depth

### Step 1: Open [crawler.js](crawler.js)

### Step 2: Find this line (around line 11):
```javascript
const MAX_CRAWL_DEPTH = 1;
```

### Step 3: Change the number:
- `0` = Homepage only
- `1` = Homepage + first level (recommended)
- `2` = Two levels deep
- `3` = Three levels deep

### Step 4: Save and restart server:
```bash
# Ctrl+C to stop server
npm start
```

---

## Examples of Different Depths for google.com

### With Depth 0
```
✅ Crawls: https://google.com
❌ Skips: https://google.com/about
❌ Skips: https://google.com/intl
❌ Skips: https://google.com/search (any subpage)
```

### With Depth 1 (Current)
```
✅ Crawls: https://google.com
✅ Crawls: https://google.com/about
✅ Crawls: https://google.com/intl
✅ Crawls: https://google.com/search
❌ Skips: https://google.com/intl/en/about (too deep)
❌ Skips: https://google.com/search/help (too deep)
```

### With Depth 2
```
✅ Crawls: https://google.com
✅ Crawls: https://google.com/about
✅ Crawls: https://google.com/intl
✅ Crawls: https://google.com/intl/en/about (now crawled!)
✅ Crawls: https://google.com/search
✅ Crawls: https://google.com/search/help (now crawled!)
```

---

## Related Settings

Other important crawler settings in [crawler.js](crawler.js):

| Setting | Value | Purpose |
|---------|-------|---------|
| `MAX_PAGES` | 50 | Max pages to visit per domain |
| `MAX_EMAILS` | 10 | Max emails to extract per domain |
| `MAX_CRAWL_DEPTH` | 1 | Max URL depth level |
| `PAGE_TIMEOUT` | 12000ms | Timeout for page load |
| `AXIOS_TIMEOUT` | 8000ms | Timeout for HTTP request |

---

## Summary

✅ Current configuration crawls **homepage and first-level pages only**

This provides the best balance of:
- 🚀 Speed (doesn't crawl too many pages)
- 📊 Coverage (finds emails in most important pages)
- ⚙️ Efficiency (avoids deep nested directories)

**To change**: Edit `MAX_CRAWL_DEPTH` value in [crawler.js](crawler.js#L11)

---

*Configuration updated: 2026-03-25*
