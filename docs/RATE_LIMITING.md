# HTTP Rate Limiting

## Overview

The API implements rate limiting to prevent abuse and ensure fair usage for all users. Rate limits apply per IP address using a sliding window algorithm.

## Default Limits

| Tier | Endpoints | Limit | Window |
|------|-----------|-------|--------|
| **Standard** | Most API endpoints | 100 req/min | 60 seconds |
| **Strict** | Auth, task creation | 20 req/min | 60 seconds |
| **Permissive** | Read-only endpoints | 300 req/min | 60 seconds |

## Configuration

### Environment Variables

Add to `.env` to customize rate limits:

```bash
# Rate limit window in milliseconds (default: 60000 = 1 minute)
RATE_LIMIT_WINDOW_MS=60000

# Maximum requests per window (default: 100)
RATE_LIMIT_MAX=100

# Skip counting successful requests (default: false)
RATE_LIMIT_SKIP_SUCCESSFUL=false
```

### Adjusting for Production

**High-traffic deployments:**
```bash
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=300
```

**Strict security:**
```bash
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=30
```

**Development (more permissive):**
```bash
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=1000
```

## Response Headers

When rate limiting is active, responses include these headers:

```http
RateLimit-Limit: 100
RateLimit-Remaining: 73
RateLimit-Reset: 1640000000
```

### Header Meanings

- `RateLimit-Limit` - Maximum requests allowed in the window
- `RateLimit-Remaining` - Requests remaining in current window
- `RateLimit-Reset` - Unix timestamp when limit resets

## Rate Limit Exceeded

When you exceed the rate limit:

**Status Code:** `429 Too Many Requests`

**Response:**
```json
{
  "error": "Too many requests",
  "message": "Rate limit exceeded. Max 100 requests per 60 seconds.",
  "retryAfter": 60
}
```

### Retry-After Header

The response includes a `Retry-After` header with seconds until you can retry:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 45
```

## Implementation Details

### Sliding Window Algorithm

Rate limits use a sliding window, not a fixed window:

**Fixed Window (NOT used):**
```
Minute 1: ████████████████████ (100 requests)
Minute 2: ████ (4 requests)
         ^
         Reset here - can suddenly make 100 more requests
```

**Sliding Window (USED):**
```
Time:  10:00:00  10:00:30  10:01:00  10:01:30
Limit: |-------- 60 second window --------|
```

This prevents burst traffic at window boundaries.

### IP-Based Limiting

Rate limits are applied per IP address. If you're behind a proxy or load balancer, ensure the real IP is forwarded:

**Nginx:**
```nginx
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

**Express:**
```typescript
app.set('trust proxy', 1);
```

## Endpoint-Specific Limits

### Standard Rate Limit

Applied to most endpoints (100 req/min):
- `/api/tasks/*`
- `/api/agents/*`
- `/api/queue/*`
- `/api/metrics/*`
- `/api/execution-logs/*`

### Strict Rate Limit

Applied to sensitive endpoints (20 req/min):
- Task creation endpoints
- Agent control endpoints
- System configuration changes

### Permissive Rate Limit

Applied to read-only endpoints (300 req/min):
- Health check (`/health`)
- Metrics viewing
- Log queries

## Bypassing Rate Limits

### During Development

Rate limiting is automatically disabled when `NODE_ENV=test`.

For development, increase limits:
```bash
RATE_LIMIT_MAX=1000
```

### For Specific IPs

To whitelist specific IPs (e.g., monitoring services), modify `packages/api/src/middleware/rateLimiter.ts`:

```typescript
export const standardRateLimiter = rateLimit({
  // ... other config ...
  skip: (req) => {
    const trustedIPs = ['10.0.0.1', '192.168.1.100'];
    return config.env === 'test' || trustedIPs.includes(req.ip);
  },
});
```

## Best Practices

### Client-Side Handling

