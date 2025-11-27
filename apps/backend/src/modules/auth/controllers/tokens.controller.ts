import { validate } from 'class-validator';

import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	ForbiddenException,
	Get,
	Header,
	HttpCode,
	Logger,
	NotFoundException,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	Req,
} from '@nestjs/common';
import { ApiBody, ApiNoContentResponse, ApiOperation, ApiParam, getSchemaPath } from '@nestjs/swagger';

import {
	ApiBadRequestResponse,
	ApiCreatedSuccessDiscriminatedResponse,
	ApiForbiddenResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessArrayDiscriminatedResponse,
	ApiSuccessDiscriminatedResponse,
} from '../../api/decorators/api-documentation.decorator';
import { ApiTag } from '../../api/decorators/api-tag.decorator';
import { toInstance } from '../../../common/utils/transform.utils';
import { ValidationExceptionFactory } from '../../../common/validation/validation-exception-factory';
import {
	AUTH_MODULE_API_TAG_DESCRIPTION,
	AUTH_MODULE_API_TAG_NAME,
	AUTH_MODULE_NAME,
	AUTH_MODULE_PREFIX,
} from '../auth.constants';
import { AuthenticatedRequest } from '../auth.constants';
import { AuthException } from '../auth.exceptions';
import { CreateTokenDto, ReqCreateTokenDto } from '../dto/create-token.dto';
import { ReqUpdateTokenDto, UpdateTokenDto } from '../dto/update-token.dto';
import { AccessTokenEntity, LongLiveTokenEntity, RefreshTokenEntity, TokenEntity } from '../entities/auth.entity';
import { TokenTypeMapping, TokensTypeMapperService } from '../services/tokens-type-mapper.service';
import { TokensService } from '../services/tokens.service';

@ApiTag({
	tagName: AUTH_MODULE_NAME,
	displayName: AUTH_MODULE_API_TAG_NAME,
	description: AUTH_MODULE_API_TAG_DESCRIPTION,
})
@Controller('tokens')
export class TokensController {
	private readonly logger = new Logger(TokensController.name);

	constructor(
		private readonly tokensService: TokensService,
		private readonly tokensMapperService: TokensTypeMapperService,
	) {}

	@Get()
	@ApiOperation({ summary: 'Get all tokens', description: 'Retrieve all authentication tokens' })
	@ApiSuccessArrayDiscriminatedResponse(
		'type',
		{
			access: getSchemaPath(AccessTokenEntity),
			refresh: getSchemaPath(RefreshTokenEntity),
			long_live: getSchemaPath(LongLiveTokenEntity),
		},
		[AccessTokenEntity, RefreshTokenEntity, LongLiveTokenEntity],
		'Tokens retrieved successfully',
	)
	@ApiInternalServerErrorResponse()
	async findAll(): Promise<TokenEntity[]> {
		this.logger.debug('[LOOKUP ALL] Fetching all tokens');

		const tokens = await this.tokensService.findAll<TokenEntity>();

		this.logger.debug(`[LOOKUP ALL] Retrieved ${tokens.length} tokens`);

		return tokens;
	}

	@Get(':id')
	@ApiOperation({ summary: 'Get token by ID', description: 'Retrieve a specific authentication token by its ID' })
	@ApiParam({ name: 'id', description: 'Token ID', type: 'string', format: 'uuid' })
	@ApiSuccessDiscriminatedResponse(
		'type',
		{
			access: getSchemaPath(AccessTokenEntity),
			refresh: getSchemaPath(RefreshTokenEntity),
			long_live: getSchemaPath(LongLiveTokenEntity),
		},
		[AccessTokenEntity, RefreshTokenEntity, LongLiveTokenEntity],
		'Token retrieved successfully',
	)
	@ApiNotFoundResponse('Token not found')
	@ApiInternalServerErrorResponse()
	async findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<TokenEntity> {
		this.logger.debug(`[LOOKUP] Fetching token id=${id}`);

		const token = await this.getOneOrThrow(id);

		this.logger.debug(`[LOOKUP] Found token id=${token.id}`);

		return token;
	}

	@Post()
	@Header('Location', `:baseUrl/${AUTH_MODULE_PREFIX}/auth/:id`)
	@ApiOperation({ summary: 'Create new token', description: 'Create a new authentication token' })
	@ApiBody({
		description: 'Token creation data with discriminated type',
		type: ReqCreateTokenDto,
	})
	@ApiCreatedSuccessDiscriminatedResponse(
		'type',
		{
			access: getSchemaPath(AccessTokenEntity),
			refresh: getSchemaPath(RefreshTokenEntity),
			long_live: getSchemaPath(LongLiveTokenEntity),
		},
		[AccessTokenEntity, RefreshTokenEntity, LongLiveTokenEntity],
		'Token created successfully',
	)
	@ApiBadRequestResponse('Invalid token data or unsupported token type')
	@ApiInternalServerErrorResponse()
	async create(@Body() createDto: ReqCreateTokenDto): Promise<TokenEntity> {
		this.logger.debug('[CREATE] Incoming request to create a new token');

		const type: string | undefined = createDto.data.type;

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

		const dtoInstance = toInstance(mapping.createDto, createDto.data, {
			excludeExtraneousValues: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
			stopAtFirstError: false,
		});

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION FAILED] Validation failed for token creation error=${JSON.stringify(errors)}`);

			throw ValidationExceptionFactory.createException(errors);
		}

		const token = await this.tokensService.create(createDto.data);

		this.logger.debug(`[CREATE] Successfully created token id=${token.id}`);

		return token;
	}

	@Patch(':id')
	@ApiOperation({ summary: 'Update token', description: 'Update an existing authentication token' })
	@ApiParam({ name: 'id', description: 'Token ID', type: 'string', format: 'uuid' })
	@ApiBody({
		description: 'Token update data (only certain fields can be updated)',
		type: ReqUpdateTokenDto,
	})
	@ApiSuccessDiscriminatedResponse(
		'type',
		{
			access: getSchemaPath(AccessTokenEntity),
			refresh: getSchemaPath(RefreshTokenEntity),
			long_live: getSchemaPath(LongLiveTokenEntity),
		},
		[AccessTokenEntity, RefreshTokenEntity, LongLiveTokenEntity],
		'Token updated successfully',
	)
	@ApiBadRequestResponse('Invalid token data or unsupported token type')
	@ApiNotFoundResponse('Token not found')
	@ApiInternalServerErrorResponse()
	async update(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() updateDto: ReqUpdateTokenDto,
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

		const dtoInstance = toInstance(mapping.updateDto, updateDto.data, {
			excludeExtraneousValues: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
			stopAtFirstError: false,
		});

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION FAILED] Validation failed for token modification error=${JSON.stringify(errors)}`);

			throw ValidationExceptionFactory.createException(errors);
		}

		const updatedToken = await this.tokensService.update(token.id, updateDto.data);

		this.logger.debug(`[UPDATE] Successfully updated token id=${updatedToken.id}`);

		return updatedToken;
	}

	@Delete(':id')
	@HttpCode(204)
	@ApiOperation({ summary: 'Delete token', description: 'Delete an authentication token' })
	@ApiParam({ name: 'id', description: 'Token ID', type: 'string', format: 'uuid' })
	@ApiNoContentResponse({ description: 'Token deleted successfully' })
	@ApiForbiddenResponse('Cannot delete your own access token')
	@ApiNotFoundResponse('Token not found')
	@ApiInternalServerErrorResponse()
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
