import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class UpdateVenueAvailabilitySlotTimeColumns1729276800007
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop existing columns
    await queryRunner.dropColumn("venue_availability_slots", "startTime");
    await queryRunner.dropColumn("venue_availability_slots", "endTime");

    // Add new time columns
    await queryRunner.addColumn(
      "venue_availability_slots",
      new TableColumn({
        name: "startTime",
        type: "time",
        isNullable: true,
      })
    );

    await queryRunner.addColumn(
      "venue_availability_slots",
      new TableColumn({
        name: "endTime",
        type: "time",
        isNullable: true,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop new columns
    await queryRunner.dropColumn("venue_availability_slots", "startTime");
    await queryRunner.dropColumn("venue_availability_slots", "endTime");

    // Restore old columns
    await queryRunner.addColumn(
      "venue_availability_slots",
      new TableColumn({
        name: "startTime",
        type: "timestamp",
        isNullable: true,
      })
    );

    await queryRunner.addColumn(
      "venue_availability_slots",
      new TableColumn({
        name: "endTime",
        type: "timestamp",
        isNullable: true,
      })
    );
  }
}
