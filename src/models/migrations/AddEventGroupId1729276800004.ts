import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddEventGroupId1729276800004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "events",
      new TableColumn({
        name: "groupId",
        type: "uuid",
        isNullable: true,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("events", "groupId");
  }
}
