import { validate } from 'class-validator';
import isUndefined from 'lodash.isundefined';
import omitBy from 'lodash.omitby';
import { DataSource, Repository } from 'typeorm';

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { toInstance } from '../../../common/utils/transform.utils';
import { AuthException, AuthNotFoundException, AuthValidationException } from '../auth.exceptions';
import { CreateTokenDto } from '../dto/create-token.dto';
import { UpdateTokenDto } from '../dto/update-token.dto';
import { TokenEntity } from '../entities/auth.entity';
import { hashToken } from '../utils/token.utils';

import { TokensTypeMapperService } from './tokens-type-mapper.service';

@Injectable()
export class TokensService {
	private readonly logger = new Logger(TokensService.name);

	constructor(
		@InjectRepository(TokenEntity)
		private readonly repository: Repository<TokenEntity>,
		private readonly tokensMapperService: TokensTypeMapperService,
		private readonly dataSource: DataSource,
	) {}

	async findAll<TToken extends TokenEntity>(type?: new (...args: any[]) => TToken): Promise<TToken[]> {
		this.logger.debug('[LOOKUP ALL] Fetching all tokens');

		const repository = this.dataSource.getRepository(type ?? TokenEntity);

		const tokens = (await repository
			.createQueryBuilder('token')
			.innerJoinAndSelect('token.owner', 'owner')
			.leftJoinAndSelect('token.parent', 'parent')
			.leftJoinAndSelect('token.children', 'children')
			.getMany()) as TToken[];

		this.logger.debug(`[LOOKUP ALL] Found ${tokens.length} tokens`);

		return tokens;
	}

	async findAllByOwner<TToken extends TokenEntity>(
		owner: string,
		type?: new (...args: any[]) => TToken,
	): Promise<TToken[]> {
		this.logger.debug('[LOOKUP ALL] Fetching all tokens');

		const repository = this.dataSource.getRepository(type ?? TokenEntity);

		const tokens = (await repository
			.createQueryBuilder('token')
			.innerJoinAndSelect('token.owner', 'owner')
			.leftJoinAndSelect('token.parent', 'parent')
			.leftJoinAndSelect('token.children', 'children')
			.where(`token.owner = :ownerId`, { ownerId: owner })
			.getMany()) as TToken[];

		this.logger.debug(`[LOOKUP ALL] Found ${tokens.length} tokens`);

		return tokens;
	}

	async findOne<TToken extends TokenEntity>(id: string, type?: new (...args: any[]) => TToken): Promise<TToken | null> {
		return this.findByField('id', id, type);
	}

	async create<TToken extends TokenEntity, TCreateDTO extends CreateTokenDto>(createDto: TCreateDTO): Promise<TToken> {
		this.logger.debug('[CREATE] Creating new token');

		const { type } = createDto;

		if (!type) {
			this.logger.error('[CREATE] Validation failed: Missing required "type" property in data.');

			throw new AuthException('Token property type is required.');
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
			this.logger.warn('[CREATE] Token already exists.');

			throw new AuthException('A token with the same hash already exists.');
		}

		const token = repository.create(toInstance(mapping.class, dtoInstance));

		token.hashedToken = dtoInstance.token;

		// Save the token
		await repository.save(token);

		// Retrieve the saved token with its full relations
		const savedToken = await this.getOneOrThrow<TToken>(token.id);

		this.logger.debug(`[CREATE] Successfully created token with id=${savedToken.id}`);

		return savedToken;
	}

	async update<TToken extends TokenEntity, TUpdateDTO extends UpdateTokenDto>(
		id: string,
		updateDto: TUpdateDTO,
	): Promise<TToken> {
		this.logger.debug(`[UPDATE] Updating token with id=${id}`);

		const token = await this.getOneOrThrow(id);

		const mapping = this.tokensMapperService.getMapping<TToken, any, TUpdateDTO>(token.type);

		const dtoInstance = await this.validateDto<TUpdateDTO>(mapping.updateDto, updateDto);

		const repository: Repository<TToken> = this.dataSource.getRepository(mapping.class);

		Object.assign(token, omitBy(toInstance(mapping.class, dtoInstance), isUndefined));

		await repository.save(token as TToken);

		const updatedToken = await this.getOneOrThrow<TToken>(token.id);

		this.logger.debug(`[UPDATE] Successfully updated token with id=${updatedToken.id}`);

		return updatedToken;
	}

	async remove(id: string): Promise<void> {
		this.logger.debug(`[DELETE] Removing token with id=${id}`);

		const token = await this.getOneOrThrow(id);

		await this.repository.remove(token);

		if ('children' in token && Array.isArray(token.children)) {
			for (const child of token.children || []) {
				await this.repository.remove(child as TokenEntity);
			}
		}

		this.logger.log(`[DELETE] Successfully removed token with id=${id}`);
	}

	async getOneOrThrow<TToken extends TokenEntity>(id: string): Promise<TToken> {
		const token = await this.findOne<TToken>(id);

		if (!token) {
			this.logger.error(`[ERROR] Token with id=${id} not found`);

			throw new AuthNotFoundException('Requested token does not exist');
		}

		return token;
	}

	private async findByField<TToken extends TokenEntity>(
		field: keyof TokenEntity,
		value: string | number | boolean,
		type?: new (...args: any[]) => TToken,
	): Promise<TToken | null> {
		this.logger.debug('[LOOKUP] Fetching token');

		const repository = this.dataSource.getRepository(type ?? TokenEntity);

		const token = (await repository
			.createQueryBuilder('token')
			.innerJoinAndSelect('token.owner', 'owner')
			.leftJoinAndSelect('token.parent', 'parent')
			.leftJoinAndSelect('token.children', 'children')
			.where(`token.${field} = :fieldValue`, { fieldValue: value })
			.getOne()) as TToken;

		if (!token) {
			this.logger.warn('[LOOKUP] Token not found');

			return null;
		}

		this.logger.debug('[LOOKUP] Successfully fetched token');

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
			this.logger.error(`[VALIDATION FAILED] ${JSON.stringify(errors)}`);

			throw new AuthValidationException('Provided token data are invalid.');
		}

		return dtoInstance;
	}
}
