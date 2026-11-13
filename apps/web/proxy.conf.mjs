// Dev server proxy: /api → API (localhost in local mode, `api` service in Docker).
export default {
  '/api': { target: process.env.API_PROXY_TARGET ?? 'http://localhost:3000', secure: false, changeOrigin: false },
};
