// import { MigrationInterface, QueryRunner, Table } from 'typeorm';

// export class CreateUserOrganizationsTable1729276800000 implements MigrationInterface {
//   public async up(queryRunner: QueryRunner): Promise<void> {
//     await queryRunner.createTable(
//       new Table({
//         name: 'user_organizations',
//         columns: [
//           {
//             name: 'userId',
//             type: 'uuid',
//             isPrimary: true,
//           },
//           {
//             name: 'organizationId',
//             type: 'uuid',
//             isPrimary: true,
//           },
//         ],
//         foreignKeys: [
//           {
//             columnNames: ['userId'],
//             referencedTableName: 'users',
//             referencedColumnNames: ['userId'],
//             onDelete: 'CASCADE',
//           },
//           {
//             columnNames: ['organizationId'],
//             referencedTableName: 'organizations',
//             referencedColumnNames: ['organizationId'],
//             onDelete: 'CASCADE',
//           },
//         ],
//       }),
//       true
//     );
//   }

//   public async down(queryRunner: QueryRunner): Promise<void> {
//     await queryRunner.dropTable('user_organizations');
//   }
// }
