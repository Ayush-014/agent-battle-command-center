# API Authentication

## Overview

All API endpoints (except `/health`) require authentication via API key. This prevents unauthorized access to your command center and protects your API credits.

## Setup

### 1. Generate a Secure API Key

```bash
# Linux/Mac
openssl rand -hex 32

# Windows PowerShell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})

# Or use any password generator with minimum 32 characters
```

### 2. Add to .env File

```bash
# Copy .env.example if you haven't already
cp .env.example .env

# Edit .env and set your API key
API_KEY=your_secure_api_key_minimum_32_characters_here
```

**Important:** Never commit your `.env` file to git. It's already in `.gitignore`.

### 3. Configure UI

The UI automatically sends the API key from the `VITE_API_KEY` environment variable. Make sure it matches your `API_KEY`:

```bash
# In .env
API_KEY=your_secure_api_key_minimum_32_characters_here
VITE_API_KEY=your_secure_api_key_minimum_32_characters_here  # Same value
```

### 4. Restart Services

```bash
docker compose down
docker compose up --build
```

## Using the API

### From UI

The UI automatically includes the API key in all requests. No additional configuration needed.

### From Scripts/CLI

Include the API key in the `X-API-Key` header:

```bash
# Using curl
curl -H "X-API-Key: your_api_key_here" http://localhost:3001/api/tasks

# Using fetch in Node.js
const response = await fetch('http://localhost:3001/api/tasks', {
  headers: {
    'X-API-Key': process.env.API_KEY,
    'Content-Type': 'application/json',
  },
});
```

### Query Parameter (Alternative)

You can also pass the API key as a query parameter (less secure, use only for debugging):

```bash
curl http://localhost:3001/api/tasks?api_key=your_api_key_here
```

## Response Codes

| Code | Meaning | Solution |
|------|---------|----------|
| 200/201 | Success | API key is valid |
| 401 Unauthorized | No API key provided | Add X-API-Key header |
| 403 Forbidden | Invalid API key | Check your .env file |

## Public Endpoints

The following endpoints do NOT require authentication:

- `GET /health` - Health check for monitoring

## Security Best Practices

1. **Never share your API key** - Each deployment should have a unique key
2. **Use environment variables** - Never hardcode API keys in source code
3. **Rotate keys periodically** - Change your API key every 90 days
4. **Use HTTPS in production** - Plain HTTP exposes API keys in transit
5. **Monitor failed auth attempts** - Check logs for repeated 401/403 errors

## Troubleshooting

### "API key required" error

```json
{
  "error": "Unauthorized",
  "message": "API key required. Provide via X-API-Key header or api_key query parameter."
}
```

**Solution:** Make sure you're including the API key in your request headers.

### "Invalid API key" error

```json
{
  "error": "Forbidden",
  "message": "Invalid API key"
}
```

**Solution:**
- Check that `API_KEY` in `.env` matches the key you're sending
- Ensure `.env` is loaded (restart Docker containers)
- Verify no extra spaces or quotes around the key

### UI shows auth errors

**Solution:**
- Ensure `VITE_API_KEY` in `.env` matches `API_KEY`
- Rebuild the UI container: `docker compose up --build ui`
- Check browser console for detailed error messages

## Disabling Authentication (Development Only)

To disable authentication (NOT recommended for any network-accessible deployment):

```bash
# In .env - leave API_KEY empty or comment it out
# API_KEY=

# Or remove the requireApiKey middleware in packages/api/src/index.ts
```

The middleware will log a warning but allow requests through if no API key is configured.
