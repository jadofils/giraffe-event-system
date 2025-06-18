import { Router } from "express";
import { LoginController } from "../controller/user/Login";

const router = Router();

router.post("/add", (req, res) => {
  res.status(501).json({ message: "Not implemented" });
});

router.get("/all", (req, res) => {
  res.status(501).json({ message: "Not implemented" });
});

router.get("/get/:id", (req, res) => {
  res.status(501).json({ message: "Not implemented" });
});

router.put("/update/:id", (req, res) => {
  res.status(501).json({ message: "Not implemented" });
});

router.delete("/delete/:id", (req, res) => {
  res.status(501).json({ message: "Not implemented" });
});

router.post("/loginWithOtp", (req, res) => {
  res.status(501).json({ message: "Not implemented" });
});

router.post("/create-password", (req, res) => {
  res.status(501).json({ message: "Not implemented" });
});

router.post("/login", LoginController.login);
router.post("/login/default", LoginController.loginWithDefaultPassword);

router.post("/logout", (req, res) => {
  res.status(501).json({ message: "Not implemented" });
});

export default router;
