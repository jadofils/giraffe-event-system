// src/models/Role.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToMany,
  JoinTable,
} from "typeorm";
import {
  IsUUID,
  IsNotEmpty,
  IsOptional,
  Length,
  IsArray,
} from "class-validator";
import { User } from "./User";
import { Permission } from "./Permission";

@Entity("roles")
export class Role {
  @PrimaryGeneratedColumn("uuid")
  @IsUUID("4", { message: "roleId must be a valid UUID" }) // Added validation message
  roleId!: string;

  @Column({ unique: true })
  @IsNotEmpty({ message: "roleName is required" })
  @Length(3, 50, {
    message:
      "roleName must be between $constraint1 and $constraint2 characters",
  })
  roleName!: string;

  @Column({ type: "text", nullable: true }) // Explicitly define type 'text'
  @IsOptional()
  @Length(0, 500, {
    message: "description must be at most $constraint2 characters",
  }) // Added validation message
  description?: string;

  // --- Relationship to User (One Role to Many Users) ---
  // This is correct and perfectly matches the ManyToOne in User.ts
  @OneToMany(() => User, (user) => user.role)
  users!: User[];

  // --- Relationship to Permission (Many-to-Many) ---
  @ManyToMany(() => Permission, (permission) => permission.roles, {
    cascade: true,
  })
  @JoinTable({
    name: "role_permissions",
    joinColumn: { name: "role_id", referencedColumnName: "roleId" },
    inverseJoinColumn: { name: "permission_id", referencedColumnName: "id" },
  })
  permissions!: Permission[];

  // --- Timestamp Columns ---
  @CreateDateColumn({ type: "timestamp with time zone" }) // Explicit type
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamp with time zone" }) // Explicit type
  updatedAt!: Date;

  @DeleteDateColumn({ type: "timestamp with time zone", nullable: true }) // Added for consistency with other models
  deletedAt?: Date;
}
