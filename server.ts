import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NEKOSIA_API_BASE = 'https://api.nekosia.cat/api/v1';
const ALLOWED_IMAGE_HOSTS = new Set([
  'cdn.nekosia.cat',
  'api.nekosia.cat',
  'nekosia.cat',
  'i.pximg.net',
]);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Proxy: GET /api/nekosia/images/:category
  app.get('/api/nekosia/images/:category', async (req, res) => {
    try {
      const category = encodeURIComponent(req.params.category || 'catgirl');
      const query = new URLSearchParams();

      for (const [key, value] of Object.entries(req.query)) {
        if (typeof value === 'string' && value.trim() !== '') {
          query.set(key, value.trim());
        }
      }

      const queryString = query.toString();
      const targetUrl = `${NEKOSIA_API_BASE}/images/${category}${queryString ? `?${queryString}` : ''}`;

      const upstream = await fetch(targetUrl, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'NekosiaArchiveDeck/1.0',
        },
      });

      const data = await upstream.json();
      res.status(upstream.status).json(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upstream Nekosia request failed';
      res.status(502).json({ success: false, status: 502, error: message });
    }
  });

  // Proxy: GET /api/nekosia/getImageById/:id
  app.get('/api/nekosia/getImageById/:id', async (req, res) => {
    try {
      const id = encodeURIComponent(req.params.id);
      const targetUrl = `${NEKOSIA_API_BASE}/getImageById/${id}`;

      const upstream = await fetch(targetUrl, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'NekosiaArchiveDeck/1.0',
        },
      });

      const data = await upstream.json();
      res.status(upstream.status).json(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upstream Nekosia ID lookup failed';
      res.status(502).json({ success: false, status: 502, error: message });
    }
  });

  // Proxy: GET /api/nekosia/image-of-the-day
  app.get('/api/nekosia/image-of-the-day', async (_req, res) => {
    try {
      const targetUrl = `${NEKOSIA_API_BASE}/image-of-the-day`;
      const upstream = await fetch(targetUrl, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'NekosiaArchiveDeck/1.0',
        },
      });

      const data = await upstream.json();
      res.status(upstream.status).json(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upstream Nekosia daily image failed';
      res.status(502).json({ success: false, status: 502, error: message });
    }
  });

  // Proxy: GET /api/nekosia/tags
  app.get('/api/nekosia/tags', async (_req, res) => {
    try {
      const targetUrl = `${NEKOSIA_API_BASE}/tags`;
      const upstream = await fetch(targetUrl, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'NekosiaArchiveDeck/1.0',
        },
      });

      const data = await upstream.json();
      res.status(upstream.status).json(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upstream Nekosia tags request failed';
      res.status(502).json({ success: false, status: 502, error: message });
    }
  });

  // Binary Image Download & Inline CORS Proxy
  app.get('/api/download', async (req, res) => {
    try {
      const rawUrl = typeof req.query.url === 'string' ? req.query.url : '';
      const rawFilename =
        typeof req.query.filename === 'string' ? req.query.filename : 'nekosia-image.jpg';
      const inline = req.query.inline === 'true';

      if (!rawUrl) {
        res.status(400).json({ error: 'Missing url parameter' });
        return;
      }

      const parsed = new URL(rawUrl);
      if (!ALLOWED_IMAGE_HOSTS.has(parsed.hostname)) {
        res.status(403).json({ error: 'Host not permitted by archive proxy' });
        return;
      }

      const headers: Record<string, string> = {
        'User-Agent': 'NekosiaArchiveDeck/1.0',
      };
      if (parsed.hostname === 'i.pximg.net') {
        headers['Referer'] = 'https://www.pixiv.net/';
      }

      const upstream = await fetch(parsed.toString(), { headers });
      if (!upstream.ok) {
        res.status(upstream.status).json({ error: `Upstream image status ${upstream.status}` });
        return;
      }

      const contentType = upstream.headers.get('content-type') || 'image/jpeg';
      const arrayBuffer = await upstream.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const safeFilename = rawFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader(
        'Content-Disposition',
        inline ? `inline; filename="${safeFilename}"` : `attachment; filename="${safeFilename}"`
      );

      res.send(buffer);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Image download proxy error';
      res.status(502).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Nekosia Archive Deck server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
