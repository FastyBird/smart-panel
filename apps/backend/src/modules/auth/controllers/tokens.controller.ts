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
import { ApiBody, ApiExtraModels, ApiOperation, ApiParam, ApiResponse, ApiTags, getSchemaPath } from '@nestjs/swagger';

import {
	ApiBadRequestResponse,
	ApiForbiddenResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
} from '../../../common/decorators/api-documentation.decorator';
import { BaseSuccessResponseDto, SuccessMetadataDto } from '../../../common/dto/error-response.dto';
import { toInstance } from '../../../common/utils/transform.utils';
import { ValidationExceptionFactory } from '../../../common/validation/validation-exception-factory';
import { AUTH_MODULE_PREFIX, AuthenticatedRequest } from '../auth.constants';
import { AuthException } from '../auth.exceptions';
import {
	CreateAccessTokenDto,
	CreateLongLiveTokenDto,
	CreateRefreshTokenDto,
	CreateTokenDto,
	ReqCreateTokenDto,
} from '../dto/create-token.dto';
import {
	ReqUpdateTokenDto,
	UpdateAccessTokenDto,
	UpdateLongLiveTokenDto,
	UpdateRefreshTokenDto,
	UpdateTokenDto,
} from '../dto/update-token.dto';
import { AccessTokenEntity, LongLiveTokenEntity, RefreshTokenEntity, TokenEntity } from '../entities/auth.entity';
import { TokenTypeMapping, TokensTypeMapperService } from '../services/tokens-type-mapper.service';
import { TokensService } from '../services/tokens.service';

@ApiTags('auth-module')
@ApiExtraModels(
	BaseSuccessResponseDto,
	SuccessMetadataDto,
	AccessTokenEntity,
	RefreshTokenEntity,
	LongLiveTokenEntity,
	CreateAccessTokenDto,
	CreateRefreshTokenDto,
	CreateLongLiveTokenDto,
	UpdateAccessTokenDto,
	UpdateRefreshTokenDto,
	UpdateLongLiveTokenDto,
)
@Controller('tokens')
export class TokensController {
	private readonly logger = new Logger(TokensController.name);

	constructor(
		private readonly tokensService: TokensService,
		private readonly tokensMapperService: TokensTypeMapperService,
	) {}

	@Get()
	@ApiOperation({ summary: 'Get all tokens', description: 'Retrieve all authentication tokens' })
	@ApiResponse({
		status: 200,
		description: 'Tokens retrieved successfully',
		schema: {
			allOf: [
				{ $ref: getSchemaPath(BaseSuccessResponseDto) },
				{
					properties: {
						status: {
							type: 'string',
							enum: ['success'],
						},
						data: {
							type: 'array',
							items: {
								discriminator: {
									propertyName: 'type',
									mapping: {
										access: getSchemaPath(AccessTokenEntity),
										refresh: getSchemaPath(RefreshTokenEntity),
										long_live: getSchemaPath(LongLiveTokenEntity),
									},
								},
								oneOf: [
									{ $ref: getSchemaPath(AccessTokenEntity) },
									{ $ref: getSchemaPath(RefreshTokenEntity) },
									{ $ref: getSchemaPath(LongLiveTokenEntity) },
								],
							},
						},
						metadata: {
							$ref: getSchemaPath(SuccessMetadataDto),
						},
					},
				},
			],
		},
	})
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
	@ApiResponse({
		status: 200,
		description: 'Token retrieved successfully',
		schema: {
			allOf: [
				{ $ref: getSchemaPath(BaseSuccessResponseDto) },
				{
					properties: {
						status: {
							type: 'string',
							enum: ['success'],
						},
						data: {
							discriminator: {
								propertyName: 'type',
								mapping: {
									access: getSchemaPath(AccessTokenEntity),
									refresh: getSchemaPath(RefreshTokenEntity),
									long_live: getSchemaPath(LongLiveTokenEntity),
								},
							},
							oneOf: [
								{ $ref: getSchemaPath(AccessTokenEntity) },
								{ $ref: getSchemaPath(RefreshTokenEntity) },
								{ $ref: getSchemaPath(LongLiveTokenEntity) },
							],
						},
						metadata: {
							$ref: getSchemaPath(SuccessMetadataDto),
						},
					},
				},
			],
		},
	})
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
	@ApiResponse({
		status: 201,
		description: 'Token created successfully',
		schema: {
			allOf: [
				{ $ref: getSchemaPath(BaseSuccessResponseDto) },
				{
					properties: {
						status: {
							type: 'string',
							enum: ['success'],
						},
						data: {
							discriminator: {
								propertyName: 'type',
								mapping: {
									access: getSchemaPath(AccessTokenEntity),
									refresh: getSchemaPath(RefreshTokenEntity),
									long_live: getSchemaPath(LongLiveTokenEntity),
								},
							},
							oneOf: [
								{ $ref: getSchemaPath(AccessTokenEntity) },
								{ $ref: getSchemaPath(RefreshTokenEntity) },
								{ $ref: getSchemaPath(LongLiveTokenEntity) },
							],
						},
						metadata: {
							$ref: getSchemaPath(SuccessMetadataDto),
						},
					},
				},
			],
		},
	})
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
	@ApiResponse({
		status: 200,
		description: 'Token updated successfully',
		schema: {
			allOf: [
				{ $ref: getSchemaPath(BaseSuccessResponseDto) },
				{
					properties: {
						status: {
							type: 'string',
							enum: ['success'],
						},
						data: {
							discriminator: {
								propertyName: 'type',
								mapping: {
									access: getSchemaPath(AccessTokenEntity),
									refresh: getSchemaPath(RefreshTokenEntity),
									long_live: getSchemaPath(LongLiveTokenEntity),
								},
							},
							oneOf: [
								{ $ref: getSchemaPath(AccessTokenEntity) },
								{ $ref: getSchemaPath(RefreshTokenEntity) },
								{ $ref: getSchemaPath(LongLiveTokenEntity) },
							],
						},
						metadata: {
							$ref: getSchemaPath(SuccessMetadataDto),
						},
					},
				},
			],
		},
	})
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
	@ApiResponse({ status: 204, description: 'Token deleted successfully' })
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
