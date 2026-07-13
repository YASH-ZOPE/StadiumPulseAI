# Deployment Guide

## Local Development

```bash
npm install
npm run dev    # starts with --watch for auto-reload
```

## Production (Node.js)

```bash
NODE_ENV=production npm start
```

## Docker

```dockerfile
# Build
docker build -t stadium-pulse-ai .

# Run
docker run -p 3000:3000 \
  -e NODE_ENV=production \
  -e GEMINI_API_KEY=your-key \
  stadium-pulse-ai
```

## Render

1. Push to a public GitHub repository
2. Connect the repo in Render dashboard
3. Render auto-deploys using `render.yaml`
4. Set `GEMINI_API_KEY` in Render environment variables (optional)

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | 3000 | HTTP server port |
| `NODE_ENV` | No | development | Environment |
| `GEMINI_API_KEY` | No | — | Google Gemini API key (app works without it) |
| `GEMINI_MODEL` | No | gemini-2.0-flash | Gemini model name |
| `AI_TIMEOUT_MS` | No | 15000 | AI request timeout |
| `RATE_LIMIT_MAX` | No | 100 | General rate limit per minute |
| `AI_RATE_LIMIT_MAX` | No | 20 | AI endpoint rate limit per minute |
