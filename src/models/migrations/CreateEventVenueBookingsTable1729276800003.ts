import { MigrationInterface, QueryRunner, Table, TableColumn } from 'typeorm';

export class CreateEventVenueBookingsTable1729276800003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create the event_venue_bookings junction table
    await queryRunner.createTable(
      new Table({
        name: 'event_venue_bookings',
        columns: [
          {
            name: 'eventId',
            type: 'uuid',
            isPrimary: true,
          },
          {
            name: 'bookingId',
            type: 'uuid',
            isPrimary: true,
          },
        ],
        foreignKeys: [
          {
            columnNames: ['eventId'],
            referencedTableName: 'events',
            referencedColumnNames: ['eventId'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['bookingId'],
            referencedTableName: 'venue_bookings',
            referencedColumnNames: ['bookingId'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true
    );

    // Drop the eventId column from venue_bookings
    await queryRunner.dropColumn('venue_bookings', 'eventId');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Re-add the eventId column to venue_bookings
    await queryRunner.addColumn(
      'venue_bookings',
      new TableColumn({
        name: 'eventId',
        type: 'uuid',
        isNullable: false,
      })
    );

    // Drop the event_venue_bookings table
    await queryRunner.dropTable('event_venue_bookings');
  }
}