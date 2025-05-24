import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middlewares/AuthMiddleware";
import { EventRepository } from "../repositories/eventRepository";
import { EventInterface } from "../interfaces/interface";

export class EventController {
    // Create Event
    static async create(req: AuthenticatedRequest, res: Response): Promise<void> {
        const { description, eventCategory, eventTitle, eventType, venueId } = req.body;
        const organizerId = req.user?.userId;
        console.log("Organizer ID:", organizerId);

        if (!description || !eventCategory || !eventTitle || !eventType || !venueId) {
            res.status(400).json({ success: false, message: "All fields are required." });
            return;
        }

        try {
            const createEvent = EventRepository.create({
                eventTitle,
                eventType,
                eventCategory,
                description,
                venueId,
                organizerId,
            } as Partial<EventInterface>); // Explicitly using EventInterface structure

            if (!createEvent.success) {
                res.status(400).json({ success: false, message: createEvent.message });
                return;
            }

            const saveEvent = await EventRepository.save(createEvent.data!);
            if (saveEvent.success) {
                res.status(201).json({ success: true, message: "Event created successfully.", data: saveEvent.data });
            } else {
                res.status(400).json({ success: false, message: saveEvent.message });
            }
        } catch (err: any) {
            res.status(500).json({ success: false, message: "Failed to save event." });
        }
    }


    //get Event ById

    static async getById(req:Request, res:Response):Promise<void>{
        const{id}= req.params;
        if(!id){
            res.status(400).json({success: false, message:"Event id not found"})
            return
        }
        try{
            const result = await EventRepository.getById(id);
            if(result.success){
                res.status(200).json({success: true,data:result.data})
            }
            else{
                res.status(404).json({success: true, message: result.message})
            }
        }
        catch(err:any){
            res.status(500).json({success: false, message:" failed to get event by id"})
        }
    }

    static async getByOrganizerId(req:AuthenticatedRequest, res:Response):Promise<void>{
        const organizerId = req.user?.userId;
        if(!organizerId){
            res.status(400).json({success: false, message:"Organizer Id is required"});
            return
        }
        try{
            const result = await EventRepository.getByOrganizerId(organizerId);
            if(result.success){
                res.status(200).json({success: true, Data: result.data})
            }
            else{
                res.status(404).json({success: false, message: result.message})
            }
        }
        catch(err:any){
            res.status(500).json({success: false, message: "failed to get event by OrganizerId"})
        }
    }

    static async getAll(req:Request, res:Response):Promise<void>{
        try{
            const result = await EventRepository.getAll()
            if(result.success){
                res.status(200).json({success: true, data: result.data});


            }
            else{
                res.status(404).json({success:false, message: result.message})
            }
        }
        catch(err:any){
            res.status(500).json({success: false,message:"failed to get all event"})
        }
    }

  static async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const organizerId = req.user?.userId;
    const { description, eventCategory, eventTitle, eventType, venueId } = req.body;

    if (!id) {
        res.status(400).json({ success: false, message: "Event ID is required." });
        return;
    }

    try {
        const updateEvent = await EventRepository.update(id, {
            description,
            eventCategory,
            eventTitle,
            eventType,
            venueId,
            organizerId, // Corrected camelCase naming
        });

        if (updateEvent.success) {
            res.status(200).json({ success: true, data: updateEvent.data });
        } else {
            res.status(404).json({ success: false, message: updateEvent.message });
        }
    } catch (err: any) {
        res.status(500).json({ success: false, message: "Failed to update event." });
    }
}


    static async delete(req:Request, res:Response):Promise<void>{
        const{id} = req.params;
        if(!id){
            res.status(400).json({success:false,message:"event id is required"});
            return
        }
        try{
            const deleteResult = await EventRepository.delete(id);
            if(deleteResult.succcess){
                res.status(200).json({success: true, message: "event deleted successfully"})
                return
            }
            else{
                res.status(404).json({success: false, message: deleteResult.message})
            }
        }
        catch(err:any){
            res.status(500).json({success: false, message: "failed to delete event"})
        }
    }
}