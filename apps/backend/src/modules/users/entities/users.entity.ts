import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, IsUUID, Validate, ValidateIf } from 'class-validator';
import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';

import { BaseEntity } from '../../../common/entities/base.entity';
import { AbstractInstanceValidator } from '../../../common/validation/abstract-instance.validator';
import { UserRole } from '../users.constants';

@Entity('users_module_users')
export class UserEntity extends BaseEntity {
	@Expose({ name: 'is_hidden' })
	@IsBoolean()
	@Transform(({ obj }: { obj: { is_hidden?: boolean; isHidden?: boolean } }) => obj.is_hidden ?? obj.isHidden, {
		toClassOnly: true,
	})
	@Column({ default: false })
	isHidden: boolean = false;

	@Expose({ groups: ['internal'] })
	@Column({ nullable: false })
	password: string;

	@Expose()
	@IsOptional()
	@IsEmail()
	@Column({ nullable: true, default: null })
	email: string | null = null;

	@Expose({ name: 'first_name' })
	@IsOptional()
	@IsString()
	@Transform(({ obj }: { obj: { first_name?: string; firstName?: string } }) => obj.first_name ?? obj.firstName, {
		toClassOnly: true,
	})
	@Column({ nullable: true, default: null })
	firstName: string | null = null;

	@Expose({ name: 'last_name' })
	@IsOptional()
	@IsString()
	@Transform(({ obj }: { obj: { last_name?: string; lastName?: string } }) => obj.last_name ?? obj.lastName, {
		toClassOnly: true,
	})
	@Column({ nullable: true, default: null })
	lastName: string | null = null;

	@Expose()
	@IsString()
	@Column({ nullable: false, unique: true })
	username: string;

	@Expose()
	@IsEnum(UserRole)
	@Column({
		type: 'text',
		enum: UserRole,
		default: UserRole.USER,
	})
	role: UserRole = UserRole.USER;
}

@Entity('users_module_displays')
export class DisplayEntity extends BaseEntity {
	@Expose()
	@IsString()
	@IsUUID()
	@PrimaryGeneratedColumn('uuid')
	uid: string;

	@Expose()
	@IsString()
	@Column({ nullable: false })
	mac: string;

	@Expose()
	@IsString()
	@Column({ nullable: false })
	version: string;

	@Expose()
	@IsString()
	@Column({ nullable: false })
	build: string;

	@Expose()
	@ValidateIf((_, value) => typeof value === 'string')
	@IsUUID('4', { message: '[{"field":"user","reason":"User must be a valid UUID (version 4)."}]' })
	@ValidateIf((_, value) => typeof value === 'object')
	@Validate(AbstractInstanceValidator, [UserEntity], {
		message: '[{"field":"user","reason":"User must be a valid subclass of UserEntity."}]',
	})
	@Transform(({ value }: { value: UserEntity }) => value.id, { toPlainOnly: true })
	@OneToOne(() => UserEntity, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'user_id' })
	user: UserEntity | string;
}
