import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * 1. Auth Rate Limiter:
 * 5 attempts per minute on login routes
 */
export const authLoginRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
    message: 'Too many authentication attempts (limit: 5/min). Please wait 60 seconds before retrying.'
  }
});

/**
 * 2. OTP Request Rate Limiter:
 * 3 requests per hour for sensitive OTP/2FA generation
 */
export const otpRequestRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => {
    // Allow rapid testing in non-production development environments
    return process.env.NODE_ENV !== 'production' && req.headers['x-dev-test'] === 'true';
  },
  message: {
    status: 'error',
    code: 'OTP_RATE_LIMIT_EXCEEDED',
    message: 'Too many OTP generation requests (limit: 3/hour). Please wait or use demo bypass code (994012).'
  }
});

/**
 * 3. Algorithm Matching Rate Limiter:
 * 100 requests per minute on matching calculations
 */
export const matchingRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    code: 'MATCHING_RATE_LIMIT_EXCEEDED',
    message: 'Algorithm evaluation rate limit exceeded (100 requests/min).'
  }
});

/**
 * 4. General API Rate Limiter:
 * 300 requests per minute
 */
export const generalRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    code: 'API_RATE_LIMIT_EXCEEDED',
    message: 'General API request threshold exceeded (300 requests/min).'
  }
});
