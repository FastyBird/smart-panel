import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, IsUUID, Validate, ValidateIf } from 'class-validator';
import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { AbstractInstanceValidator } from '../../../common/validation/abstract-instance.validator';
import { DisplayProfileEntity } from '../../system/entities/system.entity';
import { UserRole } from '../users.constants';

@ApiSchema({ name: 'AuthModuleUser' })
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
		description:
			"User role: 'owner' has full access, 'admin' can manage users, 'user' has limited access, 'display' is read-only.",
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

@ApiSchema({ name: 'AuthModuleDisplayInstance' })
@Entity('users_module_displays_instances')
export class DisplayInstanceEntity extends BaseEntity {
	@ApiProperty({
		description: 'Unique identifier for the display device (e.g., UUID).',
		type: 'string',
		format: 'uuid',
		example: 'fcab917a-f889-47cf-9ace-ef085774864e',
	})
	@Expose()
	@IsString()
	@IsUUID()
	@Column({ type: 'uuid' })
	uid: string;

	@ApiProperty({
		description: 'MAC address of the device network interface.',
		type: 'string',
		format: 'mac',
		example: '00:1A:2B:3C:4D:5E',
	})
	@Expose()
	@IsString()
	@Column({ nullable: false })
	mac: string;

	@ApiProperty({
		description: 'Application version running on the display.',
		type: 'string',
		example: '1.0.0',
	})
	@Expose()
	@IsString()
	@Column({ nullable: false })
	version: string;

	@ApiProperty({
		description: 'Build number or identifier of the app.',
		type: 'string',
		example: '42',
	})
	@Expose()
	@IsString()
	@Column({ nullable: false })
	build: string;

	@ApiProperty({
		description: 'Unique identifier for the user.',
		type: 'string',
		format: 'uuid',
		readOnly: true,
		example: 'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6',
	})
	@Expose()
	@ValidateIf((_, value) => typeof value === 'string')
	@IsUUID('4', { message: '[{"field":"user","reason":"User must be a valid UUID (version 4)."}]' })
	@ValidateIf((_, value) => typeof value === 'object')
	@Validate(AbstractInstanceValidator, [UserEntity], {
		message: '[{"field":"user","reason":"User must be a valid subclass of UserEntity."}]',
	})
	@Transform(({ value }: { value: UserEntity }) => value.id, { toPlainOnly: true })
	@OneToOne(() => UserEntity, { cascade: true, onDelete: 'CASCADE' })
	@JoinColumn({ name: 'userId' })
	user: UserEntity | string;

	@ApiProperty({
		name: 'display_profile',
		description: 'Unique identifier for the display profile.',
		type: 'string',
		format: 'uuid',
		nullable: true,
		readOnly: true,
		example: 'e328b39a-92db-4ea4-a34d-7ec3ba81fe64',
	})
	@Expose({ name: 'display_profile' })
	@ValidateIf((_, value) => typeof value === 'string')
	@IsUUID('4', { message: '[{"field":"displayProfile","reason":"System display must be a valid UUID (version 4)."}]' })
	@ValidateIf((_, value) => typeof value === 'object')
	@Validate(AbstractInstanceValidator, [DisplayProfileEntity], {
		message:
			'[{"field":"displayProfile","reason":"System display profile must be a valid subclass of DisplayProfileEntity."}]',
	})
	@Transform(({ value }: { value: DisplayProfileEntity | null }) => value?.id ?? null, { toPlainOnly: true })
	@OneToOne(() => DisplayProfileEntity, { cascade: true, onDelete: 'CASCADE', nullable: true })
	@JoinColumn({ name: 'displayProfileId' })
	displayProfile: DisplayProfileEntity | string | null;
}
