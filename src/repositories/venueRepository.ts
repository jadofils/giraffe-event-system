import { AppDataSource } from "../config/Database";
import { VenueInterface } from "../interfaces/interface";
import { User } from "../models/User";
import { Venue } from "../models/Venue";

export class VenueRepository {
    // Create venue
    static create(data: Partial<VenueInterface>): { success: boolean; data?: Venue; message?: string } {
        if (!data.capacity || !data.location || !data.venueName) {
            return { success: false, message: "All fields are required" };
        }

        const venue = new Venue();
        venue.venueName = data.venueName ?? "";
        venue.isBooked = data.isBooked ?? false;
        venue.capacity = data.capacity ?? 0;
        venue.isAvailable = data.isAvailable ?? true;
        venue.location = data.location ?? "";
        venue.managerId = data.managerId ?? "";

        return { success: true, data: venue };
    }

    // Save venue
    static async save(venue: Venue): Promise<{ success: boolean; data?: Venue; message?: string }> {
        if (!venue.capacity || !venue.venueName || !venue.location) {
            return { success: false, message: "All fields are required" };
        }

        try {
            // Check if venue already exists
            const existingVenue = await AppDataSource.getRepository(Venue).findOne({
                where: [{ venueName: venue.venueName, location: venue.location }],
            });

            if (existingVenue) {
                return { success: false, message: "Venue location and name already exist", data: existingVenue };
            }

            // Save the new venue
            const savedVenue = await AppDataSource.getRepository(Venue).save(venue);
            return { success: true, data: savedVenue, message: "Venue saved successfully" };
        } catch (error) {
            console.error("Error saving venue:", error);
            return { success: false, message: "Failed to save venue" };
        }
    }

    // Get venue by ID
    static async getById(id: string): Promise<{ success: boolean; data?: Venue; message?: string }> {
        if (!id) {
            return { success: false, message: "Venue ID is required" };
        }

        try {
            const venue = await AppDataSource.getRepository(Venue).findOne({
                where: { venueId: id },
                relations: ["manager", "manager.role"],
            });

            if (!venue) {
                return { success: false, message: "Venue not found" };
            }

            return { success: true, data: venue };
        } catch (error) {
            return { success: false, message: "Failed to fetch venue by ID" };
        }
    }

    // Get all venues
    static async getAll(): Promise<{ success: boolean; data?: Venue[]; message?: string }> {
        try {
            const venues = await AppDataSource.getRepository(Venue).find({
                relations: ["manager", "manager.role"],
            });
            return { success: true, data: venues };
        } catch (error) {
            return { success: false, message: "Failed to fetch all venues" };
        }
    }

    // Get venue by manager ID
    static async getByManagerId(managerId: string): Promise<{ success: boolean; data?: Venue[]; message?: string }> {
        if (!managerId) {
            return { success: false, message: "Manager ID is required" };
        }

        try {
            const venues = await AppDataSource.getRepository(Venue).find({
                where: { manager: { userId: managerId } }, // Ensure correct relation mapping
                relations: ["manager", "manager.role"],
            });

            if (venues.length === 0) {
                return { success: false, message: "No venues found for this manager" };
            }

            return { success: true, data: venues };
        } catch (error) {
            return { success: false, message: "Failed to fetch venues by manager ID" };
        }
    }

    // Update venue
    static async update(
        id: string,
        data: Partial<VenueInterface>
    ): Promise<{ success: boolean; data?: Venue; message?: string }> {
        if (!id) {
            return { success: false, message: "Venue ID is required" };
        }

        try {
            const repo = AppDataSource.getRepository(Venue);
            const venue = await repo.findOne({ where: { venueId: id } });

            if (!venue) {
                return { success: false, message: "Venue not found" };
            }

            repo.merge(venue, {
                venueName: data.venueName ?? venue.venueName,
                location: data.location ?? venue.location,
                capacity: data.capacity ?? venue.capacity,
                isAvailable: data.isAvailable ?? venue.isAvailable,
                isBooked: data.isBooked ?? venue.isBooked,
            });

            const updatedVenue = await repo.save(venue);
            return { success: true, data: updatedVenue };
        } catch (error) {
            return { success: false, message: "Failed to update venue" };
        }
    }

    // Update venue manager
    static async updateVenueManager(
        venueId: string,
        managerId: string
    ): Promise<{ success: boolean; data?: Venue; message?: string }> {
        if (!venueId || !managerId) {
            return { success: false, message: "Both venueId and managerId are required" };
        }

        try {
            const venueRepo = AppDataSource.getRepository(Venue);
            const userRepo = AppDataSource.getRepository(User);

            const venue = await venueRepo.findOne({ where: { venueId }, relations: ["manager"] });

            if (!venue) {
                return { success: false, message: "Venue not found" };
            }

            const manager = await userRepo.findOne({ where: { userId: managerId }, relations: ["role"] });

            if (!manager) {
                return { success: false, message: "Manager user not found" };
            }

            if (manager.role.roleName.toLowerCase() !== "venue_manager") {
                return { success: false, message: "User is not a venue manager" };
            }

            // Assign new manager
            venue.manager = manager;
            venue.managerId = manager.userId;

            const updatedVenue = await venueRepo.save(venue);
            return { success: true, data: updatedVenue };
        } catch (error) {
            return { success: false, message: "Failed to update venue manager" };
        }
    }

    // Delete venue
    static async delete(id: string): Promise<{ success: boolean; message?: string }> {
        if (!id) {
            return { success: false, message: "Venue ID is required" };
        }

        try {
            const result = await AppDataSource.getRepository(Venue).delete(id);

            if (result.affected === 0) {
                return { success: false, message: "Venue not found or already deleted" };
            }

            return { success: true, message: "Venue deleted successfully" };
        } catch (error) {
            return { success: false, message: "Failed to delete venue" };
        }
    }
}
