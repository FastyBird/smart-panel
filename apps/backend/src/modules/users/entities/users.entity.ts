import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { Column, Entity } from 'typeorm';

import { BaseEntity } from '../../../common/entities/base.entity';
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
