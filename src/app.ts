// src/app.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { AppConfig } from './config/AppConfig';
import routes from './routes';

// Initialize express app
const app = express();

// Apply middlewares
app.use(helmet()); // Security headers
app.use(cors({
  origin: AppConfig.CORS_ORIGIN,
  credentials: true
}));
app.use(express.json()); // Parse JSON request body
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded request body

// Logging
if (!AppConfig.isTest()) {
  app.use(morgan(AppConfig.LOG_FORMAT));
}

// API routes
app.use(AppConfig.API_PREFIX, routes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP' });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const status = err.status || 500;
  const message = err.message || 'Something went wrong';
  
  console.error(`[Error] ${status} - ${message}`);
  
  res.status(status).json({
    status,
    message,
    ...(AppConfig.isDevelopment() && { stack: err.stack })
  });
});

export default app;