import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateEventVenuesTable1729276800001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'event_venues',
        columns: [
          {
            name: 'eventId',
            type: 'uuid',
            isPrimary: true,
          },
          {
            name: 'venueId',
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
            columnNames: ['venueId'],
            referencedTableName: 'venues',
            referencedColumnNames: ['venueId'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('event_venues');
  }
}