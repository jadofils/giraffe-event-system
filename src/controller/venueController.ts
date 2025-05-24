import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middlewares/AuthMiddleware";
import { VenueRepository } from "../repositories/venueRepository";

export class VenueController {
    // Create Venue
    static async create(req: AuthenticatedRequest, res: Response): Promise<void> {
        const { venueName, location, capacity } = req.body;
        const managerId = req.user?.userId;

        if (!venueName || !location || !capacity) {
            res.status(400).json({ success: false, message: "All fields are required." });
            return;
        }

        try {
            const createVenue = VenueRepository.create({
                venueName,
                location,
                capacity,
                managerId,
            });

            if (!createVenue.success) {
                res.status(400).json({ success: false, message: createVenue.message });
                return;
            }

            const saveVenue = await VenueRepository.save(createVenue.data!);
            if (saveVenue.success) {
                res.status(201).json({ success: true, message: "Venue created successfully", data: saveVenue.data });
            } else {
                res.status(400).json({ success: false, message: saveVenue.message });
            }
        } catch (err: any) {
            res.status(500).json({ success: false, message: "Failed to create venue." });
        }
    }

    // Get Venue by ID
    static async getById(req: Request, res: Response): Promise<void> {
        const { id } = req.params;
        if (!id) {
            res.status(400).json({ success: false, message: "Venue ID is required." });
            return;
        }

        try {
            const result = await VenueRepository.getById(id);
            if (result.success) {
                res.status(200).json({ success: true, data: result.data });
            } else {
                res.status(404).json({ success: false, message: result.message });
            }
        } catch (err: any) {
            res.status(500).json({ success: false, message: "Failed to fetch venue." });
        }
    }

    // Get Venue by Manager ID
    static async getByManagerId(req: AuthenticatedRequest, res: Response): Promise<void> {
        const managerId = req.user?.userId;
        if (!managerId) {
            res.status(400).json({ success: false, message: "Manager ID is required." });
            return;
        }

        try {
            const result = await VenueRepository.getByManagerId(managerId);
            if (result.success) {
                res.status(200).json({ success: true, data: result.data });
            } else {
                res.status(404).json({ success: false, message: result.message });
            }
        } catch (err: any) {
            res.status(500).json({ success: false, message: "Failed to fetch venue by manager ID." });
        }
    }

    // Get All Venues
    static async getAll(req: Request, res: Response): Promise<void> {
        try {
            const result = await VenueRepository.getAll();
            if (result.success) {
                res.status(200).json({ success: true, data: result.data });
            } else {
                res.status(500).json({ success: false, message: result.message });
            }
        } catch (err: any) {
            res.status(500).json({ success: false, message: "Failed to fetch venues." });
        }
    }

    // Update Venue
    static async update(req: AuthenticatedRequest, res: Response): Promise<void> {
        const { id } = req.params;
        const managerId = req.user?.userId;
        const { location, capacity, venueName, isAvailable, isBooked } = req.body;

        if (!id) {
            res.status(400).json({ success: false, message: "Venue ID is required." });
            return;
        }

        try {
            const updateResult = await VenueRepository.update(id, {
                location,
                capacity,
                venueName,
                isAvailable,
                isBooked,
                managerId,
            });

            if (updateResult.success) {
                res.status(200).json({ success: true, message: "Venue updated successfully", data: updateResult.data });
            } else {
                res.status(404).json({ success: false, message: updateResult.message });
            }
        } catch (err: any) {
            res.status(500).json({ success: false, message: "Failed to update venue." });
        }
    }


    static async updateVenueManager(req: AuthenticatedRequest, res: Response): Promise<void> {
        const { id } = req.params; // venueId
         // Extract managerId from request body
         const { managerId } = req.body;
        
        
        // Venue ID validation
        if (!id) {
           res.status(400).json({ success: false, message: 'Venue ID is required' });
           return;
        }
        
      
         if (!managerId) {
           res.status(400).json({ success: false, message: 'managerId is required in body' });
         }
     
      
      
        try {
         
         
          // Call repository method to update venue manager
          const result = await VenueRepository.updateVenueManager(id, managerId);
      
          // Handle success or failure response
          if (result.success) {
             res.status(200).json({
              success: true,
              message: 'Venue manager updated successfully',
              data: result.data,
            });
          } else {
             res.status(404).json({ success: false, message: result.message });
          }
        } catch (err: any) {
          res.status(500).json({ success: false, message: 'Failed to update venue manager' });
        }
      }
      
      
    

    //delete venue

    static async delete(req:Request, res:Response):Promise<void>{
        const {id}= req.params;
        if(!id){
            res.status(400).json({success: false, message:"venue Id is required"})
        }
        try{
            const deleteResult = await VenueRepository.delete(id);
            if(deleteResult.success){
                res.status(200).json({success: true, message:"venue deleted successfuly"})
            }
            else{
                res.status(404).json({success: false,message: deleteResult.message})
            }
        }catch(err: any){
            res.status(500).json({succcess: false, message: "failed to delete venue"})
        }
    }
}