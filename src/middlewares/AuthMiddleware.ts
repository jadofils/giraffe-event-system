import { Router } from "express";
import { VenueController } from "../controller/venueController";
import { isAdmin } from "../middlewares/IsAdmin"; 

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../config/Database";
import { User } from "../models/User";
import { UserInterface } from "../interfaces/UserInterface";

const SECRET_KEY = process.env.JWT_SECRET || "your_jwt_secret";

// Define JWT payload structure
interface JwtPayload {
  userId: string;
  email: string;
  username: string;
  organizations: any[];
  organizationId: string;
  roles?: string | string[];
}

// Extend Express Request to include authenticated user
export interface AuthenticatedRequest extends Request {
  user: UserInterface & {
    id: string;
    userId: string;
    email: string;
    username: string;
    organizations: any[];
    organizationId: string;
    roles: { roleName: string; permissions: string[] }[];
    isAdmin?: boolean;
  };
}

// Authentication middleware - accepts standard Request and augments it
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(" ")[1];

  if (!token) {
    console.log("Access denied: No token provided.");
    res.status(401).json({
      success: false,
      message: "Access denied. No token provided.",
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY) as JwtPayload & { role?: any };
    console.log("Decoded JWT:", decoded);
    
    // If role and permissions are present in the token, use them directly
    if (decoded.role && decoded.role.permissions) {
    (req as AuthenticatedRequest).user = {
    id: decoded.userId,
    userId: decoded.userId,
    email: decoded.email,
    username: decoded.username,
    organizations: decoded.organizations || [],
    organizationId: decoded.organizationId,
    roles: [{
    roleName: decoded.role.roleName,
    permissions: decoded.role.permissions.map((p: any) => p.name),
    }],
    role: decoded.role,
    isAdmin: decoded.role.roleName === "ADMIN",
    } as any;
    console.log("req.user populated from token:", (req as AuthenticatedRequest).user);
    return next();
    }
    
    // Fallback: fetch from DB if not present in token
    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({
      where: { userId: decoded.userId },
      relations: ["role", "role.permissions", "organizations"],
    });

    if (!user) {
      console.warn(`Invalid token: User ${decoded.userId} not found.`);
      res.status(401).json({
        success: false,
        message: "Invalid token: User not found in database.",
      });
      return;
    }

    const organizations = user.organizations?.map(org => ({
      organizationId: org.organizationId,
      organizationName: org.organizationName,
      description: org.description,
      contactEmail: org.contactEmail,
      contactPhone: org.contactPhone,
      address: org.address,
      organizationType: org.organizationType,
      city: org.city,
      country: org.country,
      postalCode: org.postalCode,
      stateProvince: org.stateProvince,
    })) || [];

    const isAdmin = user.role?.roleName?.toLowerCase() === "admin";

    const mappedRole = user.role
      ? {
          roleId: user.role.roleId,
          roleName: user.role.roleName,
          description: user.role.description,
          createdAt: user.role.createdAt,
          updatedAt: user.role.updatedAt,
          deletedAt: user.role.deletedAt,
          permissions: user.role.permissions || [],
          users: [], // or user.role.users if you want to include them
          isAdmin,
        }
      : undefined;

    // Augment the request object with user data
    (req as AuthenticatedRequest).user = {
      ...user,
      id: user.userId,
      userId: decoded.userId,
      email: decoded.email,
      username: decoded.username,
      organizations,
      organizationId: decoded.organizationId,
      role: mappedRole,
      isAdmin,
      roles: user.role
        ? [{
            roleName: user.role.roleName,
            permissions: user.role.permissions?.map(p => p.name) || [],
          }]
        : [],
      socialMediaLinks: user.socialMediaLinks && typeof user.socialMediaLinks === 'object'
        ? Object.fromEntries(
            Object.entries(user.socialMediaLinks).filter(([k, v]) => typeof v === 'string')
          ) as { [key: string]: string }
        : undefined,
    };

    console.log("req.user populated:", (req as AuthenticatedRequest).user);
    next();
    } catch (err) {
    console.error("JWT verification error:", err);
    
    if (err instanceof jwt.TokenExpiredError) {
    res.status(401).json({ success: false, message: "Token expired. Please log in again." });
    } else if (err instanceof jwt.JsonWebTokenError) {
    res.status(401).json({ success: false, message: "Invalid token. Please log in again." });
    } else {
    res.status(500).json({ success: false, message: "Authentication failed due to server error." });
    }
    }
    };

// Type guard to check if request has authenticated user
export const isAuthenticatedRequest = (req: Request): req is AuthenticatedRequest => {
  return 'user' in req && req.user !== undefined;
};


//router.use("/", checkAbsenceRoutes);

