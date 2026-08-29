import { Router } from 'express';
import { registerRecipient, getRecipients } from '../controllers/recipient.controller';
import { validate, createRecipientSchema } from '../middleware/validate';
import { authMiddleware, requireRole } from '../middleware/authMiddleware';

const router = Router();

// Apply Authentication Middleware
router.use(authMiddleware);

// Routes
router.post('/register', requireRole('hospital_admin', 'transplant_surgeon'), validate(createRecipientSchema), registerRecipient);
router.get('/', getRecipients);

export default router;
