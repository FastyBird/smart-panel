import { validate } from 'class-validator';
import isUndefined from 'lodash.isundefined';
import omitBy from 'lodash.omitby';
import { DataSource, Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import { UserEntity } from '../../users/entities/users.entity';
import { AUTH_MODULE_NAME, TokenOwnerType } from '../auth.constants';
import { AuthException, AuthNotFoundException, AuthValidationException } from '../auth.exceptions';
import { CreateTokenDto } from '../dto/create-token.dto';
import { UpdateTokenDto } from '../dto/update-token.dto';
import { AccessTokenEntity, LongLiveTokenEntity, RefreshTokenEntity, TokenEntity } from '../entities/auth.entity';
import { hashToken } from '../utils/token.utils';

import { TokensTypeMapperService } from './tokens-type-mapper.service';

@Injectable()
export class TokensService {
	private readonly logger = createExtensionLogger(AUTH_MODULE_NAME, 'TokensService');

	constructor(
		@InjectRepository(TokenEntity)
		private readonly repository: Repository<TokenEntity>,
		private readonly tokensMapperService: TokensTypeMapperService,
		private readonly dataSource: DataSource,
	) {}

	async findAll<TToken extends TokenEntity>(type?: new (...args: any[]) => TToken): Promise<TToken[]> {
		const repository = this.dataSource.getRepository(type ?? TokenEntity);
		const typeName = type?.name;

		let queryBuilder = repository.createQueryBuilder('token');

		// Join relations based on token type
		if (typeName === AccessTokenEntity.name) {
			// AccessTokenEntity has owner and children (no parent)
			queryBuilder = queryBuilder
				.leftJoinAndSelect('token.owner', 'owner')
				.leftJoinAndSelect('token.children', 'children');
		} else if (typeName === RefreshTokenEntity.name) {
			// RefreshTokenEntity has owner and parent (no children)
			queryBuilder = queryBuilder.leftJoinAndSelect('token.owner', 'owner').leftJoinAndSelect('token.parent', 'parent');
		}
		// LongLiveTokenEntity has no relations to join

		const tokens = (await queryBuilder.getMany()) as TToken[];

		return tokens;
	}

	async findAllByOwner<TToken extends TokenEntity>(
		owner: string,
		type?: new (...args: any[]) => TToken,
	): Promise<TToken[]> {
		const repository = this.dataSource.getRepository(type ?? TokenEntity);
		const typeName = type?.name;

		let queryBuilder = repository.createQueryBuilder('token');

		if (typeName === LongLiveTokenEntity.name) {
			// LongLiveTokenEntity uses ownerId field directly
			queryBuilder = queryBuilder.where('token.ownerId = :ownerId', { ownerId: owner });
		} else if (typeName === AccessTokenEntity.name) {
			// AccessTokenEntity has owner and children (no parent)
			queryBuilder = queryBuilder
				.leftJoinAndSelect('token.owner', 'owner')
				.leftJoinAndSelect('token.children', 'children')
				.where('owner.id = :ownerId', { ownerId: owner });
		} else if (typeName === RefreshTokenEntity.name) {
			// RefreshTokenEntity has owner and parent (no children)
			queryBuilder = queryBuilder
				.leftJoinAndSelect('token.owner', 'owner')
				.leftJoinAndSelect('token.parent', 'parent')
				.where('owner.id = :ownerId', { ownerId: owner });
		} else {
			// Generic query for unknown types - just filter by owner
			queryBuilder = queryBuilder
				.leftJoinAndSelect('token.owner', 'owner')
				.where('owner.id = :ownerId', { ownerId: owner });
		}

		const tokens = (await queryBuilder.getMany()) as TToken[];

		return tokens;
	}

	async findAllByOwnerType(ownerType: TokenOwnerType): Promise<LongLiveTokenEntity[]> {
		const repository = this.dataSource.getRepository(LongLiveTokenEntity);

		const tokens = await repository.find({
			where: { ownerType },
		});

		return tokens;
	}

	async findByOwnerId(ownerId: string, ownerType: TokenOwnerType): Promise<LongLiveTokenEntity[]> {
		const repository = this.dataSource.getRepository(LongLiveTokenEntity);

		const tokens = await repository.find({
			where: { tokenOwnerId: ownerId, ownerType },
		});

		return tokens;
	}

	async revokeByOwnerId(ownerId: string, ownerType: TokenOwnerType): Promise<void> {
		const repository = this.dataSource.getRepository(LongLiveTokenEntity);

		await repository.update({ tokenOwnerId: ownerId, ownerType }, { revoked: true });
	}

	async findOne<TToken extends TokenEntity>(id: string, type?: new (...args: any[]) => TToken): Promise<TToken | null> {
		return this.findByField('id', id, type);
	}

	async findByHashedToken<TToken extends TokenEntity>(
		token: string,
		type?: new (...args: any[]) => TToken,
	): Promise<TToken | null> {
		const hashedToken = hashToken(token);
		const allTokens = await this.findAll(type);

		for (const storedToken of allTokens) {
			if (hashedToken === storedToken.hashedToken) {
				return storedToken;
			}
		}

		return null;
	}

	async create<TToken extends TokenEntity, TCreateDTO extends CreateTokenDto>(createDto: TCreateDTO): Promise<TToken> {
		const { type } = createDto;

		if (!type) {
			this.logger.error('Validation failed: Missing required "type" property in data.');

			throw new AuthException('Token property type is required.');
		}

		// Extract entity relations BEFORE validation/transformation
		// toInstance uses plainToInstance which doesn't handle entity references properly
		let ownerEntity: UserEntity | undefined;
		let parentEntity: AccessTokenEntity | undefined;

		// Check if owner is an entity object (has id property and is not a string)
		if ('owner' in createDto && createDto.owner && typeof createDto.owner === 'object' && 'id' in createDto.owner) {
			ownerEntity = createDto.owner as UserEntity;
			// Remove entity from DTO to prevent issues with transformation
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			delete (createDto as any).owner;
		}

		// Check if parent is an entity object
		if ('parent' in createDto && createDto.parent && typeof createDto.parent === 'object' && 'id' in createDto.parent) {
			parentEntity = createDto.parent as AccessTokenEntity;
			// Remove entity from DTO to prevent issues with transformation
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			delete (createDto as any).parent;
		}

		const mapping = this.tokensMapperService.getMapping<TToken, TCreateDTO, any>(type);

		const dtoInstance = await this.validateDto<TCreateDTO>(mapping.createDto, createDto);

		const repository: Repository<TToken> = this.dataSource.getRepository(mapping.class);

		const existingTokens = await this.findAll(mapping.class);

		let existingToken: TToken | null = null;

		const hashedToken = hashToken(dtoInstance.token);

		for (const storedToken of existingTokens) {
			if (hashedToken === storedToken.hashedToken) {
				existingToken = storedToken;

				break;
			}
		}

		if (existingToken) {
			this.logger.warn('Token already exists.');

			throw new AuthException('A token with the same hash already exists.');
		}

		// Build the token entity directly without using toInstance for relations
		// toInstance doesn't properly handle entity references
		const token = new mapping.class();

		// Set scalar properties from DTO
		if (dtoInstance.id) {
			token.id = dtoInstance.id;
		}
		token.hashedToken = dtoInstance.token;
		if (dtoInstance.expiresAt) {
			token.expiresAt = dtoInstance.expiresAt;
		}

		// Set LongLiveToken specific properties
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		if ('ownerType' in dtoInstance && (dtoInstance as any).ownerType) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
			(token as any).ownerType = (dtoInstance as any).ownerType;
		}
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		if ('ownerId' in dtoInstance && (dtoInstance as any).ownerId) {
			// Use tokenOwnerId for LongLiveTokenEntity to avoid FK conflict with AccessTokenEntity.ownerId
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
			(token as any).tokenOwnerId = (dtoInstance as any).ownerId;
		}
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		if ('name' in dtoInstance && (dtoInstance as any).name) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
			(token as any).name = (dtoInstance as any).name;
		}
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		if ('description' in dtoInstance && (dtoInstance as any).description !== undefined) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
			(token as any).description = (dtoInstance as any).description;
		}

		// Set entity relations by setting the foreign key columns directly
		// This is more reliable than setting the relation entity
		if (ownerEntity) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			(token as any).ownerId = ownerEntity.id;
		}

		if (parentEntity) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			(token as any).parentId = parentEntity.id;
		}

		// Save the token - save returns the entity with the generated ID
		const savedResult = await repository.save(token);

		// Retrieve the saved token with its full relations
		const savedToken = await this.getOneOrThrow<TToken>(savedResult.id, mapping.class);

		return savedToken;
	}

	async update<TToken extends TokenEntity, TUpdateDTO extends UpdateTokenDto>(
		id: string,
		updateDto: TUpdateDTO,
	): Promise<TToken> {
		const token = await this.getOneOrThrow(id);

		const mapping = this.tokensMapperService.getMapping<TToken, any, TUpdateDTO>(token.type);

		const dtoInstance = await this.validateDto<TUpdateDTO>(mapping.updateDto, updateDto);

		const repository: Repository<TToken> = this.dataSource.getRepository(mapping.class);

		Object.assign(token, omitBy(toInstance(mapping.class, dtoInstance), isUndefined));

		await repository.save(token as TToken);

		const updatedToken = await this.getOneOrThrow<TToken>(token.id);

		return updatedToken;
	}

	async remove(id: string): Promise<void> {
		const token = await this.getOneOrThrow(id);

		await this.repository.remove(token);

		if ('children' in token && Array.isArray(token.children)) {
			for (const child of token.children || []) {
				await this.repository.remove(child as TokenEntity);
			}
		}

		this.logger.log(`Successfully removed token with id=${id}`);
	}

	async getOneOrThrow<TToken extends TokenEntity>(
		id: string,
		type?: new (...args: unknown[]) => TToken,
	): Promise<TToken> {
		const token = await this.findOne<TToken>(id, type);

		if (!token) {
			this.logger.error(`Token with id=${id} not found`);

			throw new AuthNotFoundException('Requested token does not exist');
		}

		return token;
	}

	private async findByField<TToken extends TokenEntity>(
		field: keyof TokenEntity,
		value: string | number | boolean,
		type?: new (...args: any[]) => TToken,
	): Promise<TToken | null> {
		const repository = this.dataSource.getRepository(type ?? TokenEntity);
		const typeName = type?.name;

		let queryBuilder = repository.createQueryBuilder('token');

		// Join relations based on token type
		if (typeName === AccessTokenEntity.name) {
			// AccessTokenEntity has owner and children (no parent)
			queryBuilder = queryBuilder
				.leftJoinAndSelect('token.owner', 'owner')
				.leftJoinAndSelect('token.children', 'children');
		} else if (typeName === RefreshTokenEntity.name) {
			// RefreshTokenEntity has owner and parent (no children)
			queryBuilder = queryBuilder.leftJoinAndSelect('token.owner', 'owner').leftJoinAndSelect('token.parent', 'parent');
		}
		// LongLiveTokenEntity has no relations to join

		queryBuilder = queryBuilder.where(`token.${field} = :fieldValue`, { fieldValue: value });

		const token = (await queryBuilder.getOne()) as TToken;

		if (!token) {
			this.logger.warn('Token not found');

			return null;
		}

		return token;
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

			throw new AuthValidationException('Provided token data are invalid.');
		}

		return dtoInstance;
	}
}
