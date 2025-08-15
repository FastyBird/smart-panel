import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, IsUUID, Validate, ValidateIf } from 'class-validator';
import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';

import { BaseEntity } from '../../../common/entities/base.entity';
import { AbstractInstanceValidator } from '../../../common/validation/abstract-instance.validator';
import { DisplayProfileEntity } from '../../system/entities/system.entity';
import { UserRole } from '../users.constants';

@Entity('users_module_users')
export class UserEntity extends BaseEntity {
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

	@Expose()
	@IsOptional()
	@IsEmail()
	@Column({ nullable: true, default: null })
	email: string | null;

	@Expose({ name: 'first_name' })
	@IsOptional()
	@IsString()
	@Transform(({ obj }: { obj: { first_name?: string; firstName?: string } }) => obj.first_name ?? obj.firstName, {
		toClassOnly: true,
	})
	@Column({ nullable: true, default: null })
	firstName: string | null;

	@Expose({ name: 'last_name' })
	@IsOptional()
	@IsString()
	@Transform(({ obj }: { obj: { last_name?: string; lastName?: string } }) => obj.last_name ?? obj.lastName, {
		toClassOnly: true,
	})
	@Column({ nullable: true, default: null })
	lastName: string | null;

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
	role: UserRole;
}

@Entity('users_module_displays_instances')
export class DisplayInstanceEntity extends BaseEntity {
	@Expose()
	@IsString()
	@IsUUID()
	@Column({ type: 'uuid' })
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
	@OneToOne(() => UserEntity, { cascade: true, onDelete: 'CASCADE' })
	@JoinColumn({ name: 'userId' })
	user: UserEntity | string;

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