**Always check rate limit headers:**
```javascript
const response = await fetch('/api/tasks');

const remaining = response.headers.get('RateLimit-Remaining');
if (remaining < 10) {
  console.warn('Rate limit almost exceeded!');
}

if (response.status === 429) {
  const retryAfter = response.headers.get('Retry-After');
  console.log(`Rate limited. Retry after ${retryAfter} seconds`);
}
```

**Implement exponential backoff:**
```javascript
async function fetchWithBackoff(url, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url);

    if (response.status !== 429) {
      return response;
    }

    const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
  }

  throw new Error('Max retries exceeded');
}
```

### API Design

**Batch operations** when possible:
```javascript
// Bad: 100 separate requests
for (const task of tasks) {
  await api.getTask(task.id);
}

// Good: 1 batch request
const tasks = await api.getTasks({ ids: taskIds });
```

**Use WebSockets** for real-time updates instead of polling:
```javascript
// Bad: Polling every second (60 requests/minute)
setInterval(async () => {
  const tasks = await api.getTasks();
}, 1000);

// Good: WebSocket updates (0 HTTP requests)
socket.on('task_updated', (task) => {
  updateUI(task);
});
```

## Monitoring

### Check Rate Limit Status

View current rate limit hits in logs:
```bash
docker logs abcc-api | grep "429"
```

### Metrics

Rate limit metrics are available at `/api/metrics`:
```json
{
  "rateLimits": {
    "standardHits": 1234,
    "strictHits": 56,
    "permissiveHits": 0
  }
}
```

## Troubleshooting

### Legitimate traffic being blocked

**Symptoms:** Normal usage triggers 429 errors

**Solutions:**
1. Increase `RATE_LIMIT_MAX`:
   ```bash
   RATE_LIMIT_MAX=200
   ```

2. Enable `RATE_LIMIT_SKIP_SUCCESSFUL`:
   ```bash
   RATE_LIMIT_SKIP_SUCCESSFUL=true
   ```
   (Only counts failed requests toward limit)

3. Use WebSockets instead of HTTP polling

### Rate limits not working

**Symptoms:** No rate limiting happening at all

**Causes:**
- `NODE_ENV=test` (rate limiting disabled)
- Running behind proxy without IP forwarding
- Rate limits set too high

**Solution:**
Check environment:
```bash
docker exec abcc-api env | grep NODE_ENV
# Should show NODE_ENV=production
```

### Different IPs for same user

**Symptoms:** Users report inconsistent rate limiting

**Cause:** Load balancer or proxy not forwarding real IP

**Solution:**
Update Docker Compose to trust proxy:
```yaml
api:
  environment:
    TRUST_PROXY: "true"
```

Then update `index.ts`:
```typescript
if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}
```

## Security Considerations

### DDoS Protection

Rate limiting provides basic DDoS protection but is not a complete solution. For production:

1. **Use a CDN** (Cloudflare, AWS CloudFront) for DDoS mitigation
2. **Add WAF rules** to block malicious patterns
3. **Set up monitoring** to detect unusual traffic

### Rate Limit Bypass

Rate limiting by IP can be bypassed by:
- Distributed attacks from many IPs
- Rotating proxy IPs
- Spoofing X-Forwarded-For headers (if not validated)

Additional protections:
- Require API keys (already implemented)
- Use CAPTCHA for sensitive operations
- Implement user-based limits (not just IP)

## Advanced: Per-User Rate Limiting

To implement per-user (not IP) rate limits, modify the rate limiter:

```typescript
import rateLimit from 'express-rate-limit';

export const userRateLimiter = rateLimit({
  windowMs: 60000,
  max: 100,
  keyGenerator: (req) => {
    // Use API key instead of IP
    return req.headers['x-api-key'] as string || req.ip;
  },
});
```

This limits by API key, allowing multiple users from same IP.

## References

- [express-rate-limit Documentation](https://github.com/express-rate-limit/express-rate-limit)
- [IETF Rate Limit Headers](https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/)
- [OWASP Rate Limiting](https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html)
