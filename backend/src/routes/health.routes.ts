import { Router } from 'express';
import { getHealthStatus, getDiagnosticsTelemetry } from '../controllers/health.controller';

const router = Router();

router.get('/', getHealthStatus);
router.get('/diagnostics', getDiagnosticsTelemetry);

export default router;
