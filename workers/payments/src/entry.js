import app from './index.js';

const cors = origin => ({
  'access-control-allow-origin': origin || '*',
  'access-control-allow-headers': 'authorization,content-type,x-firebase-id-token',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-max-age': '86400',
  vary: 'Origin',
});

export default {
  async fetch(req, env, ctx) {
    const origin = req.headers.get('origin') || '*';
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
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
