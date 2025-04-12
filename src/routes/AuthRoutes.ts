import { Router } from "express";

const router = Router();

router.post("/add");
router.get("/all");
router.get("/get/:id");
router.put("/update/:id");
router.delete("/delete/:id");
router.post("/loginWithOtp");
router.post("/create-password");
router.post("/login");
router.post("/logout");

export default router;
