import { Router } from 'express';
import { findMatches, acceptMatch, getMatches } from '../controllers/match.controller';
import { authMiddleware, requireRole } from '../middleware/authMiddleware';
import { matchingRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Apply Authentication Middleware
router.use(authMiddleware);

// Routes with matchingRateLimiter
router.get('/find', matchingRateLimiter, findMatches);
router.post('/:id/accept', requireRole('transplant_surgeon', 'hospital_admin'), acceptMatch);
router.get('/', matchingRateLimiter, getMatches);

export default router;
