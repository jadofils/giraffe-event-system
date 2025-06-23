// import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

// export class ModifyEventVenueBookingRelation1729276800002 implements MigrationInterface {
//   public async up(queryRunner: QueryRunner): Promise<void> {
//     // Drop the venueBookingId column from the events table
//     await queryRunner.dropColumn('events', 'venueBookingId');

//     // Remove the unique constraint on eventId in venue_bookings
//     await queryRunner.query(`
//       ALTER TABLE venue_bookings
//       DROP CONSTRAINT IF EXISTS venue_bookings_eventId_key
//     `);
//   }

//   public async down(queryRunner: QueryRunner): Promise<void> {
//     // Re-add the venueBookingId column to the events table
//     await queryRunner.addColumn(
//       'events',
//       new TableColumn({
//         name: 'venueBookingId',
//         type: 'uuid',
//         isNullable: true,
//       })
//     );

//     // Re-add the unique constraint on eventId in venue_bookings
//     await queryRunner.query(`
//       ALTER TABLE venue_bookings
//       ADD CONSTRAINT venue_bookings_eventId_key UNIQUE (eventId)
//     `);
//   }
// }