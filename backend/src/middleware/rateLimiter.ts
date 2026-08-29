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

export const otpRequestRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    code: 'OTP_RATE_LIMIT_EXCEEDED',
    message: 'Too many OTP generation requests. Please wait a moment or use master code (994012).'
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
