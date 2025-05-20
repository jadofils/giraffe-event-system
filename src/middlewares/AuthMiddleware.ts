import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const SECRET_KEY = process.env.JWT_SECRET || "your_jwt_secret"; // Use env variable in production

export interface AuthenticatedRequest extends Request {
    user?: {
        userId: string;  // lowercase userId to match JWT token
        email: string;
        username: string;
        organizations: string[];  // lowercase organizations to match JWT token
        organizationId: string;
        roles?: string[];
    };

}

export const verifyJWT = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(" ")[1] || req.cookies?.authToken;

  if (!token) {
    res.status(401).json({
      success: false,
      message: "Access denied. No token provided.",
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY) as AuthenticatedRequest["user"];
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({
      success: false,
      message: "Invalid or expired token.",
    });
  }
};
