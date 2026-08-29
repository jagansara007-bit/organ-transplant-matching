import { Router } from 'express';
import { 
  createAllocation, 
  updateLogisticsStatus, 
  recordRegulatoryApproval,
  getAuditTrail,
  getAllocations 
} from '../controllers/allocation.controller';
import { validate, createAllocationSchema, updateLogisticsSchema } from '../middleware/validate';
import { authMiddleware, requireRole } from '../middleware/authMiddleware';

const router = Router();

// Apply Authentication Middleware globally for allocations
router.use(authMiddleware);

// Routes
router.post('/allocate', requireRole('transplant_surgeon', 'hospital_admin'), validate(createAllocationSchema), createAllocation);
router.patch('/:id/logistics', requireRole('transplant_surgeon', 'hospital_admin', 'regulatory_officer'), validate(updateLogisticsSchema), updateLogisticsStatus);
router.post('/:id/regulatory-approval', requireRole('regulatory_officer', 'hospital_admin'), recordRegulatoryApproval);
router.get('/audit-trail', getAuditTrail);
router.get('/', getAllocations);

export default router;
