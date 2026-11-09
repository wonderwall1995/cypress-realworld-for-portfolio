const createProxyMiddleware = require("http-proxy-middleware");
require("dotenv").config();

module.exports = function (app) {
  app.use(
    createProxyMiddleware(["/api"], {
      target: `http://localhost:${process.env.VITE_BACKEND_PORT || 7202}`,
      changeOrigin: true,
      logLevel: "debug",
    })
  );
};
