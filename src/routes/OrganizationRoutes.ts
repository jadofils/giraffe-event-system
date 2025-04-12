import { Router } from "express";

const router = Router();

router.get("/all");
router.get("/get/:id");
router.post("/register");
router.put("/update/:id");
router.delete("/remove/:id");

export default router;
