import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './AuthMiddleware';
import { AppDataSource } from '../config/Database';
import { User } from '../models/User';

export const isAdmin = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
  isAdmin: boolean = false
): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized: No user ID found' });
      return;
    }

    const userRepository = AppDataSource.getRepository(User);

    const user = await userRepository.findOne({
      where: { userId },
      relations: ['role'],
    });

    if (!user || user.role.roleName.toLowerCase() !== 'admin') {
      res.status(403).json({ message: 'Forbidden: Admins only' });
      return;
    }
         // proceed if admin
    if (isAdmin) {
      return next();
    }
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: (error as Error).message });
  }
};
