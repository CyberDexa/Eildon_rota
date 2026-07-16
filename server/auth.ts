import { Router, type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { sql } from './db.js';

interface JwtPayload {
  id: string;
  username: string;
  role: 'manager' | 'user';
}

// ─── Middleware ───────────────────────────────────────────────────────────────

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return void res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const payload = jwt.verify(
      auth.slice(7),
      process.env.JWT_SECRET ?? 'fallback-secret'
    ) as JwtPayload;
    (req as any).user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
}

export function requireManager(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as JwtPayload | undefined;
  if (user?.role !== 'manager') {
    return void res.status(403).json({ error: 'Manager access required' });
  }
  next();
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export const authRouter = Router();

/** POST /api/auth/login */
authRouter.post('/login', async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username?.trim() || !password) {
    return void res.status(400).json({ error: 'Username and password are required' });
  }
  try {
    const rows = await sql`SELECT * FROM users WHERE username = ${username.toLowerCase().trim()}`;
    if (rows.length === 0) {
      return void res.status(401).json({ error: 'Invalid username or password' });
    }
    const u = rows[0] as Record<string, unknown>;
    const match = await bcrypt.compare(password, u.password_hash as string);
    if (!match) {
      return void res.status(401).json({ error: 'Invalid username or password' });
    }
    const token = jwt.sign(
      { id: u.id, username: u.username, role: u.role },
      process.env.JWT_SECRET ?? 'fallback-secret',
      { expiresIn: '24h' }
    );
    res.json({ token, user: { id: u.id, username: u.username, role: u.role } });
  } catch (err) {
    console.error('[POST /auth/login]', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

/** GET /api/auth/me — verify token + return current user */
authRouter.get('/me', requireAuth, (req, res) => {
  res.json((req as any).user);
});

/** GET /api/auth/users — manager only */
authRouter.get('/users', requireAuth, requireManager, async (_req, res) => {
  try {
    const rows = await sql`SELECT id, username, role, created_at FROM users ORDER BY created_at`;
    res.json(rows);
  } catch (err) {
    console.error('[GET /auth/users]', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/** POST /api/auth/users — manager creates a new user */
authRouter.post('/users', requireAuth, requireManager, async (req, res) => {
  const { username, password, role } = req.body as {
    username?: string;
    password?: string;
    role?: string;
  };
  if (!username?.trim() || !password) {
    return void res.status(400).json({ error: 'Username and password are required' });
  }
  if (password.length < 6) {
    return void res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  if (!['manager', 'user'].includes(role ?? '')) {
    return void res.status(400).json({ error: 'Role must be manager or user' });
  }
  try {
    const id = `user-${Date.now()}`;
    const hash = await bcrypt.hash(password, 10);
    await sql`
      INSERT INTO users (id, username, password_hash, role)
      VALUES (${id}, ${username.toLowerCase().trim()}, ${hash}, ${role})
    `;
    const rows = await sql`SELECT id, username, role, created_at FROM users WHERE id = ${id}`;
    res.status(201).json(rows[0]);
  } catch (err: unknown) {
    if ((err as any)?.code === '23505') {
      return void res.status(409).json({ error: 'Username already taken' });
    }
    console.error('[POST /auth/users]', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

/** DELETE /api/auth/users/:id — manager only, can't delete own account */
authRouter.delete('/users/:id', requireAuth, requireManager, async (req, res) => {
  const { id } = req.params;
  const currentUser = (req as any).user as JwtPayload;
  if (id === currentUser.id) {
    return void res.status(400).json({ error: 'You cannot delete your own account' });
  }
  try {
    await sql`DELETE FROM users WHERE id = ${id}`;
    res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /auth/users/:id]', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

/** PUT /api/auth/users/:id/password */
authRouter.put('/users/:id/password', requireAuth, async (req, res) => {
  const { id } = req.params;
  const currentUser = (req as any).user as JwtPayload;
  const { newPassword } = req.body as { newPassword?: string };

  if (currentUser.role !== 'manager' && id !== currentUser.id) {
    return void res.status(403).json({ error: 'Forbidden' });
  }
  if (!newPassword || newPassword.length < 6) {
    return void res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  try {
    const hash = await bcrypt.hash(newPassword, 10);
    await sql`UPDATE users SET password_hash = ${hash} WHERE id = ${id}`;
    res.json({ success: true });
  } catch (err) {
    console.error('[PUT /auth/users/:id/password]', err);
    res.status(500).json({ error: 'Failed to update password' });
  }
});
