/**
 * setupAxiosInterceptors.js
 * ─────────────────────────────────────────────────────────────────
 * Location: src/axiosInstance/setupAxiosInterceptors.js
 *
 * CHANGES FROM PREVIOUS VERSION
 * ──────────────────────────────
 * • tokenStorage now uses localStorage (persists across tabs + refresh)
 * • Added tokenStorage.isAuthenticated() helper used by PrivateRoute
 * • 401 handler fires a custom DOM event so InactivityManager can
 *   distinguish "server rejected token" from "inactivity timeout"
 * • setupAxiosInterceptors() signature unchanged — still called once
 *   in index.js, zero changes to any existing API call pattern.
 *
 * ZERO CHANGES REQUIRED in any existing axios.post / axios.get call.
 * ─────────────────────────────────────────────────────────────────
 */

import axios from 'axios';

/* ── Interceptor ID refs (prevent stacking on HMR) ──────────────── */
let _reqId = null;
let _resId = null;

/* ── Auth endpoints excluded from the 401 redirect loop ─────────── */
const AUTH_PATHS = [
  'AuthController/token',
  'AuthController/microsoft-token',
  'AuthController/VerifytheMfaOtp',
  'AuthMasterController/SendResetLinkToMail',
  'auth/refresh',
  'auth/login',
];

const isAuthEndpoint = (url = '') =>
  AUTH_PATHS.some((p) => url.includes(p));

/* ═══════════════════════════════════════════════════════════════════
   tokenStorage
   ─────────────
   Single source-of-truth for the JWT access token.
   localStorage is used so the token survives page refreshes and
   is shared across browser tabs of the same origin.
═══════════════════════════════════════════════════════════════════ */
export const tokenStorage = {
  TOKEN_KEY:    'dda_access_token',
  AUTH_KEY:     'isUserAuthenticated',
  USER_ID_KEY:  'user_id',

  /* ── Write ── */
  save(token) {
    if (token) localStorage.setItem(this.TOKEN_KEY, token);
  },

  /* ── Read ── */
  get() {
    return localStorage.getItem(this.TOKEN_KEY) || null;
  },

  /* ── Guard: true only when a token string actually exists ── */
  isAuthenticated() {
    const token = this.get();
    if (!token) return false;
    // Optionally decode and check exp field to reject expired tokens
    // even before the server responds with 401.
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        this.clear();          // proactively evict expired token
        return false;
      }
    } catch {
      // Malformed token — treat as unauthenticated
      this.clear();
      return false;
    }
    return true;
  },

  /* ── Wipe everything on logout / 401 / inactivity ── */
  clear() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.AUTH_KEY);
    localStorage.removeItem(this.USER_ID_KEY);
    // Legacy keys written by the original Login.js
    localStorage.removeItem('email');
    localStorage.removeItem('userId');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_role_id');
    localStorage.removeItem('isChangePasswordRequired');
  },
};

/* ═══════════════════════════════════════════════════════════════════
   setupAxiosInterceptors
   ─────────────────────────────────────────────────────────────────
   Call ONCE in src/index.js before ReactDOM.render().
═══════════════════════════════════════════════════════════════════ */
export function setupAxiosInterceptors() {
  /* Eject stale interceptors before re-registering (safe on HMR) */
  if (_reqId !== null) axios.interceptors.request.eject(_reqId);
  if (_resId !== null) axios.interceptors.response.eject(_resId);

  /* ── REQUEST — attach Bearer token ────────────────────────────── */
  _reqId = axios.interceptors.request.use(
    (config) => {
      const token = tokenStorage.get();
      if (token) {
        /*
         * Spread preserves all existing headers from config.headers2 /
         * config.headers3 (Content-Type, clientId, etc.).
         * Authorization is added on top — no existing header removed.
         */
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${token}`,
        };
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  /* ── RESPONSE — handle 401 globally ───────────────────────────── */
  _resId = axios.interceptors.response.use(
    (response) => response,

    (error) => {
      const status = error?.response?.status;
      const url    = error?.config?.url || '';

      if (status === 401 && !isAuthEndpoint(url)) {
        /*
         * Token rejected by the server.
         * 1. Clear all stored credentials.
         * 2. Dispatch a custom DOM event so InactivityManager /
         *    any listener can react (show UI, update Redux, etc.)
         *    without this file needing to import React Router.
         * 3. Hard-navigate to /login as the final fallback.
         */
        tokenStorage.clear();

        window.dispatchEvent(new CustomEvent('dda:session:expired', {
          detail: { reason: 'unauthorized' },
        }));

        const base = window.location.pathname.startsWith('/dda') ? '/dda' : '';
        if (!window.location.pathname.endsWith('/login')) {
          window.location.href = `${base}/login`;
        }
      }

      return Promise.reject(error);
    }
  );
}
