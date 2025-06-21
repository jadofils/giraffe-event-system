"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const PaymentController_1 = require("../controller/PaymentController");
const router = (0, express_1.Router)();
const paymentController = new PaymentController_1.PaymentController();
// Get a payment by ID
router.get('/:paymentId', (req, res) => paymentController.getPayment(req, res));
// Create a new payment
router.post('/', (req, res) => paymentController.createPayment(req, res));
// Get payments by status
router.get('/status/:status', (req, res) => paymentController.getPaymentsByStatus(req, res));
// Create an installment plan
router.post('/installment-plans', (req, res) => paymentController.createInstallmentPlan(req, res));
// (Optional) Get all payments (if you implemented getAllPayments in your controller/service)
if (typeof paymentController.getAllPayments === 'function') {
    router.get('/', (req, res) => paymentController.getAllPayments(req, res));
}
exports.default = router;
