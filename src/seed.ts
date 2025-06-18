import { DataSource } from 'typeorm';
import { runSeeders } from 'typeorm-extension';
import { AppDataSource } from './config/Database';
import EventVenueSeeding from './seeds/EventVenueSeeding';
import IndependentOrganizationSeeder from './seeds/IndependentUserOrganizationSeeder';

(async () => {
  try {
    await AppDataSource.initialize();
    console.log('Database connection established!');

    // Check if seeding has already been done
    const roleRepository = AppDataSource.getRepository('Role');
    const existingRoles = await roleRepository.find();
    
    if (existingRoles.length > 0) {
      console.log('Database already seeded with roles:', existingRoles.map(role => role.roleName).join(', '));
      console.log('Skipping seeding process...');
      await AppDataSource.destroy();
      return;
    }

    // Run the seeders
    await runSeeders(AppDataSource, {
      seeds: [IndependentOrganizationSeeder, EventVenueSeeding],
    });

    console.log('Seeding completed successfully!');
    await AppDataSource.destroy();
  } catch (error) {
    console.error('Error during seeding:', error);
    await AppDataSource.destroy();
    process.exit(1);
  }
})();