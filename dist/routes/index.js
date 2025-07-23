"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/apiRoutes.ts
const express_1 = __importStar(require("express"));
const path_1 = __importDefault(require("path"));
// Swagger UI setup
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const yamljs_1 = __importDefault(require("yamljs"));
const UserRoutes_1 = require("./UserRoutes");
const RoleRoutes_1 = __importDefault(require("./RoleRoutes"));
const OrganizationRoutes_1 = require("./OrganizationRoutes");
// import tickets from "./TicketTyeRoutes"; // Ensure tickets is exported from TicketType
const ResourceRoutes_1 = __importDefault(require("./ResourceRoutes")); // Ensure resourceRoutes is exported from ResourceRoutes
// import RegistrationRoutes from "./RegistrationRoutes"; // Ensure RegistrationRoutes is exported from RegistrationRoutes
// import VenueBookingRoutes from "./VenueBookingRoutes";
const InvoiceRoutes_1 = __importDefault(require("./InvoiceRoutes"));
const EventRoutes_1 = __importDefault(require("./EventRoutes"));
const PermissionRoutes_1 = __importDefault(require("./PermissionRoutes"));
const VenueRoutes_1 = require("./VenueRoutes");
const VenueBookingRoutes_1 = __importDefault(require("./VenueBookingRoutes"));
// import RegistrationRoutes from "./RegistrationRoutes";
const router = (0, express_1.Router)();
router.use("/static", express_1.default.static(path_1.default.join(__dirname, "..", "..", "uploads"))); // Adjust path as needed
// Use versioned routes
router.use("/users", UserRoutes_1.userRoutes);
router.use("/roles", RoleRoutes_1.default);
router.use("/organizations", OrganizationRoutes_1.organizationRoutes); // This makes `/api/v1/organizations/*` available
// router.use("/tickets", tickets); // This makes `/api/v1/tickets-type/*` available
// router.use("/registrations",RegistrationRoutes)
//resources
router.use("/resources", ResourceRoutes_1.default);
router.use("/venue", VenueRoutes_1.venueRoute); // This makes `/api/v1/venue/*` available
router.use("/event", EventRoutes_1.default);
router.use("/venue-bookings", VenueBookingRoutes_1.default);
// Event Booking routes
// router.use("/venue-bookings", VenueBookingRoutes); // This makes `/api/v1/event-bookings/*` available
//routes for registration
// router.use("/registrations", RegistrationRoutes); // This makes `/api/v1/registrations/*` available
router.use("/invoices", InvoiceRoutes_1.default);
//endpoints of the payments
// Add PermissionRoutes
router.use("/permissions", PermissionRoutes_1.default);
const swaggerDocument = yamljs_1.default.load(path_1.default.join(__dirname, "../config/Swagger.yaml"));
// Add Swagger UI
router.use("/api-docs", swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swaggerDocument));
router.use("/giraffe-space/swagger-docs", swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swaggerDocument));
exports.default = router;
