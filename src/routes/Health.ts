import { Router } from "express";

const router = Router();

router.get("/status", (req, res) => {
  res.status(200).json({ message: "Health check" });
});

const healthRoutes = router;
export default healthRoutes;
