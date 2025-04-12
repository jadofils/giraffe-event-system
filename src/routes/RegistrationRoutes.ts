import { Router } from "express";

const router = Router();

router.get("/all");
router.get("/get/:id");
router.post("/create");
router.put("/edit/:id");
router.delete("/cancel/:id");

export default router;
