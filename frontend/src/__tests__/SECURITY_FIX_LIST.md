# Eventify Frontend — Security & Codebase Fix Backlog
*Discovered during `fix/test-suite-baseline` audit. Address in dedicated follow-up security PR(s) once test gates are green.*

## High Priority
1. **CSRF Error Handler Misplacement (`src/axiosConfig/axios.js`)**
   - **Finding:** Surfaced by `src/__tests__/auth/sessionAndBoundary.test.js` (`⚠️ [KNOWN BUG] CSRF error handler is on frontendInstance, not backendInstance`).
   - **Impact:** State-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) go through `backendInstance`, meaning backend CSRF rejections (`CSRF_TOKEN_MISSING` / `CSRF_TOKEN_INVALID`) are not intercepted globally.
   - **Fix:** Attach the CSRF error handler to `backendInstance` and update the regression test in `sessionAndBoundary.test.js`.

2. **Arbitrary URL Host Deletion in `vendor-image` Route (`src/app/api/vendor-image/route.js`)**
   - **Finding:** Initial audit flagged unvalidated URL host deletion on image cleanup endpoints.
   - **Fix:** Enforce strict Vercel Blob hostname allowlisting before calling `del(url)`.

3. **PII / Sensitive Data Console Logging**
   - **Finding:** Initial audit flagged raw user/auth payloads logged to console in non-dev environments.
   - **Fix:** Gate or strip PII from console statements across auth/checkout flows.