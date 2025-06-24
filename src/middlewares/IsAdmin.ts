import { Request, Response, NextFunction } from 'express';
import { isAuthenticatedRequest } from './AuthMiddleware';

/**
 * Middleware to check if the authenticated user has 'admin' privileges.
 * It relies on the 'isAdmin' flag populated by the `authenticate` middleware.
 *
 * @param req The Express request object, extended with AuthenticatedRequest type.
 * @param res The Express response object.
 * @param next The Express next middleware function.
 */
export const isAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        // Ensure the request object has the 'user' property populated by the authenticate middleware
        if (!isAuthenticatedRequest(req)) {
            console.warn("isAdmin middleware called before authenticate or req.user is missing.");
            res.status(401).json({ message: 'Unauthorized: User authentication required.' });
            return;
        }

        // Direct check using the isAdmin flag populated by the authentication middleware
        if (req.user.isAdmin) {
            console.log(`[Authorization] User ${req.user.userId} is an admin. Granting access.`);
            return next(); // User is an admin, proceed to the next middleware/route handler
        }

        // If the isAdmin flag is false or not explicitly true, deny access
        console.warn(`[Authorization] User ${req.user.userId} is not an admin. Access denied.`);
        res.status(403).json({ message: 'Forbidden: Admins only' });

    } catch (error) {
        console.error("Error in isAdmin middleware:", error);
        res.status(500).json({ message: 'Server Error', error: (error instanceof Error ? error.message : "Unknown error") });
    }
};

