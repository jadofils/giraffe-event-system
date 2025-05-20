import { AppDataSource } from "../config/Database";
import { EventBookingInterface, EventInterface } from "../interfaces/interface";
import { Event, EventType } from "../models/Event";



export class EventRepository{
    static createBooking(arg0: EventBookingInterface) {
        throw new Error('Method not implemented.');
    }
    static createEvent(eventData: any) {
        throw new Error("Method not implemented.");
    }

    //create event
    static create(data:Partial<EventInterface>):{success:boolean; data?:Event; message?:string}{
        if(!data.Description || !data.EventCategory || !data.EventTitle || !data.EventType || !data.VenueId  || !data.OrganizerId){
            return {success : false, message:"all Field are required"}
        }
        

         // Map EventType string to enum
    const eventTypeMap: Record<string, EventType> = {
        public: EventType.PUBLIC,
        private: EventType.PRIVATE,
      };
  
      const mappedEventType = eventTypeMap[data.EventType];
      if (!mappedEventType) {
        return { success: false, message: "Invalid event type" };
      }
  
      // Create and populate the event
      const event = new Event();
      event.description = data.Description;
      event.eventCategory = data.EventCategory;
      event.eventTitle = data.EventTitle;
      event.eventType = mappedEventType;
      event.venueId = data.VenueId;
      event.organizerId = data.OrganizerId;
      
  
      return { success: true, data: event };
        
    }

    //save event

    static async save(event: Event):Promise<{success: boolean; data?: Event; message?:string}>{
        if(!event.description || !event.eventCategory || !event.eventTitle || !event.eventType || !event.venueId  || !event.organizerId){
            return {success : false, message:"all Field are required"}
        }
        try{
            //save event
            const savedEvent = await AppDataSource.getRepository(Event).save(event);
            return{success: true, data:savedEvent, message:"Eventsaved successfully"};
        }catch(error){
             console.error("Error saving event:", error); 
            return{success:false, message:"failed to  save this event"}
        }

       

    }

    // get event by Id
    static async getById(id: string):Promise<{success: boolean; data?: Event; message?: string}>{
        if(!id){
            return{success: false, message:"Event Id is required"}
        }
        try{
            const event =  await AppDataSource.getRepository(Event).findOne({where: {eventId:id},
            relations:['organizer', 'organizer.role', 'venue']})

            if(!event){
                return{success: false, message:"event not found"}
            }
            return{success: true, data:event}
        }catch(error){
            return{success: false, message:"failed to get event by Id"}
        }

    }

    //get event by organizerId
    static async getByOrganizerId(organizerId: string):Promise<{success: boolean; data?: Event[]; message?: string}>{
        if(!organizerId){
            return{success: false, message:" organizer id is required"}
        }

        try{
            const events = await AppDataSource.getRepository(Event).find({ where:{organizer:{
                userId: organizerId
            },}, relations: ['organizer', 'organizer.role', 'venue'],})

            if( events.length === 0){
                return{success: false, message :"no event found for this organizer"}
            }

            return{success: true, data:events };
        } catch(error){
            return{success: false, message:"failed to fetch event by organizerId"}
        }
    }

    // get all event

    static async getAll():Promise<{success: boolean; data?: Event[]; message?:string}>{
        try{
            const event = await AppDataSource.getRepository(Event).find({
                relations:['organizer', 'organizer.role', 'venue']
            })

            return {success: true, data:event}
        }
        catch(error){
            return {success: false , message: "failed to get all event"}
        }
    }

    //update event
    static async update(id: string, data: Partial<EventInterface>):Promise<{success: boolean; data?:Event; message?:string}>{
        if(!id){
            return{success:false, message:"event id is required"}

        }
        try{
            const repo =  AppDataSource.getRepository(Event);
            const event = await repo. findOne({where:{eventId:id}});
            if(!event){
                return {success: false, message: "event not found"}
            }

            let updatedEventType = event.eventType;
            if (data.EventType && (data.EventType === "public" || data.EventType === "private")) {
              updatedEventType = data.EventType as EventType;
            }

            repo.merge(event,{
                description:data.Description??event.description,
                eventTitle:data.EventTitle?? event.eventTitle,
                eventCategory: data.EventCategory?? event.eventCategory,
                venueId: data.VenueId?? event.venueId,
                
                organizerId:data.OrganizerId??event.organizerId,
                eventType: updatedEventType,
                

            })

            const updateEvent =  await repo.save(event);
            return{success: true, data: updateEvent}
        }catch(error){
            return{success: false, message: "failed to update event"}
        }
    }

    //update event orginizer


    //delete event
    static async delete (id:string):Promise<{succcess: boolean; data?:Event; message?: string}>{
        if(!id){
            return{succcess: false,message:" Event Id is required"  }
        }try{
            const result = await AppDataSource.getRepository(Event).delete(id);
            if(result.affected === 0){
                return{succcess: false, message:"event not found ar alredy deleted"}
            }
            return{succcess: true, message:"venue deleted successfully"}
        }
        catch(error){
            return{succcess: false, message:"failed to delete event"}
        }


    
   }
}