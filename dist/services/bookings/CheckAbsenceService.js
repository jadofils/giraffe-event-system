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
exports.CheckAbsenceService = void 0;
const Database_1 = require("../../config/Database");
const VenueAvailabilitySlot_1 = require("../../models/Venue Tables/VenueAvailabilitySlot");
const typeorm_1 = require("typeorm");
class CheckAbsenceService {
    static checkDateAvailability(venueId, date) {
        return __awaiter(this, void 0, void 0, function* () {
            const slotRepo = Database_1.AppDataSource.getRepository(VenueAvailabilitySlot_1.VenueAvailabilitySlot);
            const existingSlot = yield slotRepo.findOne({
                where: {
                    venueId,
                    Date: date,
                    status: (0, typeorm_1.Not)(VenueAvailabilitySlot_1.SlotStatus.AVAILABLE),
                },
            });
            return !existingSlot; // If no slot exists or slot is AVAILABLE, the date is available
        });
    }
    static checkHourAvailability(venueId, date, hour) {
        return __awaiter(this, void 0, void 0, function* () {
            const slotRepo = Database_1.AppDataSource.getRepository(VenueAvailabilitySlot_1.VenueAvailabilitySlot);
            const existingSlot = yield slotRepo.findOne({
                where: {
                    venueId,
                    Date: date,
                    status: (0, typeorm_1.Not)(VenueAvailabilitySlot_1.SlotStatus.AVAILABLE),
                    bookedHours: (0, typeorm_1.Raw)((alias) => `:hour = ANY(${alias})`, { hour }),
                },
            });
            return !existingSlot; // If no slot exists or slot is AVAILABLE, the hour is available
        });
    }
}
exports.CheckAbsenceService = CheckAbsenceService;
