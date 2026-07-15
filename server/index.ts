import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { router } from './routes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT ?? 3001);

// Allow Vite dev server to talk to this API in development
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:4173'] }));
app.use(express.json());

// All API endpoints
app.use('/api', router);

// In production: serve the built Vite frontend from the same server
if (process.env.NODE_ENV === 'production') {
  const dist = join(__dirname, '..', 'dist');
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(join(dist, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`✓ API server ready  →  http://localhost:${PORT}/api/staff`);
  if (process.env.NODE_ENV !== 'production') {
    console.log('  Vite dev server  →  http://localhost:5173');
  }
});
