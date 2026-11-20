import 'dotenv/config';
import path from 'path';
import express from 'express';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';
import authRoutes from './src/routes/authRoutes.ts';
import catalogRoutes from './src/routes/catalogRoutes.ts';
import commerceRoutes from './src/routes/commerceRoutes.ts';
import panelRoutes from './src/routes/panelRoutes.ts';
import { ensureSeeded } from './src/db/seed.ts';

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  const PORT = Number(process.env.PORT) || 3000;

  // Security headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Serve uploaded custom puja lists safely
  app.use('/uploads', express.static(path.resolve(process.cwd(), 'public', 'uploads')));

  // Mount REST API routes
  app.use('/api', authRoutes);
  app.use('/api', catalogRoutes);
  app.use('/api', commerceRoutes);
  app.use('/api', panelRoutes);

  // API 404 fallback
  app.use('/api', (_req, res) => {
    res.status(404).json({ success: false, error: 'API endpoint not found' });
  });

  if (process.env.NODE_ENV !== 'production') {
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
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PujaJunction.com server running on http://localhost:${PORT}`);
    void ensureSeeded().catch((err) => console.error('Initial seed warning:', err));
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
