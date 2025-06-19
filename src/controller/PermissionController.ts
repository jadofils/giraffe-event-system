import { Request, Response } from "express";
import { AppDataSource } from "../config/Database";
import { Permission } from "../models/Permission";

export class PermissionController {
  static async getAll(req: Request, res: Response): Promise<void> {
    try {
      const permissionRepo = AppDataSource.getRepository(Permission);
      const permissions = await permissionRepo.find();
      res.status(200).json({ success: true, permissions });
    } catch (error) {
      console.error("Error fetching permissions:", error);
      res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  }
}
