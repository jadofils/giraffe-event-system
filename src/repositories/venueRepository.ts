import { AppDataSource } from "../config/Database";
import { VenueInterface } from "../interfaces/interface";
import { User } from "../models/User";
import { Venue } from "../models/Venue";

export class VenueRepository{

    //create venue

    static create(data:Partial<VenueInterface>):{success: boolean; data?:Venue, message?: string}{

        
        if(!data.Capacity || !data.Location || !data.VenueName){
            return {success: false, message: 'all field are required'}  
        }
        const venue = new Venue();
        venue.venueName = data.VenueName?? '';
        venue.isBooked = data.IsBooked?? false;
        venue.capacity = data.Capacity?? '';
        venue.isAvailable = data.IsAvailable?? true;
        venue.location = data.Location?? '';
        venue.managerId = data.ManagerId??'';

        return{ success : true, data: venue};
        

    }

    // save venue

    static async save( venue: Venue):Promise<{success: boolean; data?:Venue; message?: string}>{
        if(!venue.capacity || !venue.venueName || !venue.location){
            return {success: false, message: " all field are required"}
        }
        try{
            //check if venue already exist
            const  existingVenue =  await AppDataSource.getRepository(Venue).findOne({
                where:[
                    {venueName: venue.venueName,
                    location: venue.location}
                ],
            });
            if(existingVenue){
                return{ success : false, message:"venue location and name already exist",data: existingVenue};
            }

            // save the new venue
            const savedVenue =  await AppDataSource.getRepository(Venue).save(venue);
            return {success: true, data:savedVenue, message:"Venue saved successfully"};

        }
        catch(error){
            console.log(" error saving venue",error);
            return{success: false, message:"failed to save venue"}
        }
    }


   
    static async getById(id: string):Promise<{success: boolean;data?:Venue;message?:string}>{
        if(!id){
            return{success : false, message:"Venue Id is required"}

        }try{
            const venue =await AppDataSource.getRepository(Venue).findOne({where:{venueId:id},
                relations: ['manager', 'manager.role'],
                 })
            if(!venue){
                return{success: false,message:'Venue not found'}
            }
            return {success: true,data: venue}

        }catch(error){
            return{success: false,message: 'failed to fetch venue by Id'}
        }
    }


    // get all venue

    static async getAll():Promise<{success: boolean; data?: Venue[], message?: string}>{
        try{
            const venue = await AppDataSource.getRepository(Venue).find({
                relations: ['manager', 'manager.role'],
            })
            return {success: true, data: venue}

        }catch(error){
            return{success: false, message: "faild to get all venue"}
        }
    }


    //get venue by manager Id
    static async getByManagerId(managerId: string): Promise<{ success: boolean; data?: Venue[]; message?: string }> {
        if (!managerId) {
            return { success: false, message: "Manager ID is required" };
        }
    
        try {
            const venues = await AppDataSource.getRepository(Venue).find({
                where: {
                    manager: {
                        userId: managerId, // or 'id' depending on your User entity
                    },
                },
                relations: ['manager', 'manager.role'], // updated to match relation name
            });
    
            if (venues.length === 0) {
                return { success: false, message: "No venues found for this manager" };
            }
    
            return { success: true, data: venues };
        } catch (error) {
            return { success: false, message: "Failed to fetch venues by manager ID" };
        }
    }
    
    


    //update venue

    static async update( id: string, data:Partial<VenueInterface>):Promise<{success: boolean; data?:Venue; message?: string}>{
        if(!id){
            return {success: false, message: "venue Id is required"}
        }
        try{
            const repo = AppDataSource.getRepository(Venue);
            const venue = await repo.findOne({where:{venueId:id}});
            if(!venue){
                return{success:false, message:"venue not found"}
            }
            repo.merge(venue,{
                venueName:data.VenueName??venue.venueName,
                location:data.Location??venue.location,
                capacity:data.Capacity??venue.capacity,
                isAvailable:data.IsAvailable??venue.isAvailable,
                isBooked:data.IsBooked??venue.isBooked
            })
            const updateVenue= await repo.save(venue);
            return{success: true, data: updateVenue}
        }catch(error){
            return{success: false, message: "failed to update venue"}
        }
    }

    //update venue manager

    static async updateVenueManager(
        venueId: string,
        managerId: string
      ): Promise<{ success: boolean; data?: Venue; message?: string }> {
        if (!venueId || !managerId) {
          return { success: false, message: 'Both venueId and managerId are required' };
        }
      
        try {
          const venueRepo = AppDataSource.getRepository(Venue);
          const userRepo = AppDataSource.getRepository(User);
      
          const venue = await venueRepo.findOne({ where: { venueId }, relations: ['manager'] });
      
          if (!venue) {
            return { success: false, message: 'Venue not found' };
          }
      
          const manager = await userRepo.findOne({
            where: { userId: managerId },
            relations: ['role'],
          });
      
          if (!manager) {
            return { success: false, message: 'Manager user not found' };
          }
      
          // Optional check: Make sure the user has the role 'venue_manager'
          if (manager.role.roleName.toLowerCase() !== 'venue_manager') {
            return { success: false, message: 'User is not a venue manager' };
          }
      
          // Assign new manager
          venue.manager = manager;
          venue.managerId = manager.userId;
      
          const updatedVenue = await venueRepo.save(venue);
      
          return { success: true, data: updatedVenue };
        } catch (error) {
          return {
            success: false,
            message: 'Failed to update venue manager',
          };
        }
      }
      


    //delete venue

    static async delete(id: string):Promise<{success: boolean;  message?:string}>{
        if(!id)
        {
            return {success: false,message: "Venue id is required"}
        }
        try{
            const result = await AppDataSource.getRepository(Venue).delete(id);
            if(result.affected === 0){
                return{success: false, message :"venue not found or already deleted"}
            }
            return{success:true, message:"Venue deleted successfully"}
        }
        catch(error){
            return{success: false, message:"failed to delete venue"}
        }
    }

}