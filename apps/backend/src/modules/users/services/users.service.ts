import bcrypt from 'bcrypt';
import { validate } from 'class-validator';
import isUndefined from 'lodash.isundefined';
import omitBy from 'lodash.omitby';
import { Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserEntity } from '../entities/users.entity';
import { EventType, USERS_MODULE_NAME, UserRole } from '../users.constants';
import { UsersNotFoundException, UsersValidationException } from '../users.exceptions';

@Injectable()
export class UsersService {
	private readonly logger = createExtensionLogger(USERS_MODULE_NAME, 'UsersService');

	constructor(
		@InjectRepository(UserEntity)
		private readonly repository: Repository<UserEntity>,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async findOwner(): Promise<UserEntity | null> {
		return this.findByField('role', UserRole.OWNER);
	}

	async findAll(): Promise<UserEntity[]> {
		this.logger.debug('Fetching all users');

		const users = await this.repository.find();

		this.logger.debug(`Found ${users.length} users`);

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
		this.logger.debug(`Fetching all users by given role: ${role}`);

		const users = await this.repository.createQueryBuilder('user').where('user.role = :role', { role }).getMany();

		this.logger.debug(`Found ${users.length} users by given role: ${role}`);

		return users;
	}

	async create(createDto: CreateUserDto): Promise<UserEntity> {
		const dtoInstance = await this.validateDto<CreateUserDto>(CreateUserDto, createDto);

		// Hash password before storing it
		const hashedPassword = await bcrypt.hash(dtoInstance.password, 10);

		const user = this.repository.create(
			toInstance(
				UserEntity,
				{
					...dtoInstance,
					password: hashedPassword,
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

		this.eventEmitter.emit(EventType.USER_CREATED, savedUser);

		return savedUser;
	}

	async update(id: string, updateDto: UpdateUserDto): Promise<UserEntity> {
		const user = await this.getOneOrThrow(id);

		const dtoInstance = await this.validateDto<UpdateUserDto>(UpdateUserDto, updateDto);

		// Hash password before storing it
		const hashedPassword = dtoInstance.password ? await bcrypt.hash(dtoInstance.password, 10) : undefined;

		// Get the fields to update from DTO (excluding undefined values)
		const updateFields = omitBy(
			toInstance(
				UserEntity,
				{ ...dtoInstance, password: hashedPassword },
				{
					groups: ['internal'],
				},
			),
			isUndefined,
		);

		// Check if any entity fields are actually being changed by comparing with existing values
		const entityFieldsChanged = Object.keys(updateFields).some((key) => {
			const newValue = (updateFields as Record<string, unknown>)[key];
			const existingValue = (user as unknown as Record<string, unknown>)[key];

			// Deep comparison for arrays
			if (Array.isArray(newValue) && Array.isArray(existingValue)) {
				return JSON.stringify(newValue) !== JSON.stringify(existingValue);
			}

			// Deep comparison for plain objects
			if (
				typeof newValue === 'object' &&
				typeof existingValue === 'object' &&
				newValue !== null &&
				existingValue !== null
			) {
				return JSON.stringify(newValue) !== JSON.stringify(existingValue);
			}

			// Handle null/undefined comparison
			if (newValue === null && existingValue === null) {
				return false;
			}
			if (newValue === null || existingValue === null) {
				return true;
			}

			// Simple value comparison
			return newValue !== existingValue;
		});

		Object.assign(user, updateFields);

		await this.repository.save(user);

		const updatedUser = await this.getOneOrThrow(user.id);

		this.logger.debug(`Successfully updated user with id=${updatedUser.id}`);

		if (entityFieldsChanged) {
			this.eventEmitter.emit(EventType.USER_UPDATED, updatedUser);
		}

		return updatedUser;
	}

	async remove(id: string): Promise<void> {
		const user = await this.getOneOrThrow(id);

		await this.repository.delete(user.id);

		this.logger.log(`Successfully removed user with id=${id}`);

		this.eventEmitter.emit(EventType.USER_DELETED, user);
	}

	async getOneOrThrow(id: string): Promise<UserEntity> {
		const user = await this.findOne(id);

		if (!user) {
			this.logger.error(`User with id=${id} not found`);

			throw new UsersNotFoundException('Requested user does not exist');
		}

		return user;
	}

	private async findByField(field: keyof UserEntity, value: string | number | boolean): Promise<UserEntity | null> {
		this.logger.debug(`Fetching user with ${field}=${value}`);

		const user = await this.repository.findOne({ where: { [field]: value } });

		if (!user) {
			this.logger.debug(`User with ${field}=${value} not found`);

			return null;
		}

		this.logger.debug(`Successfully fetched user with ${field}=${value}`);

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
			this.logger.error(`Validation failed: ${JSON.stringify(errors)}`);

			throw new UsersValidationException('Provided user data are invalid.');
		}

		return dtoInstance;
	}
}
