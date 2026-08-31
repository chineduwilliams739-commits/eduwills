import app from './index.js';

// Browser clients send the Firebase ID token in both Authorization and a
// dedicated header. Cloudflare/browser intermediaries can treat Authorization
// differently during CORS preflight, so normalize the dedicated header back to
// Authorization before the payment application handles the request.
export default {
  async fetch(req, env, ctx) {
    if (!req.headers.get('authorization')) {
      const token = req.headers.get('x-firebase-id-token');
      if (token) {
        const headers = new Headers(req.headers);
        headers.set('authorization', `Bearer ${token.replace(/^Bearer\\s+/i, '')}`);
        req = new Request(req, { headers });
      }
    }
    return app.fetch(req, env, ctx);
  },
};
