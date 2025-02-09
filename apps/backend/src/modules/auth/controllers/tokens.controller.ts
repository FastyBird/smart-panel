import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import get from 'lodash.get';

import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	ForbiddenException,
	Get,
	Header,
	Logger,
	NotFoundException,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	Req,
} from '@nestjs/common';

import { ValidationExceptionFactory } from '../../../common/validation/validation-exception-factory';
import { AuthModulePrefix, AuthenticatedRequest } from '../auth.constants';
import { AuthException } from '../auth.exceptions';
import { CreateTokenDto } from '../dto/create-token.dto';
import { UpdateTokenDto } from '../dto/update-token.dto';
import { AccessTokenEntity, TokenEntity } from '../entities/auth.entity';
import { TokenTypeMapping, TokensTypeMapperService } from '../services/tokens-type-mapper.service';
import { TokensService } from '../services/tokens.service';

@Controller('tokens')
export class TokensController {
	private readonly logger = new Logger(TokensController.name);

	constructor(
		private readonly tokensService: TokensService,
		private readonly tokensMapperService: TokensTypeMapperService,
	) {}

	@Get()
	async findAll(): Promise<TokenEntity[]> {
		this.logger.debug('[LOOKUP ALL] Fetching all tokens');

		const tokens = await this.tokensService.findAll<TokenEntity>();

		this.logger.debug(`[LOOKUP ALL] Retrieved ${tokens.length} tokens`);

		return tokens;
	}

	@Get(':id')
	async findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<TokenEntity> {
		this.logger.debug(`[LOOKUP] Fetching token id=${id}`);

		const token = await this.getOneOrThrow(id);

		this.logger.debug(`[LOOKUP] Found token id=${token.id}`);

		return token;
	}

	@Post()
	@Header('Location', `:baseUrl/${AuthModulePrefix}/auth/:id`)
	async create(@Body() createDto: any): Promise<TokenEntity> {
		this.logger.debug('[CREATE] Incoming request to create a new token');

		const type: string | undefined = get(createDto, 'type', undefined) as string | undefined;

		if (!type) {
			this.logger.error('[VALIDATION] Missing required field: type');

			throw new BadRequestException('Token property type is required.');
		}

		let mapping: TokenTypeMapping<TokenEntity, CreateTokenDto, UpdateTokenDto>;

		try {
			mapping = this.tokensMapperService.getMapping<TokenEntity, CreateTokenDto, UpdateTokenDto>(type);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[ERROR] Unsupported token type: ${type}`, { message: err.message, stack: err.stack });

			if (error instanceof AuthException) {
				throw new BadRequestException([JSON.stringify({ field: 'type', reason: `Unsupported token type: ${type}` })]);
			}

			throw error;
		}

		const dtoInstance = plainToInstance(mapping.createDto, createDto, {
			enableImplicitConversion: true,
			exposeUnsetFields: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION FAILED] Validation failed for token creation error=${JSON.stringify(errors)}`);

			throw ValidationExceptionFactory.createException(errors);
		}

		const token = await this.tokensService.create(createDto as CreateTokenDto);

		this.logger.debug(`[CREATE] Successfully created token id=${token.id}`);

		return token;
	}

	@Patch(':id')
	async update(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() updateDto: any,
	): Promise<TokenEntity> {
		this.logger.debug(`[UPDATE] Incoming update request for token id=${id}`);

		const token = await this.getOneOrThrow(id);

		let mapping: TokenTypeMapping<TokenEntity, CreateTokenDto, UpdateTokenDto>;

		try {
			mapping = this.tokensMapperService.getMapping<TokenEntity, CreateTokenDto, UpdateTokenDto>(token.type);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[ERROR] Unsupported token type for update: ${token.type}`, {
				message: err.message,
				stack: err.stack,
			});

			if (error instanceof AuthException) {
				throw new BadRequestException([
					JSON.stringify({ field: 'type', reason: `Unsupported token type: ${token.type}` }),
				]);
			}

			throw error;
		}

		const dtoInstance = plainToInstance(mapping.updateDto, updateDto, {
			enableImplicitConversion: true,
			exposeUnsetFields: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION FAILED] Validation failed for token modification error=${JSON.stringify(errors)}`);

			throw ValidationExceptionFactory.createException(errors);
		}

		const updatedToken = await this.tokensService.update(token.id, updateDto as UpdateTokenDto);

		this.logger.debug(`[UPDATE] Successfully updated token id=${updatedToken.id}`);

		return updatedToken;
	}

	@Delete(':id')
	async remove(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Req() req: AuthenticatedRequest,
	): Promise<void> {
		this.logger.debug(`[DELETE] Incoming request to delete token id=${id}`);

		const token = await this.getOneOrThrow(id);

		const { user: actualUser } = req;

		// Prevent token from deleting themselves
		if (token instanceof AccessTokenEntity && token.owner.id === actualUser.id) {
			throw new ForbiddenException('You cannot delete your own account');
		}

		await this.tokensService.remove(token.id);

		this.logger.debug(`[DELETE] Successfully deleted token id=${id}`);
	}

	private async getOneOrThrow(id: string): Promise<TokenEntity> {
		this.logger.debug(`[LOOKUP] Checking existence of token id=${id}`);

		const token = await this.tokensService.findOne<TokenEntity>(id);

		if (!token) {
			this.logger.error(`[ERROR] token with id=${id} not found`);

			throw new NotFoundException('Requested token does not exist');
		}

		return token;
	}
}
