"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/ticketTypeRoutes.ts
const express_1 = require("express");
const TicketTypeController_1 = require("../controller/TicketTypeController");
const router = (0, express_1.Router)();
// POST /api/ticket-types
router.post("/", (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield TicketTypeController_1.TicketTypeController.createTicketType(req, res);
    }
    catch (err) {
        next(err);
    }
}));
// GET /api/ticket-types
router.get("/", (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield TicketTypeController_1.TicketTypeController.getAllTicketTypes(req, res);
    }
    catch (err) {
        next(err);
    }
}));
// GET /api/ticket-types/:ticketTypeId
router.get("/:ticketTypeId", (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield TicketTypeController_1.TicketTypeController.getTicketTypeById(req, res);
    }
    catch (err) {
        next(err);
    }
}));
// PUT /api/ticket-types/:ticketTypeId
router.put("/:ticketTypeId", (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield TicketTypeController_1.TicketTypeController.updateTicketType(req, res);
    }
    catch (err) {
        next(err);
    }
}));
// DELETE /api/ticket-types/:ticketTypeId
router.delete("/:ticketTypeId", (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield TicketTypeController_1.TicketTypeController.deleteTicketType(req, res);
    }
    catch (err) {
        next(err);
    }
}));
exports.default = router;
