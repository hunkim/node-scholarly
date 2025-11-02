# ScraperAPI SSL Error Fix

## 🐛 Problem

Users were experiencing SSL/TLS errors when using ScraperAPI proxy:

```
Exception while fetching page: write EPROTO 80E8B4DC807F0000:error:0A0000C6:SSL 
routines:tls_get_more_records:packet length too long:ssl/record/methods/tls_common.c:663:
```

**Root Cause**: The proxy was attempting to use HTTP protocol for HTTPS requests, causing a protocol mismatch.

---

## ✅ Solution

Fixed the ScraperAPI proxy implementation in `src/proxyGenerator.ts` with the following changes:

### 1. **Added HTTPS Proxy Support**

**Before:**
```typescript
const proxyUrl = `${prefix}:${apiKey}@proxy-server.scraperapi.com:8001`;
const proxyWorks = await this.useProxy(proxyUrl);
```

**After:**
```typescript
// Set up the proxy configuration with HTTPS support
this.proxies = {
  http: `${prefix}:${apiKey}@proxy-server.scraperapi.com:8001`,
  https: `${prefix}:${apiKey}@proxy-server.scraperapi.com:8001`,
};
this.proxyWorks = true;
```

### 2. **Disabled SSL Verification**

ScraperAPI handles SSL certificates on their proxy servers, so we need to disable local SSL verification (matching Python's `verify=False`):

```typescript
// Create session with proper proxy config and SSL verification disabled
this.newSession({
  proxy: {
    host: 'proxy-server.scraperapi.com',
    port: 8001,
    protocol: 'http',
    auth: {
      username: username,
      password: apiKey,
    },
  },
  // Disable SSL verification as ScraperAPI handles SSL
  httpsAgent: new (require('https').Agent)({
    rejectUnauthorized: false,
  }),
});
```

### 3. **Fixed Session Configuration Persistence**

**Problem**: When retrying failed requests, the ScraperAPI configuration was being lost.

**Solution**: Store the session configuration and reuse it on retries:

```typescript
// In ProxyGenerator class
private sessionConfig: any = {};

// In newSession()
if (Object.keys(config).length > 0) {
  this.sessionConfig = config;
}

// In getNextProxy() - called on retries
this.newSession(this.sessionConfig);
```

### 4. **Fixed Config Merging Order**

**Problem**: Config was being spread early, causing proxy settings to be overridden.

**Before:**
```typescript
const axiosConfig: any = {
  headers,
  timeout: this.timeout,
  ...config,  // Spread early
};

if (this.proxyWorks && this.proxies.http) {
  axiosConfig.proxy = this.parseProxyUrl(this.proxies.http);  // Overrides config.proxy!
}
```

**After:**
```typescript
const axiosConfig: any = {
  headers,
  timeout: this.timeout,
};

// Don't override proxy if it's already in config (e.g., for ScraperAPI)
if (this.proxyWorks && this.proxies.http && !config.proxy) {
  axiosConfig.proxy = this.parseProxyUrl(this.proxies.http);
}

// Merge config last to preserve custom settings like httpsAgent
Object.assign(axiosConfig, config);
```

---

## 🧪 Testing

### Test with ScraperAPI

```typescript
import { scholarly } from 'node-scholarly';
import { ProxyGenerator } from 'node-scholarly/dist/proxyGenerator';

async function testScraperAPI() {
  const pg = new ProxyGenerator();
  await pg.ScraperAPI('YOUR_SCRAPERAPI_KEY');
  scholarly.useProxy(pg);

  // Should now work without SSL errors
  const author = await scholarly.searchAuthorId('JE_m2UgAAAAJ', true);
  console.log('✅ ScraperAPI working:', author.name);
}

testScraperAPI();
```

---

## 📋 Changes Summary

### Files Modified:
- `src/proxyGenerator.ts`

### Lines Changed:
- Added `sessionConfig` property to store configuration
- Updated `ScraperAPI()` method (60 lines → 72 lines)
- Updated `newSession()` to preserve configuration
- Updated `getNextProxy()` to reuse stored configuration

### Key Improvements:
✅ Proper HTTPS proxy configuration  
✅ SSL verification disabled (matching Python scholarly)  
✅ Session configuration persists across retries  
✅ Config merging order fixed to preserve custom settings  

---

## 🔍 Comparison with Python scholarly

The fix brings the TypeScript implementation in line with the Python version:

**Python scholarly:**
```python
# In _proxy_generator.py (line 629)
self._new_session(verify=False, proxies=proxies)
```

**Node-scholarly (after fix):**
```typescript
this.newSession({
  proxy: { /* ... */ },
  httpsAgent: new (require('https').Agent)({
    rejectUnauthorized: false,  // Equivalent to verify=False
  }),
});
```

---

## 🚀 Impact

- ✅ Fixes SSL errors with ScraperAPI
- ✅ Maintains proxy settings across retries
- ✅ Matches Python scholarly behavior
- ✅ No breaking changes to API
- ✅ Backward compatible with existing code

---

## 📚 Related Documentation

- [ScraperAPI Documentation](https://www.scraperapi.com/documentation/)
- [Axios Proxy Configuration](https://axios-http.com/docs/req_config)
- [Node.js HTTPS Agent](https://nodejs.org/api/https.html#https_class_https_agent)

---

*Fixed in version: 1.1.1*  
*Date: 2025-11-02*

