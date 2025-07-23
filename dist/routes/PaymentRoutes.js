"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const PaymentController_1 = require("../controller/PaymentController");
const router = (0, express_1.Router)();
const paymentController = new PaymentController_1.PaymentController();
// Get a payment by ID
router.get('/:paymentId', (req, res) => paymentController.getPayment(req, res));
exports.default = router;
