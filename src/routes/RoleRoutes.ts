import { Router } from "express";
import { RoleController } from "../controller/RoleController";
import { authenticate } from "../middlewares/AuthMiddleware"; // Make sure this is imported

const router = Router();

// =======================
// 🔒 Protected Role Management Routes
// =======================
router.use(authenticate);

router.post("/", RoleController.create);
router.get("/", RoleController.getAll);
router.get("/:id", RoleController.getById);
router.put("/:id", RoleController.update);
router.delete("/:id", RoleController.deleteById);
router.post("/search-by-name", RoleController.getRolesByName);



export default router;
