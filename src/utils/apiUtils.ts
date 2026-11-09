// Every API call goes to a relative URL on the page's own origin. In development the Vite dev
// server proxies "/api" to the Express backend (see vite.config.ts); in production a reverse
// proxy does the same. That keeps one origin for pages and API, so a WebView/native shell can
// load the app from any host without CORS or cross-site cookie problems.
export const API_BASE = "/api";
