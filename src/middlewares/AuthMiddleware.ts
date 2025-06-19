// src/middlewares/AuthMiddleware.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../config/Database"; // Adjust path to your data-source
import { User } from "../models/User"; // Adjust path to your User entity
import { Role } from "../models/Role"; // Adjust path to your Role entity (assuming you have one)
import { UserController } from "../controller/user/Registration";

const SECRET_KEY = process.env.JWT_SECRET || "your_jwt_secret"; // Use env variable in production

// Define the structure of the decoded JWT payload
interface JwtPayload {
  userId: string;
  email: string;
  username: string;
  organizations: any[]; // Array of organization objects, as sent in login
  organizationId: string;
  roles?: string | string[]; // Adjust this type based on what `user.roles` is in your User entity when signing the token.
  // If it's the role ID (UUID), then `string`. If an array of IDs, then `string[]`.
  // Your log `Role(s): f92a8b37-fbcb-428e-a5b1-fc16064989ef` suggests a single string UUID.
}

// Extend the Request object to include a 'user' property with detailed info
export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    username: string;
    organizations: any[]; // Array of organization objects
    organizationId: string;
    roles: { roleName: string; permissions: string[] }[]; // Array of detailed role objects
  };
}

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  // Prefer header token, fallback to cookie if needed (though header is standard for APIs)
  const token = authHeader?.split(" ")[1]; // Removed `|| req.cookies?.authToken` as header is primary

  if (!token) {
    console.log("Access denied: No token provided."); // Add logging for debugging
    res.status(401).json({
      success: false,
      message: "Access denied. No token provided.",
    });
    return;
  }

  try {
    // 1. Verify the JWT token payload
    // Cast to our defined JwtPayload interface
    const decoded = jwt.verify(token, SECRET_KEY) as JwtPayload;

    console.log("AuthMiddleware: Decoded JWT Payload:", decoded); // Log decoded payload

    // 2. Fetch the user from the database along with their role and permissions
    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({
      where: { userId: decoded.userId },
      relations: ["role", "role.permissions", "organizations"],
    });

    if (!user) {
      console.warn(
        `Invalid token: User ${decoded.userId} not found in database.`
      );
      res.status(401).json({
        success: false,
        message: "Invalid token: User not found in database.",
      });
      return;
    }

    // Build organizations array for req.user
    const organizations = (user.organizations || []).map(org => ({
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
    }));

    // Build roles array with permissions
    let userRoles: { roleName: string; permissions: string[] }[] = [];
    if (user.role) {
      userRoles.push({
        roleName: user.role.roleName,
        permissions: Array.isArray(user.role.permissions)
          ? user.role.permissions.map((p: any) => p.name)
          : [],
      });
    }

    // If user is ADMIN, log all permissions
    if (user.role && user.role.roleName === "ADMIN") {
      console.log("[AuthMiddleware] ADMIN role permissions:", userRoles[0].permissions);
    }

    // 4. Populate req.user with combined data
    // Use data from JWT for userId, email, username, organizations, organizationId
    // Use data from database for roles (with full details)
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      username: decoded.username,
      organizations,
      organizationId: decoded.organizationId,
      roles: userRoles,
    };

    console.log("AuthMiddleware: req.user populated with:", req.user); // Log final req.user for debugging

    next(); // Proceed to the next middleware or route handler
  } catch (err) {
    console.error("AuthMiddleware - JWT verification error:", err); // Log the actual error for debugging
    if (err instanceof jwt.TokenExpiredError) {
      res
        .status(401)
        .json({
          success: false,
          message: "Token expired. Please log in again.",
        });
    } else if (err instanceof jwt.JsonWebTokenError) {
      res
        .status(401)
        .json({
          success: false,
          message: "Invalid token. Please log in again.",
        });
    } else {
      res
        .status(500)
        .json({
          success: false,
          message: "Authentication failed due to server error.",
        });
    }
  }
};

// No changes needed for isAdmin if it uses req.user.userId and req.user.roles correctly.
// Since authenticate now populates req.user.roles correctly, isAdmin should work fine.
// (You'd likely adjust isAdmin to check permissions instead of just roleName string matching for more granularity)

/* Example DTO, just keeping it here for context as it's part of the original paste
class CancelTicketsDto {
    @IsArray({ message: 'idsToCancel must be an array' })
    @ArrayNotEmpty({ message: 'idsToCancel array cannot be empty' })
    @IsUUID('4', { each: true, message: 'Each ID in idsToCancel must be a valid UUID' })
    idsToCancel!: string[];
}
*/
