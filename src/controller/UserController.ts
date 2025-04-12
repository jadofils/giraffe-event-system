import { Request, Response } from 'express';
import { UserRepository } from '../repositories/UserRepository';
import { validate } from 'class-validator';

export class UserController {
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const { username, firstName, lastName, email, phoneNumber } = req.body;

      // Check if user already exists
      const existingUser = await UserRepository.findExistingUser(email, username);
      if (existingUser) {
        res.status(400).json({ message: 'User already exists' });
        return;
      }

      // Create new user
      const user = UserRepository.createUser({
        Username: username,
        FirstName: firstName,
        LastName: lastName,
        Email: email,
        PhoneNumber: phoneNumber,
      });

      // Validate user data
      const errors = await validate(user);
      if (errors.length > 0) {
        res.status(400).json({ errors });
        return;
      }

      // Save user
      await UserRepository.saveUser(user);

      res.status(201).json({
        message: 'User created successfully',
        user: {
          id: user.userId,
          username: user.username,
          email: user.email,
        },
      });
    } catch (error) {
      console.error('Error in register:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }




  static async login(req: Request, res: Response): Promise<void> {
    res.status(200).json({ message: 'Login successful' });
  }


  
  static async forgotPassword(req: Request, res: Response): Promise<void> {
    res.status(200).json({ message: 'Password reset instructions sent' });
  }

  static async resetPassword(req: Request, res: Response): Promise<void> {
    res.status(200).json({ message: 'Password reset successful' });
  }

  static async getProfile(req: Request, res: Response): Promise<void> {
    res.status(200).json({ message: 'User profile retrieved' });
  }

  static async updateProfile(req: Request, res: Response): Promise<void> {
    res.status(200).json({ message: 'Profile updated successfully' });
  }

  static async getAllUsers(req: Request, res: Response): Promise<void> {
    try {
      const users = await UserRepository.getAllUsers();
      res.status(200).json(users);
    } catch (error) {
      console.error('Error in getAllUsers:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  static async getUserById(req: Request, res: Response): Promise<void> {
    try {
      const user = await UserRepository.getUserById(req.params.id);
      if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
      }
      res.status(200).json(user);
    } catch (error) {
      console.error('Error in getUserById:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  static async updateUser(req: Request, res: Response): Promise<void> {
    res.status(200).json({ message: 'User updated successfully' });
  }

  static async deleteUser(req: Request, res: Response): Promise<void> {
    res.status(200).json({ message: 'User deleted successfully' });
  }
}
