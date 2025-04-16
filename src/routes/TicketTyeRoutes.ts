import { Router } from "express";
import { TicketTypeController } from "../controller/TicketTypeController";

const router = Router();
const ticketTypeController = new TicketTypeController();

router.post("/", ticketTypeController.createTicketType.bind(ticketTypeController));
router.get("/", ticketTypeController.getAllTicketTypes.bind(ticketTypeController));
router.get("/:ticketTypeId", ticketTypeController.getTicketTypeById.bind(ticketTypeController));
router.put("/:ticketTypeId", ticketTypeController.updateTicketType.bind(ticketTypeController));
router.delete("/:ticketTypeId", ticketTypeController.deleteTicketType.bind(ticketTypeController));

export default router;
