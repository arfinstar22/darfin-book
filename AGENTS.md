# Agent Instructions & Security Policy — DARFIN BOOK

This repository enforces strict defensive security policies based on the [Cloudflare Security Audit Skill](file:///home/darfinstar/.gemini/config/skills/security-audit/SKILL.md).

## Mandatory Security Rules for AI Agents & Developers

1. **Always Use the Security Audit Skill**:
   - For all future modifications, code additions, PR reviews, and feature additions, agents must consult and adhere to `/home/darfinstar/.gemini/config/skills/security-audit/`.
   - Focus areas:
     - `WEB-PROTOCOL-AND-AUTH.md`: Strict token verification, constant-time cryptography, bounded parameters, rate limiting.
     - `CLIENT-SIDE.md`: HTML/DOM sanitization, zero unescaped `innerHTML`, scoped `postMessage` origins.
     - `DESKTOP-MOBILE-AND-LOCAL-IPC.md`: Intent sanitization, strict regex token validation, no unquoted string concatenation in `evaluateJavascript`, no ADB backup enabled.
     - `RESOURCE-EXHAUSTION-AND-AVAILABILITY.md`: Rate limits on expensive external provider lookups and auth flows.

2. **Authentication & Token Integrity**:
   - Never accept unverified claims or raw emails in production authentication routes.
   - Always verify ID tokens with Google's public tokeninfo service or OAuth2 userinfo endpoint.
   - Always verify session tokens with constant-time HMAC comparison (`crypto.timingSafeEqual`).

3. **Input Validation & Sanitization**:
   - Sanitize all scraped HTML (e.g., Wikisource) using the defensive tag & attribute whitelist before rendering.
   - Restrict external reader URLs to `http:` and `https:` schemes and apply iframe sandboxing.
   - Restrict identifier parameters (e.g. Internet Archive IDs) to alphanumeric characters and prevent directory traversal (`..` and `/`).

4. **Mobile WebView IPC**:
   - Never pass unsanitized input to Android `WebView.evaluateJavascript`.
   - Always JSON-quote parameters via `JSONObject.quote()` and validate against strict regex patterns.
   - Never use wildcard `'*'` target origin for postMessage dispatching tokens.
