import { Router } from 'express';
import { registerDonor, getDonors } from '../controllers/donor.controller';
import { validate, createDonorSchema } from '../middleware/validate';
import { authMiddleware, requireRole } from '../middleware/authMiddleware';

const router = Router();

// Apply Authentication Middleware
router.use(authMiddleware);

// Routes
router.post('/register', requireRole('hospital_admin', 'transplant_surgeon'), validate(createDonorSchema), registerDonor);
router.get('/', getDonors);

export default router;
