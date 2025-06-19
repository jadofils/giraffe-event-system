// src/routes/organizationRoutes.ts
import { Router, Request, Response, NextFunction } from "express";
import { authenticate } from "../middlewares/AuthMiddleware";

const router = Router();

// Middleware to validate request body for user assignment/removal routes
const validateUserIdsBody = (req: Request, res: Response, next: NextFunction): void => {
  if (req.method === 'POST' || req.method === 'DELETE') {
    if (!req.body) {
      res.status(400).json({
        success: false,
        message: "Request body is required. Please ensure you're sending JSON with Content-Type: application/json"
      });
      return;
    }
    
    if (!req.body.userIds || !Array.isArray(req.body.userIds)) {
      res.status(400).json({
        success: false,
        message: "userIds array is required in request body"
      });
      return;
    }
  }
  next();
};



export const organizationRoutes = router;