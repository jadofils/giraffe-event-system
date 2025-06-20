import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { DataSource } from 'typeorm';
import { User } from '../models/User';
import { Organization } from '../models/Organization';
import { Role } from '../models/Role';
import { Venue } from '../models/Venue';
import { Event } from '../models/Event';
import { EventType } from '../interfaces/Enums/EventTypeEnum';
import { EventStatus } from '../interfaces/Enums/EventStatusEnum';

export default class EventVenueSeeding implements Seeder {
  public async run(dataSource: DataSource, factoryManager: SeederFactoryManager): Promise<void> {
    const userRepository = dataSource.getRepository(User);
    const organizationRepository = dataSource.getRepository(Organization);
    const roleRepository = dataSource.getRepository(Role);
    const venueRepository = dataSource.getRepository(Venue);
    const eventRepository = dataSource.getRepository(Event);

    // Find or create a default role
    let role = await roleRepository.findOne({ where: {} });
    if (!role) {
      role = roleRepository.create({ /* Define required fields for Role */ });
      await roleRepository.save(role);
    }

    // Find or create the "Independent" organization
    let independentOrg = await organizationRepository.findOneBy({ organizationName: 'Independent' });
    if (!independentOrg) {
      independentOrg = organizationRepository.create({
        organizationName: 'Independent',
        contactEmail: 'independent@org.com',
        description: 'Default organization for independent users',
      });
      await organizationRepository.save(independentOrg);
    }

    // Find or create a test user
    let testUser = await userRepository.findOneBy({ username: 'testuser' });
    if (!testUser) {
      testUser = userRepository.create({
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        email: 'testuser@example.com',
        password: 'hashedPassword',
        roleId: role.roleId,
      });
      await userRepository.save(testUser);

      // Link the test user to the "Independent" organization
      await dataSource
        .createQueryBuilder()
        .insert()
        .into('user_organizations')
        .values({
          userId: testUser.userId,
          organizationId: independentOrg.organizationId,
        })
        .orIgnore()
        .execute();
    }

    // Create or find four test venues
    const venues = [];
    for (let i = 1; i <= 4; i++) {
      let venue = await venueRepository.findOneBy({ venueName: `Test Venue ${i}` });
      if (!venue) {
        venue = venueRepository.create({
          venueName: `Test Venue ${i}`,
          capacity: 100 + i * 50,
          amount: 500.0 + i * 100,
          location: `123 Test Street ${i}, City`,
          organizationId: independentOrg.organizationId,
        });
        await venueRepository.save(venue);
      }
      venues.push(venue);
    }

    // Create or find four test events
    const events = [];
    for (let i = 1; i <= 4; i++) {
      let event = await eventRepository.findOneBy({ eventTitle: `Test Event ${i}` });
      if (!event) {
        event = eventRepository.create({
          eventTitle: `Test Event ${i}`,
          eventType: EventType.PUBLIC,
          status: EventStatus.DRAFTED,
          organizationId: independentOrg.organizationId,
          organizerId: testUser.userId,
          createdByUserId: testUser.userId,
          startDate: new Date(`2025-07-${10 + i}T10:00:00Z`),
          endDate: new Date(`2025-07-${10 + i}T12:00:00Z`),
        });
        await eventRepository.save(event);
      }
      events.push(event);
    }

    // Create four event-venue associations
    const eventVenuePairs = [
      { event: events[0], venue: venues[0] },
      { event: events[1], venue: venues[1] },
      { event: events[2], venue: venues[2] },
      { event: events[3], venue: venues[3] },
    ];

    for (const pair of eventVenuePairs) {
      const exists = await dataSource
        .createQueryBuilder()
        .select()
        .from('event_venues', 'ev')
        .where('ev.eventId = :eventId AND ev.venueId = :venueId', {
          eventId: pair.event.eventId,
          venueId: pair.venue.venueId,
        })
        .getCount();

      if (!exists) {
        await dataSource
          .createQueryBuilder()
          .insert()
          .into('event_venues')
          .values({
            eventId: pair.event.eventId,
            venueId: pair.venue.venueId,
          })
          .orIgnore()
          .execute();
      }
    }
  }
}