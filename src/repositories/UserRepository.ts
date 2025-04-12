import { User } from "../models/User";
import { getRepository } from "typeorm";
import { UserInterface } from "../modelDtoInterface/ModelsInterface";

export class UserRepository {
  static async findExistingUser(email: typeof UserInterface.Email, username: typeof UserInterface.Username): Promise<User | null> {
    const userRepository = getRepository(User);
    return await userRepository.findOne({
      where: [{ email }, { username }],
    });
  }

  static createUser(data: Partial<typeof UserInterface>): User {
    const user = new User();
    user.username = data.Username!;
    user.firstName = data.FirstName!;
    user.lastName = data.LastName!;
    user.email = data.Email!;
    user.phoneNumber = data.PhoneNumber ?? null;
    return user;
  }

  static async saveUser(user: User): Promise<void> {
    const userRepository = getRepository(User);
    await userRepository.save(user);
  }

  static async getAllUsers(): Promise<Partial<User[]> | null> {
    const userRepository = getRepository(User);
    return await userRepository.find({
      select: ["userId", "username", "firstName", "lastName", "email"],
    });
  }

  static async getUserById(id: typeof UserInterface.UserID): Promise<Partial<User> | null> {
    const userRepository = getRepository(User);
    return await userRepository.findOne({
      where: { userId: id },
      select: ["userId", "username", "firstName", "lastName", "email", "phoneNumber"],
    });
  }
}
