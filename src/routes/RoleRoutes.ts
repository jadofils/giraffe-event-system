import { Router } from "express";
import { RoleController } from "../controller/RoleController"; // Corrected import path for RoleController from "../controller/RoleController";
const router = Router();

router.post("/", RoleController.create);
router.get("/", RoleController.getAll);
router.get("/:id", RoleController.getById);
router.put("/:id", RoleController.update);
router.delete("/:id", RoleController.deleteById);

export default router;