// src/controller/UserController.ts
import { Request, Response } from 'express';
import { UserRepository } from '../repositories/UserRepository';
import { AppDataSource } from '../config/Database';
import { User } from '../models/User';
import { Organization } from '../models/Organization';
import { OrganizationUser } from '../models/OrganizationUser';

export class UserController {
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const { username, firstName, lastName, email, phoneNumber, password, organizationId } = req.body;
      console.log('Registering user with data in controller:', req.body);

      // === Validation Checks ===
      if (!username || username.length < 3 || username.length > 50) {
        res.status(400).json({ success: false, message: 'Username must be between 3 and 50 characters' });
        return;
      }

      if (!firstName || firstName.length < 1 || firstName.length > 50) {
        res.status(400).json({ success: false, message: 'First name must be between 1 and 50 characters' });
        return;
      }

      if (!lastName || lastName.length < 1 || lastName.length > 50) {
        res.status(400).json({ success: false, message: 'Last name must be between 1 and 50 characters' });
        return;
      }

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        res.status(400).json({ success: false, message: 'Email must be a valid email address' });
        return;
      }

      if (!password || typeof password !== 'string' || password.length < 8 || password.length > 20) {
        res.status(400).json({ success: false, message: 'Password must be between 8 and 20 characters and a string' });
        return;
      }

      if (!organizationId) {
        res.status(400).json({ success: false, message: 'Organization ID is required' });
        return;
      }

      const existingUser = await UserRepository.findExistingUser(email, username);
      if (existingUser) {
        res.status(400).json({ success: false, message: 'User already exists' });
        return;
      }

      // === Check if the organization exists ===
      const orgRepo = AppDataSource.getRepository(Organization);
      const organization = await orgRepo.findOne({ where: { organizationId: organizationId } });

      if (!organization) {
        res.status(404).json({ success: false, message: 'Organization not found' });
        return;
      }

      // === Create & Save User ===
      const user = UserRepository.createUser({
        Username: username,
        FirstName: firstName,
        LastName: lastName,
        Email: email,
        PhoneNumber: phoneNumber,
        Password: password,
      });

      const result = await UserRepository.saveUser(user);

      if (!result.success || !result.user) {
        res.status(400).json({ success: false, message: result.message });
        return;
      }

      const savedUser = result.user;

      // === Link User to Organization ===
      const orgUserRepo = AppDataSource.getRepository(OrganizationUser);
      const orgUser = new OrganizationUser();
      orgUser.userId = savedUser.userId;  // Set userId in the join table
      orgUser.organizationId = organization.organizationId;  // Set organizationId in the join table

      await orgUserRepo.save(orgUser);

      const userRoles = savedUser.roles?.map(role => ({
        id: role.roleId,
        name: role.roleName,
        description: role.description,
      })) || [];

      res.status(201).json({
        success: true,
        message: 'User registered and linked to organization successfully',
        user: {
          id: savedUser.userId,
          username: savedUser.username,
          email: savedUser.email,
          firstName: savedUser.firstName,
          lastName: savedUser.lastName,
          phoneNumber: savedUser.phoneNumber,
          roles: userRoles,
          organization: {
            id: organization.organizationId,
            name: organization.organizationName
          }
        }
      });

    } catch (error) {
      console.error('Error in register:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }


  static async login(req: Request, res: Response): Promise<void> {
    res.status(200).json({ success: true, message: 'Login successful' });
  }

  static async forgotPassword(req: Request, res: Response): Promise<void> {
    res.status(200).json({ success: true, message: 'Password reset instructions sent' });
  }

  static async resetPassword(req: Request, res: Response): Promise<void> {
    res.status(200).json({ success: true, message: 'Password reset successful' });
  }

  static async getProfile(req: Request, res: Response): Promise<void> {
    res.status(200).json({ success: true, message: 'User profile retrieved' });
  }

  static async updateProfile(req: Request, res: Response): Promise<void> {
    res.status(200).json({ success: true, message: 'Profile updated successfully' });
  }

  static async getAllUsers(req: Request, res: Response): Promise<void> {
    try {
      const users = await UserRepository.getAllUsers();
      res.status(200).json({ success: true, users });
    } catch (error) {
      console.error('Error in getAllUsers:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  static async getUserById(req: Request, res: Response): Promise<void> {
    try {
      const user = await UserRepository.getUserById(req.params.id);
      if (!user) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
      }
      res.status(200).json({ success: true, user });
    } catch (error) {
      console.error('Error in getUserById:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
  static async updateUser(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.params.id;
      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOneBy({ userId });
  
      if (!user) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
      }
  
      const { username, firstName, lastName, email, phoneNumber } = req.body;
  
      // Update user fields if they exist in the request
      if (username) user.username = username;
      if (firstName) user.firstName = firstName;
      if (lastName) user.lastName = lastName;
      if (email) user.email = email;
      if (phoneNumber) user.phoneNumber = phoneNumber;
  
      const updatedUser = await userRepository.save(user);
  
      res.status(200).json({
        success: true,
        message: 'User updated successfully',
        user: {
          userId: updatedUser.userId,
          username: updatedUser.username,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          email: updatedUser.email,
          phoneNumber: updatedUser.phoneNumber,
        },
      });
    } catch (error) {
      console.error('Error in updateUser:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
  

  static async deleteUser(req: Request, res: Response): Promise<void> {
    res.status(200).json({ success: true, message: 'User deleted successfully' });
  }
}
