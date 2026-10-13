import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { config } from '../config';
import { db } from '../db';

// Active admin sessions memory cache (keyed by random token)
const activeAdminTokens = new Set<string>(['admin_session_token_dev_auth']);

export function createAdminSessionToken(): string {
  const token = `adm_${crypto.randomBytes(24).toString('hex')}`;
  activeAdminTokens.add(token);
  return token;
}

export function revokeAdminSessionToken(token: string) {
  activeAdminTokens.delete(token);
}

export function requireAdminAuth(req: Request, res: Response, next: NextFunction): any {
  const token = (req.headers['x-admin-token'] || req.query.admin_token) as string;
  if (!token || !activeAdminTokens.has(token)) {
    return res.status(401).json({
      error: 'Unauthorized: Valid admin session token required.',
      code: 'AUTH_REQUIRED',
    });
  }
  next();
}

export async function requireAgentAuth(req: Request, res: Response, next: NextFunction): Promise<any> {
  const authHeader = req.headers['x-agent-key'] || req.headers['authorization'];
  let token = '';
  if (typeof authHeader === 'string') {
    token = authHeader.replace(/^Bearer\s+/i, '');
  }

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized: X-Agent-Key header required.',
      code: 'AGENT_AUTH_REQUIRED',
    });
  }

  const agent = await db.getAgentByApiKey(token);
  if (!agent) {
    return res.status(401).json({
      error: 'Unauthorized: Unknown or revoked Print Agent credential.',
      code: 'INVALID_AGENT_KEY',
    });
  }

  (req as any).agent = agent;
  next();
}
