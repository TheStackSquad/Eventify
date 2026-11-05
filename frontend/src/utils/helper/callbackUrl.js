// // frontend/src/utils/helper/callbackUrl.js

// frontend/src/utils/helper/callbackUrl.js

export const LOGIN_PATH = "/account/auth/login";
export const DEFAULT_CALLBACK = "/dashboard";

// Messages shown on the login page; only keys listed here are ever displayed
export const LOGIN_REASONS = {
  session_expired: "Your session expired. Please sign in to continue.",
  login_required: "Please sign in to continue.",
};

export function getLoginReasonMessage(reason) {
  return Object.prototype.hasOwnProperty.call(LOGIN_REASONS, reason)
    ? LOGIN_REASONS[reason]
    : null;
}

// Accept only same-site relative paths, never external or auth-page targets
export function getSafeCallbackUrl(raw, fallback = DEFAULT_CALLBACK) {
  if (typeof raw !== "string") return fallback;
  const value = raw.trim();

  // Single leading slash only: rejects https://x, //x and /\x
  if (!/^\/(?![/\\])/.test(value)) return fallback;

  // Reject backslashes and control characters anywhere in the value
  if (/[\\\u0000-\u001F]/.test(value)) return fallback;

  // Avoid redirect loops back into the auth pages
  if (value.startsWith("/account/auth")) return fallback;

  return value;
}

// Builds /account/auth/login?callbackUrl=%2Fsubscription%3Fplan%3Dpremium&reason=...
export function buildLoginUrl(returnTo, reason, loginPath = LOGIN_PATH) {
  const params = new URLSearchParams();

  const safe = getSafeCallbackUrl(returnTo, "");
  if (safe) params.set("callbackUrl", safe);
  if (getLoginReasonMessage(reason)) params.set("reason", reason);

  const query = params.toString();
  return query ? `${loginPath}?${query}` : loginPath;
}

// True for errors that mean "there is no usable session"
export function isSessionExpiredError(error) {
  return (
    error?.message === "REFRESH_TOKEN_EXPIRED" ||
    error?.response?.status === 401
  );
}