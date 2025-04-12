import { Router } from "express";

const router = Router();

router.get("/all");
router.get("/get/:id");
router.post("/make");
router.put("/update/:id");
router.delete("/delete/:id");

export default router;
