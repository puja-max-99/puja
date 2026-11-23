import 'dotenv/config';
import path from 'path';
import express from 'express';
import cookieParser from 'cookie-parser';
import authRoutes from './src/routes/authRoutes.ts';
import catalogRoutes from './src/routes/catalogRoutes.ts';
import commerceRoutes from './src/routes/commerceRoutes.ts';
import panelRoutes from './src/routes/panelRoutes.ts';
import { closePool, pool } from './src/db/index.ts';
import { ensureSeeded } from './src/db/seed.ts';

async function startServer() {
  const app = express();
  const isProd = process.env.NODE_ENV === 'production';

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  const PORT = Number(process.env.PORT) || 3000;

  // Production security headers (iframe-compatible)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), geolocation=()');
    next();
  });

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Health check endpoint for Hostinger / PM2 / Nginx / uptime monitors
  app.get('/api/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({
        success: true,
        status: 'ok',
        db: 'connected',
        env: isProd ? 'production' : 'development',
        uptimeSec: Math.round(process.uptime()),
      });
    } catch (err) {
      console.error('Health check DB error:', err);
      res.status(503).json({
        success: false,
        status: 'degraded',
        db: 'disconnected',
      });
    }
  });

  // Serve uploaded custom puja lists safely
  app.use(
    '/uploads',
    express.static(path.resolve(process.cwd(), 'public', 'uploads'), {
      dotfiles: 'deny',
      index: false,
      maxAge: isProd ? '7d' : 0,
    })
  );

  // Mount REST API routes
  app.use('/api', authRoutes);
  app.use('/api', catalogRoutes);
  app.use('/api', commerceRoutes);
  app.use('/api', panelRoutes);

  // API 404 fallback
  app.use('/api', (_req, res) => {
    res.status(404).json({ success: false, error: 'API endpoint not found' });
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(
      '/assets',
      express.static(path.join(distDir, 'assets'), {
        maxAge: '1y',
        immutable: true,
      })
    );
    app.use(
      express.static(distDir, {
        index: false,
        maxAge: '1h',
      })
    );
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `PujaJunction.com server running on http://0.0.0.0:${PORT} (${isProd ? 'production' : 'development'})`
    );
    void ensureSeeded().catch((err) => console.error('Initial seed warning:', err));
  });

  const shutdown = (signal: string) => {
    console.log(`Received ${signal}, shutting down PujaJunction server gracefully...`);
    server.close(async () => {
      try {
        await closePool();
      } catch (err) {
        console.error('Error closing DB pool:', err);
      }
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
