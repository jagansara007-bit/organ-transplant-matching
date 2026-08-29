import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import healthRoutes from './routes/health.routes';
import authRoutes from './routes/auth.routes';
import donorRoutes from './routes/donors';
import recipientRoutes from './routes/recipients';
import matchRoutes from './routes/matches';
import allocationRoutes from './routes/allocations';
import { generalRateLimiter } from './middleware/rateLimiter';

const app: Express = express();

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(morgan('dev'));

// General API Rate Limiting (300 requests/min)
app.use('/api', generalRateLimiter);

// Route Registrations
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/donors', donorRoutes);
app.use('/api/recipients', recipientRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/allocations', allocationRoutes);

app.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'online',
    message: 'Organ Transplant Matching System API Server is running.',
    endpoints: '/api',
    frontendUrl: 'http://localhost:3000'
  });
});

app.get('/api', (_req: Request, res: Response) => {
  res.json({
    name: 'Organ Transplant Matching System API',
    version: '1.0.0',
    endpoints: [
      '/api/health',
      '/api/health/diagnostics',
      '/api/auth/login',
      '/api/auth/request-otp',
      '/api/auth/verify-otp',
      '/api/auth/register',
      '/api/auth/me',
      '/api/donors',
      '/api/recipients',
      '/api/matches',
      '/api/allocations'
    ]
  });
});

export default app;
