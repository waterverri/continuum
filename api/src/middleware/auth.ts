import { Response, NextFunction } from 'express';
import { RequestWithUser } from '../index';

export const authenticateUser = (req: RequestWithUser, res: Response, next: NextFunction) => {
  // The JWT validation is already done in the main middleware
  // This middleware just ensures the user is authenticated
  if (!req.user || !req.token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  next();
};