import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { router } from './routes.js';
import { authRouter, requireAuth } from './auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT ?? 3001);

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:4173'] }));
app.use(express.json());

// Public auth routes (login, etc.)
app.use('/api/auth', authRouter);

// All rota data routes are protected — must be logged in
app.use('/api', requireAuth, router);

// In production: serve the built Vite frontend from the same server
if (process.env.NODE_ENV === 'production') {
  const dist = join(__dirname, '..', 'dist');
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(join(dist, 'index.html')));
}

// Export for Vercel serverless (vercel.json routes requests here)
export default app;

// Only bind to a port when running directly (not Vercel)
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`✓ API server ready  →  http://localhost:${PORT}/api/staff`);
    if (process.env.NODE_ENV !== 'production') {
      console.log('  Vite dev server  →  http://localhost:5173');
    }
  });
}
