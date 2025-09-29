import bcrypt from 'bcrypt';
import { validate } from 'class-validator';
import isUndefined from 'lodash.isundefined';
import omitBy from 'lodash.omitby';
import { Repository } from 'typeorm';

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { toInstance } from '../../../common/utils/transform.utils';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserEntity } from '../entities/users.entity';
import { EventType, UserRole } from '../users.constants';
import { UsersNotFoundException, UsersValidationException } from '../users.exceptions';

@Injectable()
export class UsersService {
	private readonly logger = new Logger(UsersService.name);

	constructor(
		@InjectRepository(UserEntity)
		private readonly repository: Repository<UserEntity>,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async findOwner(): Promise<UserEntity | null> {
		return this.findByField('role', UserRole.OWNER);
	}

	async findAll(): Promise<UserEntity[]> {
		this.logger.debug('[LOOKUP ALL] Fetching all users');

		const users = await this.repository.find();

		this.logger.debug(`[LOOKUP ALL] Found ${users.length} users`);

		return users;
	}

	async findOne(id: string): Promise<UserEntity | null> {
		return this.findByField('id', id);
	}

	async findByUsername(username: string): Promise<UserEntity | null> {
		return this.findByField('username', username);
	}

	async findByEmail(email: string): Promise<UserEntity | null> {
		return this.findByField('email', email);
	}

	async findAllByRole(role: UserRole): Promise<UserEntity[]> {
		this.logger.debug(`[LOOKUP ALL] Fetching all users by given role: ${role}`);

		const users = await this.repository.createQueryBuilder('user').where('user.role = :role', { role }).getMany();

		this.logger.debug(`[LOOKUP ALL] Found ${users.length} users by given role: ${role}`);

		return users;
	}

	async create(createDto: CreateUserDto): Promise<UserEntity> {
		this.logger.debug('[CREATE] Creating new user');

		const dtoInstance = await this.validateDto<CreateUserDto>(CreateUserDto, createDto);

		// Hash password before storing it
		const hashedPassword = await bcrypt.hash(dtoInstance.password, 10);

		const user = this.repository.create(
			toInstance(
				UserEntity,
				{
					...dtoInstance,
					password: hashedPassword,
					is_hidden: dtoInstance.role === UserRole.DISPLAY,
				},
				{
					groups: ['internal'],
				},
			),
		);

		// Save the user
		await this.repository.save(user);

		// Retrieve the saved user with its full relations
		const savedUser = await this.getOneOrThrow(user.id);

		this.logger.debug(`[CREATE] Successfully created user with id=${savedUser.id}`);

		this.eventEmitter.emit(EventType.USER_CREATED, savedUser);

		return savedUser;
	}

	async update(id: string, updateDto: UpdateUserDto): Promise<UserEntity> {
		this.logger.debug(`[UPDATE] Updating user with id=${id}`);

		const user = await this.getOneOrThrow(id);

		const dtoInstance = await this.validateDto<UpdateUserDto>(UpdateUserDto, updateDto);

		// Hash password before storing it
		const hashedPassword = dtoInstance.password ? await bcrypt.hash(dtoInstance.password, 10) : undefined;

		Object.assign(
			user,
			omitBy(
				toInstance(
					UserEntity,
					{ ...dtoInstance, password: hashedPassword },
					{
						groups: ['internal'],
					},
				),
				isUndefined,
			),
		);

		await this.repository.save(user);

		const updatedUser = await this.getOneOrThrow(user.id);

		this.logger.debug(`[UPDATE] Successfully updated user with id=${updatedUser.id}`);

		this.eventEmitter.emit(EventType.USER_UPDATED, updatedUser);

		return updatedUser;
	}

	async remove(id: string): Promise<void> {
		this.logger.debug(`[DELETE] Removing user with id=${id}`);

		const user = await this.getOneOrThrow(id);

		await this.repository.delete(user.id);

		this.logger.log(`[DELETE] Successfully removed user with id=${id}`);

		this.eventEmitter.emit(EventType.USER_DELETED, user);
	}

	async getOneOrThrow(id: string): Promise<UserEntity> {
		const user = await this.findOne(id);

		if (!user) {
			this.logger.error(`[ERROR] User with id=${id} not found`);

			throw new UsersNotFoundException('Requested user does not exist');
		}

		return user;
	}

	private async findByField(field: keyof UserEntity, value: string | number | boolean): Promise<UserEntity | null> {
		this.logger.debug(`[LOOKUP] Fetching user with ${field}=${value}`);

		const user = await this.repository.findOne({ where: { [field]: value } });

		if (!user) {
			this.logger.debug(`[LOOKUP] User with ${field}=${value} not found`);

			return null;
		}

		this.logger.debug(`[LOOKUP] Successfully fetched user with ${field}=${value}`);

		return user;
	}

	private async validateDto<T extends object>(DtoClass: new () => T, dto: any): Promise<T> {
		const dtoInstance = toInstance(DtoClass, dto, {
			excludeExtraneousValues: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
			stopAtFirstError: false,
		});

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION FAILED] ${JSON.stringify(errors)}`);

			throw new UsersValidationException('Provided user data are invalid.');
		}

		return dtoInstance;
	}
}
