import { Request, Response, NextFunction } from 'express';
import { z, AnyZodObject, ZodError } from 'zod';

export const validate = (schema: AnyZodObject) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    req.body = await schema.parseAsync(req.body);
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      });
    }
    next(error);
  }
};

// Zod Validation Schemas
export const createDonorSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters long'),
  bloodType: z.enum(['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'], {
    errorMap: () => ({ message: 'Invalid blood type (must be O+, O-, A+, A-, B+, B-, AB+, or AB-)' })
  }),
  organType: z.string().min(2, 'Organ type is required'),
  tissueType: z.string().min(2, 'Tissue type is required'),
  donorType: z.enum(['DECEASED', 'LIVING_FAMILY']).optional(),
  maskedAadhaar: z.string().optional(),
  hospitalId: z.string().optional()
});

export const createRecipientSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters long'),
  bloodType: z.enum(['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'], {
    errorMap: () => ({ message: 'Invalid blood type' })
  }),
  organNeeded: z.string().min(2, 'Organ needed is required'),
  urgencyLevel: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'], {
    errorMap: () => ({ message: 'Urgency level must be CRITICAL, HIGH, MEDIUM, or LOW' })
  }),
  waitTimeDays: z.number().nonnegative('Wait time days cannot be negative').optional().default(0),
  nottoRegNumber: z.string().optional(),
  hospitalId: z.string().optional()
});

export const createAllocationSchema = z.object({
  matchId: z.string().min(1, 'Valid match ID is required'),
  logisticsStatus: z.enum(['pending', 'in_transit', 'delivered', 'cancelled']).optional().default('pending'),
  regulatoryApproval: z.boolean().optional().default(true),
  coldChainParams: z.any().optional()
});

export const updateLogisticsSchema = z.object({
  logisticsStatus: z.enum(['pending', 'in_transit', 'delivered', 'cancelled'], {
    errorMap: () => ({ message: 'Logistics status must be pending, in_transit, delivered, or cancelled' })
  }),
  temperatureCelsius: z.number().optional(),
  organCondition: z.string().optional()
});
