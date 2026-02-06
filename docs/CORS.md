# CORS Configuration

## Overview

Cross-Origin Resource Sharing (CORS) is configured to restrict which origins can access your API and WebSocket connections. This prevents unauthorized access from malicious websites.

## Default Configuration

By default, the API allows requests from:
- `http://localhost:5173` (Vite dev server)
- `http://localhost:3000` (Alternative dev port)

This is safe for local development but **must be configured** before deploying to production.

## Configuration

### Environment Variable

Add allowed origins to `.env`:

```bash
# Comma-separated list of allowed origins
CORS_ORIGINS=http://localhost:5173,http://localhost:3000,https://my-app.com
```

### Multiple Origins

You can specify multiple origins separated by commas:

```bash
CORS_ORIGINS=https://app.example.com,https://admin.example.com,https://api.example.com
```

Whitespace is automatically trimmed, so this also works:

```bash
CORS_ORIGINS=https://app.example.com, https://admin.example.com, https://api.example.com
```

### Production Deployment

For production, **only include your actual domains**:

```bash
# Production example
CORS_ORIGINS=https://my-command-center.com,https://www.my-command-center.com
```

**Security Best Practices:**
1. Never use `*` (wildcard) in production
2. Always use HTTPS in production (not HTTP)
3. Only include domains you control
4. Be specific - include protocol, domain, and port

### Docker Compose

The CORS_ORIGINS environment variable is automatically passed to the API container:

```yaml
api:
  environment:
    # ... other vars ...
  # No need to add CORS_ORIGINS here - it's read from .env
```

## What CORS Protects

CORS restrictions apply to:
- **HTTP API requests** (`/api/*` endpoints)
- **WebSocket connections** (real-time updates)

### Example Blocked Request

If a user visits `https://evil-site.com` and that site tries to call your API:

```javascript
// This will be blocked by CORS
fetch('http://your-api.com/api/tasks', {
  headers: { 'X-API-Key': 'stolen-key' }
});
// Error: CORS policy blocked by origin https://evil-site.com
```

### Example Allowed Request

Requests from configured origins work normally:

```javascript
// This works (if https://my-app.com is in CORS_ORIGINS)
fetch('http://your-api.com/api/tasks', {
  headers: { 'X-API-Key': 'valid-key' }
});
// Success: 200 OK
```

## Testing CORS

### Check Current Configuration

The API logs CORS origins on startup:

```bash
docker logs abcc-api | grep -i cors
# Output: CORS origins: http://localhost:5173, http://localhost:3000
```

### Test with curl

CORS is enforced by browsers, not curl. To test CORS, use a browser:

```javascript
// Open browser console on a different origin
fetch('http://localhost:3001/api/tasks')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
```

If the origin is not allowed:
```
Access to fetch at 'http://localhost:3001/api/tasks' from origin 'http://localhost:8080'
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present.
```

### Development Override

For local testing across different ports, add them to CORS_ORIGINS:

```bash
# Allow multiple local dev servers
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:8080,http://localhost:9000
```

## Common Issues

### "CORS policy blocked" error in browser console

**Cause:** The request origin is not in `CORS_ORIGINS`.

**Solution:**
1. Check the origin in the error message (e.g., `http://localhost:8080`)
2. Add it to `.env`:
   ```bash
   CORS_ORIGINS=http://localhost:5173,http://localhost:8080
   ```
3. Restart Docker containers:
   ```bash
   docker compose restart api
   ```

### WebSocket connection fails with CORS error

**Cause:** Socket.IO uses the same CORS configuration as the HTTP API.

**Solution:** Same as above - add the origin to `CORS_ORIGINS`.

### Works locally but fails in production

**Possible causes:**
1. `CORS_ORIGINS` not set in production `.env`
2. Production origin uses HTTPS but configured with HTTP
3. Production domain doesn't match configured origin

**Solution:**
```bash
# Production .env
CORS_ORIGINS=https://my-actual-domain.com
```

### Credentials not being sent

If you need to send cookies or authentication headers:

**Browser request:**
```javascript
fetch('http://api.example.com/api/tasks', {
  credentials: 'include', // Important!
  headers: { 'X-API-Key': 'key' }
});
```

**WebSocket:**
```javascript
const socket = io('http://api.example.com', {
  withCredentials: true, // Important!
});
```

The API is already configured with `credentials: true`, so this should work once the origin is allowed.

## Security Considerations

### Why Restrict CORS?

Even with API key authentication, CORS is important because:

1. **Prevents CSRF attacks** - Malicious sites can't make requests on behalf of users
2. **Protects API keys** - Even if a key is leaked, only allowed origins can use it
3. **Prevents data theft** - Attackers can't scrape your API from their own site

### CORS vs API Key

Both are needed:
- **CORS** - Restricts which websites can call the API
- **API Key** - Authenticates the request is authorized

Think of it as:
- CORS = "Is this request from a trusted website?"
- API Key = "Does this request have permission?"

### Public APIs

If you want to build a public API that anyone can call, you have two options:

1. **Disable CORS** (not recommended):
   ```bash
   CORS_ORIGINS=*
   ```

2. **Keep CORS, allow embedding** (better):
   - Use API keys to control access
   - Document allowed origins in your API docs
   - Let users request origin allowlisting

## Advanced Configuration

### Dynamic Origins

For more complex CORS logic (e.g., allowing any subdomain), you can modify `packages/api/src/index.ts`:

```typescript
app.use(cors({
  origin: (origin, callback) => {
    // Allow any subdomain of example.com
    if (!origin || origin.match(/^https:\/\/.*\.example\.com$/)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
```

### Different Origins for Socket.IO

If you need different CORS for HTTP vs WebSocket:

```typescript
// Different origins for Socket.IO
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: ['https://dashboard.example.com'],
    methods: ['GET', 'POST'],
  },
});

// Different origins for HTTP
app.use(cors({
  origin: ['https://api.example.com', 'https://dashboard.example.com'],
}));
```

## References

- [MDN CORS Documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [Socket.IO CORS Guide](https://socket.io/docs/v4/handling-cors/)
- [Express CORS Middleware](https://expressjs.com/en/resources/middleware/cors.html)
