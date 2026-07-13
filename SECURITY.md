# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly by emailing the maintainers directly. Do not create a public issue.

## Security Measures

This project implements the following security controls:

- **Helmet** security headers (CSP, HSTS, X-Frame-Options)
- **CORS** configuration
- **Rate limiting** (two-tier: general + AI-specific)
- **Input validation** with bounded text lengths
- **Prompt injection sanitization** for all AI-bound text
- **Body size limits** (16KB)
- **Content-Type enforcement** (JSON only on POST/PUT/PATCH)
- **Non-root Docker container** user
- **No hard-coded secrets** (single optional env var)
