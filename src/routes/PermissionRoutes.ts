import { Router } from "express";
import { PermissionController } from "../controller/PermissionController";
const router = Router();

router.get("/", PermissionController.getAll);

export default router;
