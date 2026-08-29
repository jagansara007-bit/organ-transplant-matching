import { Router, Response } from 'express';
import { StarterAuthService } from '../services/STARTER_AUTH_SERVICE';
import { EmailService } from '../services/email.service';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware';
import { authLoginRateLimiter, otpRequestRateLimiter } from '../middleware/rateLimiter';
import { AuditLoggerService } from '../services/auditLogger';
import { z } from 'zod';

const router = Router();

const loginSchema = z.object({
  email: z.string().email('Invalid email address format'),
  password: z.string().min(1, 'Password is required')
});

const sendOtpSchema = z.object({
  email: z.string().email('Invalid email address format'),
  purpose: z.string().optional()
});

const verifyOtpSchema = z.object({
  email: z.string().email('Invalid email address format'),
  otp: z.string().min(1, 'OTP code is required'),
  loginAfterVerify: z.boolean().optional()
});


const registerSchema = z.object({
  hospitalId: z.string().uuid('Invalid hospital UUID format'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['hospital_admin', 'transplant_surgeon', 'regulatory_officer', 'ADMIN', 'TRANSPLANT_SURGEON', 'REGULATORY_OFFICER'] as const),
  medicalLicense: z.string().optional()
});

/**
 * POST /api/auth/request-otp & POST /api/auth/send-otp
 * Dispatches a 6-digit cryptographic 2FA OTP to the user's personal/official email address.
 */
const handleRequestOtp = async (req: any, res: any) => {
  const parseResult = sendOtpSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation error',
      errors: parseResult.error.errors
    });
  }

  const { email, purpose } = parseResult.data;

  try {
    const result = await EmailService.sendOtp(email, purpose || 'Clinical 2FA Authorization');

    // Forensic audit log
    AuditLoggerService.logEvent({
      entity_type: 'auth_otp',
      entity_id: email,
      action: 'OTP_DISPATCHED',
      performed_by: email,
      client_ip: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
      details: { purpose: purpose || 'Clinical 2FA Authorization' }
    }).catch(() => {});

    return res.status(200).json({
      status: 'success',
      message: result.message,
      email: email.trim().toLowerCase(),
      debugOtp: result.debugOtp
    });
  } catch (err: any) {
    return res.status(500).json({
      status: 'error',
      message: err.message || 'Failed to dispatch verification email'
    });
  }
};

router.post('/request-otp', otpRequestRateLimiter, handleRequestOtp);
router.post('/send-otp', otpRequestRateLimiter, handleRequestOtp);

/**
 * POST /api/auth/verify-otp
 * Verifies the submitted 6-digit OTP. If loginAfterVerify is true (default), returns a verified JWT session.
 */
router.post('/verify-otp', async (req, res) => {
  const parseResult = verifyOtpSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation error',
      errors: parseResult.error.errors
    });
  }

  const { email, otp, loginAfterVerify } = parseResult.data;

  try {
    EmailService.verifyOtp(email, otp);

    if (loginAfterVerify !== false) {
      const sessionResult = await StarterAuthService.loginWithVerifiedEmail(email);
      return res.status(200).json({
        message: 'Email verified and logged in successfully!',
        ...sessionResult
      });
    }

    return res.status(200).json({
      status: 'success',
      verified: true,
      email: email.trim().toLowerCase(),
      message: 'Email OTP verified successfully!'
    });
  } catch (err: any) {
    return res.status(400).json({
      status: 'error',
      message: err.message || 'Invalid or expired OTP'
    });
  }
});

/**
 * POST /api/auth/configure-smtp
 * Allows configuring personal Gmail/SMTP credentials at runtime.
 */
router.post('/configure-smtp', (req, res) => {
  const { smtpUser, smtpPass, smtpHost, smtpPort } = req.body;

  if (!smtpUser || !smtpPass) {
    return res.status(400).json({
      status: 'error',
      message: 'Both SMTP Email/User and App Password are required'
    });
  }

  process.env.SMTP_USER = smtpUser;
  process.env.SMTP_PASS = smtpPass;
  if (smtpHost) process.env.SMTP_HOST = smtpHost;
  if (smtpPort) process.env.SMTP_PORT = smtpPort.toString();

  return res.status(200).json({
    status: 'success',
    message: `SMTP sender configured for ${smtpUser}. Subsequent OTPs will be delivered directly from this account.`
  });
});

/**
 * POST /api/auth/login
 * Validates hospital staff email, password hash, and checks hospital verification status along with medical_license.
 * Returns a signed JWT containing { id, hospital_id, email, user_role, medical_license }.
 */
router.post('/login', authLoginRateLimiter, async (req, res) => {
  const parseResult = loginSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation error',
      errors: parseResult.error.errors
    });
  }

  const { email, password } = parseResult.data;

  try {
    const authResult = await StarterAuthService.login(email, password);
    return res.status(200).json(authResult);
  } catch (err: any) {
    return res.status(401).json({
      status: 'error',
      message: err.message || 'Authentication failed'
    });
  }
});

/**
 * POST /api/auth/register
 * Registers new hospital personnel under a valid hospital_id (roles: 'hospital_admin', 'transplant_surgeon', 'regulatory_officer').
 */
router.post('/register', async (req, res) => {
  const parseResult = registerSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation error',
      errors: parseResult.error.errors
    });
  }

  const { hospitalId, fullName, email, password, role, medicalLicense } = parseResult.data;

  try {
    const normalizedRole = (role.toLowerCase() === 'admin' ? 'hospital_admin' : role.toLowerCase()) as any;
    const registerResult = await StarterAuthService.register({
      hospitalId,
      fullName,
      email,
      passwordPlain: password,
      role: normalizedRole,
      medicalLicense
    });

    return res.status(201).json(registerResult);
  } catch (err: any) {
    return res.status(400).json({
      status: 'error',
      message: err.message || 'Registration failed'
    });
  }
});

/**
 * GET /api/auth/me
 * Returns current authenticated session details and affiliated hospital metadata.
 */
router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ status: 'error', message: 'User not authenticated' });
  }

  try {
    const userProfile = await StarterAuthService.getMe(req.user.id);
    if (!userProfile) {
      return res.status(404).json({ status: 'error', message: 'User session not found' });
    }

    return res.json({
      status: 'success',
      session: {
        user: {
          id: userProfile.id,
          hospital_id: userProfile.hospital_id,
          full_name: userProfile.full_name,
          email: userProfile.email,
          user_role: userProfile.role,
          medical_license: userProfile.medical_license,
          is_authorized: userProfile.is_authorized
        },
        hospital: userProfile.hospital
      }
    });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to fetch session' });
  }
});

export default router;
