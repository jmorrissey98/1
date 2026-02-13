const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // http-proxy-middleware v3 syntax
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:8001',
      changeOrigin: true,
      // In v3, paths are passed through by default unless pathFilter is used
      // The context '/api' means requests to /api/* will be forwarded to target/api/*
    })
  );
};
