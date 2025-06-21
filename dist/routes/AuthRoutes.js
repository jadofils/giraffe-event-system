"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Login_1 = require("../controller/user/Login");
const router = (0, express_1.Router)();
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
router.post("/login", Login_1.LoginController.login);
router.post("/login/default", Login_1.LoginController.loginWithDefaultPassword);
router.post("/logout", (req, res) => {
    res.status(501).json({ message: "Not implemented" });
});
exports.default = router;
