import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class UpdateVenueAvailabilitySlots1729276800006
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the old isAvailable column
    await queryRunner.dropColumn("venue_availability_slots", "isAvailable");

    // Add new status column
    await queryRunner.addColumn(
      "venue_availability_slots",
      new TableColumn({
        name: "status",
        type: "enum",
        enum: ["AVAILABLE", "BOOKED", "TRANSITION"],
        default: "'AVAILABLE'",
      })
    );

    // Add eventId column
    await queryRunner.addColumn(
      "venue_availability_slots",
      new TableColumn({
        name: "eventId",
        type: "uuid",
        isNullable: true,
      })
    );

    // Add notes column
    await queryRunner.addColumn(
      "venue_availability_slots",
      new TableColumn({
        name: "notes",
        type: "text",
        isNullable: true,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop new columns
    await queryRunner.dropColumn("venue_availability_slots", "notes");
    await queryRunner.dropColumn("venue_availability_slots", "eventId");
    await queryRunner.dropColumn("venue_availability_slots", "status");

    // Restore old column
    await queryRunner.addColumn(
      "venue_availability_slots",
      new TableColumn({
        name: "isAvailable",
        type: "boolean",
        default: true,
      })
    );
  }
}
