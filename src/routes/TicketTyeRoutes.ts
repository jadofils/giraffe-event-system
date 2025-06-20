import { Router } from "express";
import { TicketTypeController } from "../controller/TicketTypeController";
import { authenticate } from "../middlewares/AuthMiddleware"; // make sure this is imported

const router = Router();

// =======================
// 📂 Public Ticket Type Routes
// =======================
// (If you want any public routes like viewing ticket types, put them here)


// =======================
// 🔒 Protected Ticket Type Routes
// =======================
router.use(authenticate);

// POST /api/ticket-types
router.post("/", async (req, res, next) => {
  try {
    await TicketTypeController.createTicketType(req, res);
  } catch (err) {
    next(err);
  }
});

// GET /api/ticket-types
router.get("/", async (req, res, next) => {
  try {
    await TicketTypeController.getAllTicketTypes(req, res);
  } catch (err) {
    next(err);
  }
});

// GET /api/ticket-types/:ticketTypeId
router.get("/:ticketTypeId", async (req, res, next) => {
  try {
    await TicketTypeController.getTicketTypeById(req, res);
  } catch (err) {
    next(err);
  }
});

// PUT /api/ticket-types/:ticketTypeId
router.put("/:ticketTypeId", async (req, res, next) => {
  try {
    await TicketTypeController.updateTicketType(req, res);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/ticket-types/:ticketTypeId
router.delete("/:ticketTypeId", async (req, res, next) => {
  try {
    await TicketTypeController.deleteTicketType(req, res);
  } catch (err) {
    next(err);
  }
});

export default router;
