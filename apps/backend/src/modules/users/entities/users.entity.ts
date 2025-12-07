import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { Column, Entity } from 'typeorm';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { BaseEntity } from '../../../common/entities/base.entity';
import { UserRole } from '../users.constants';

@ApiSchema({ name: 'UsersModuleDataUser' })
@Entity('users_module_users')
export class UserEntity extends BaseEntity {
	@ApiProperty({
		name: 'is_hidden',
		description: 'Indicates whether the user is hidden from general visibility.',
		type: 'boolean',
		default: false,
	})
	@Expose({ name: 'is_hidden' })
	@IsBoolean()
	@Transform(({ obj }: { obj: { is_hidden?: boolean; isHidden?: boolean } }) => obj.is_hidden ?? obj.isHidden, {
		toClassOnly: true,
	})
	@Column({ default: false })
	isHidden: boolean;

	@Expose({ groups: ['internal'] })
	@Column({ nullable: true })
	password: string | null;

	@ApiProperty({
		description: 'Email address of the user.',
		type: 'string',
		format: 'email',
		nullable: true,
		example: 'john@doe.com',
	})
	@Expose()
	@IsOptional()
	@IsEmail()
	@Column({ nullable: true, default: null })
	email: string | null;

	@ApiProperty({
		name: 'first_name',
		description: 'First name of the user.',
		type: 'string',
		nullable: true,
		example: 'John',
	})
	@Expose({ name: 'first_name' })
	@IsOptional()
	@IsString()
	@Transform(({ obj }: { obj: { first_name?: string; firstName?: string } }) => obj.first_name ?? obj.firstName, {
		toClassOnly: true,
	})
	@Column({ nullable: true, default: null })
	firstName: string | null;

	@ApiProperty({
		name: 'last_name',
		description: 'Last name of the user.',
		type: 'string',
		nullable: true,
		example: 'Doe',
	})
	@Expose({ name: 'last_name' })
	@IsOptional()
	@IsString()
	@Transform(({ obj }: { obj: { last_name?: string; lastName?: string } }) => obj.last_name ?? obj.lastName, {
		toClassOnly: true,
	})
	@Column({ nullable: true, default: null })
	lastName: string | null;

	@ApiProperty({
		description: 'Unique username of the user.',
		type: 'string',
		example: 'johndoe',
	})
	@Expose()
	@IsString()
	@Column({ nullable: false, unique: true })
	username: string;

	@ApiProperty({
		description: "User role: 'owner' has full access, 'admin' can manage users, 'user' has limited access.",
		enum: UserRole,
		default: UserRole.USER,
	})
	@Expose()
	@IsEnum(UserRole)
	@Column({
		type: 'text',
		enum: UserRole,
		default: UserRole.USER,
	})
	role: UserRole;
}
