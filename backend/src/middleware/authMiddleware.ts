import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET, UserTokenPayload } from '../services/STARTER_AUTH_SERVICE';

export interface AuthenticatedRequest extends Request {
  user?: UserTokenPayload;
}

/**
 * Middleware to authenticate requests using JWT Bearer tokens
 */
export const authMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      status: 'error',
      message: 'Authentication token missing or invalid format. Please provide a Bearer token in the Authorization header.'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as UserTokenPayload;
    req.user = decoded;
    next();
  } catch (err: any) {
    return res.status(401).json({
      status: 'error',
      message: 'Invalid or expired authentication token. Please log in again.'
    });
  }
};

/**
 * Role-based access control (RBAC) middleware factory
 * Supports aliases (e.g. 'ADMIN' <=> 'hospital_admin')
 */
export const requireRole = (...allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required before role authorization'
      });
    }

    const userRole = (req.user.user_role || '').toLowerCase();

    // Map role aliases to canonical names
    const roleAliasMap: Record<string, string[]> = {
      'hospital_admin': ['hospital_admin', 'admin'],
      'admin': ['hospital_admin', 'admin'],
      'transplant_surgeon': ['transplant_surgeon', 'surgeon'],
      'surgeon': ['transplant_surgeon', 'surgeon'],
      'regulatory_officer': ['regulatory_officer', 'officer', 'notto_officer'],
      'officer': ['regulatory_officer', 'officer', 'notto_officer']
    };

    const normalizedAllowed = allowedRoles.flatMap(r => {
      const lower = r.toLowerCase();
      return roleAliasMap[lower] || [lower];
    });

    const isAuthorized = normalizedAllowed.includes(userRole);

    if (!isAuthorized) {
      return res.status(403).json({
        status: 'error',
        message: `Forbidden: Access restricted. Required role(s): [${allowedRoles.join(', ')}]. Current role: '${req.user.user_role}'.`
      });
    }

    next();
  };
};
