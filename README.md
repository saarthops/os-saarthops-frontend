# SaarthOps frontend

Minimal React UI for email-code trial verification, signup, login, and password reset.

## Run locally

1. Start the Spring Boot backend on `http://localhost:8080`.
2. Password reset links use `PASSWORD_RESET_URL=http://localhost:3003/reset-password`
   (this is the backend default).
3. From this directory, run `npm install` then `npm run dev`.
4. Open `http://localhost:3003`.

Vite proxies `/api` requests to the local backend. For another backend URL, set
`VITE_API_BASE_URL` and update/remove the proxy in `vite.config.js`.

## Authentication note

This is a local development UI. It keeps demo session tokens in `sessionStorage`; use
httpOnly secure cookies and production-grade deployment settings before exposing a real app.
