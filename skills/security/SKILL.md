---
name: security
description: Strict security protocols to prevent API key leaks, secure endpoints, and block common attack vectors.
---

# Security Directives

## 1. Secrets & Key Management
- **Rule:** NEVER hardcode API keys, tokens, or database URIs in the codebase.
- **Environment Variables:** Strictly use `.env` files. Client-side code must only expose explicitly public variables (e.g., `NEXT_PUBLIC_`, `VITE_`).

## 2. API & Cloud Protection
- **Proxying:** Route sensitive third-party API calls (like Gemini API or other LLMs) through a secure backend or serverless function. Never call them directly from the frontend.
- **BaaS Rules:** For platforms like Firebase or Google Cloud, strictly enforce database and storage Security Rules. Deny all public read/write access by default; require strict authentication checks.

## 3. Data Validation & Storage
- **Sanitization:** Validate and sanitize all user inputs to prevent XSS or injection attacks.
- **Tokens:** Enforce secure, HTTP-only cookies for session management. Do not store sensitive JWTs or access tokens in local storage.