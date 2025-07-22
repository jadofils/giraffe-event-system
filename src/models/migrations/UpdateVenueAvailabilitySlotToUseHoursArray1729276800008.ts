import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class UpdateVenueAvailabilitySlotToUseHoursArray1729276800008 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Drop existing time columns
        await queryRunner.dropColumn("venue_availability_slots", "startTime");
        await queryRunner.dropColumn("venue_availability_slots", "endTime");

        // Add new columns
        await queryRunner.addColumn(
            "venue_availability_slots",
            new TableColumn({
                name: "bookedHours",
                type: "jsonb",
                isNullable: true,
            })
        );

        await queryRunner.addColumn(
            "venue_availability_slots",
            new TableColumn({
                name: "metadata",
                type: "jsonb",
                isNullable: true,
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop new columns
        await queryRunner.dropColumn("venue_availability_slots", "metadata");
        await queryRunner.dropColumn("venue_availability_slots", "bookedHours");

        // Restore old columns
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
} 