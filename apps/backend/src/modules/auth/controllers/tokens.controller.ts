import { validate } from 'class-validator';
import { FastifyRequest as Request, FastifyReply as Response } from 'fastify';

import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	ForbiddenException,
	Get,
	HttpCode,
	NotFoundException,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	Req,
	Res,
} from '@nestjs/common';
import { ApiBody, ApiNoContentResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import { ValidationExceptionFactory } from '../../../common/validation/validation-exception-factory';
import { setLocationHeader } from '../../api/utils/location-header.utils';
import {
	ApiBadRequestResponse,
	ApiCreatedSuccessResponse,
	ApiForbiddenResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { AUTH_MODULE_API_TAG_NAME, AUTH_MODULE_NAME, AUTH_MODULE_PREFIX } from '../auth.constants';
import { AuthException } from '../auth.exceptions';
import { CreateTokenDto, ReqCreateTokenDto } from '../dto/create-token.dto';
import { ReqUpdateTokenDto, UpdateTokenDto } from '../dto/update-token.dto';
import { AccessTokenEntity, TokenEntity } from '../entities/auth.entity';
import { AuthenticatedRequest } from '../guards/auth.guard';
import { TokenResponseModel, TokensResponseModel } from '../models/auth-response.model';
import { TokenTypeMapping, TokensTypeMapperService } from '../services/tokens-type-mapper.service';
import { TokensService } from '../services/tokens.service';

@ApiTags(AUTH_MODULE_API_TAG_NAME)
@Controller('tokens')
export class TokensController {
	private readonly logger = createExtensionLogger(AUTH_MODULE_NAME, 'TokensController');

	constructor(
		private readonly tokensService: TokensService,
		private readonly tokensMapperService: TokensTypeMapperService,
	) {}

	@ApiOperation({
		tags: [AUTH_MODULE_API_TAG_NAME],
		summary: 'Get all tokens',
		description: 'Retrieve all authentication tokens',
		operationId: 'get-auth-module-tokens',
	})
	@ApiSuccessResponse(TokensResponseModel, 'Tokens retrieved successfully')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	async findAll(): Promise<TokensResponseModel> {
		this.logger.debug('Fetching all tokens');

		const tokens = await this.tokensService.findAll<TokenEntity>();

		this.logger.debug(`Retrieved ${tokens.length} tokens`);
		const response = new TokensResponseModel();
		response.data = tokens;

		return response;
	}

	@ApiOperation({
		tags: [AUTH_MODULE_API_TAG_NAME],
		summary: 'Get token by ID',
		description: 'Retrieve a specific authentication token by its ID',
		operationId: 'get-auth-module-token',
	})
	@ApiParam({ name: 'id', description: 'Token ID', type: 'string', format: 'uuid' })
	@ApiSuccessResponse(TokenResponseModel, 'Token retrieved successfully')
	@ApiNotFoundResponse('Token not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get(':id')
	async findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<TokenResponseModel> {
		this.logger.debug(`Fetching token id=${id}`);

		const token = await this.getOneOrThrow(id);

		this.logger.debug(`Found token id=${token.id}`);

		const response = new TokenResponseModel();
		response.data = token;

		return response;
	}

	@ApiOperation({
		tags: [AUTH_MODULE_API_TAG_NAME],
		summary: 'Create new token',
		description: 'Create a new authentication token',
		operationId: 'create-auth-module-token',
	})
	@ApiBody({
		description: 'Token creation data with discriminated type',
		type: ReqCreateTokenDto,
	})
	@ApiCreatedSuccessResponse(
		TokenResponseModel,
		'Token created successfully',
		'/api/v1/modlues/auth/auth/123e4567-e89b-12d3-a456-426614174000',
	)
	@ApiBadRequestResponse('Invalid token data or unsupported token type')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post()
	async create(
		@Body() createDto: ReqCreateTokenDto,
		@Res({ passthrough: true }) res: Response,
		@Req() req: Request,
	): Promise<TokenResponseModel> {
		this.logger.debug('Incoming request to create a new token');

		const type: string | undefined = createDto.data.type;

		if (!type) {
			this.logger.error('Missing required field: type');

			throw new BadRequestException('Token property type is required.');
		}

		let mapping: TokenTypeMapping<TokenEntity, CreateTokenDto, UpdateTokenDto>;

		try {
			mapping = this.tokensMapperService.getMapping<TokenEntity, CreateTokenDto, UpdateTokenDto>(type);
		} catch (error: unknown) {
			const err = error instanceof Error ? error : new Error('Unknown token mapping error');

			this.logger.error(`Unsupported token type: ${type}`, { message: err.message, stack: err.stack });

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
			this.logger.error(`Validation failed for token creation error=${JSON.stringify(errors)}`);

			throw ValidationExceptionFactory.createException(errors);
		}

		const token = await this.tokensService.create(createDto.data);

		this.logger.debug(`Successfully created token id=${token.id}`);

		setLocationHeader(req, res, AUTH_MODULE_PREFIX, 'auth', token.id);

		const response = new TokenResponseModel();

		response.data = token;

		return response;
	}

	@ApiOperation({
		tags: [AUTH_MODULE_API_TAG_NAME],
		summary: 'Update token',
		description: 'Update an existing authentication token',
		operationId: 'update-auth-module-token',
	})
	@ApiParam({ name: 'id', description: 'Token ID', type: 'string', format: 'uuid' })
	@ApiBody({
		description: 'Token update data (only certain fields can be updated)',
		type: ReqUpdateTokenDto,
	})
	@ApiSuccessResponse(TokenResponseModel, 'Token updated successfully')
	@ApiBadRequestResponse('Invalid token data or unsupported token type')
	@ApiNotFoundResponse('Token not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Patch(':id')
	async update(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() updateDto: ReqUpdateTokenDto,
	): Promise<TokenResponseModel> {
		this.logger.debug(`Incoming update request for token id=${id}`);

		const token = await this.getOneOrThrow(id);

		let mapping: TokenTypeMapping<TokenEntity, CreateTokenDto, UpdateTokenDto>;

		try {
			mapping = this.tokensMapperService.getMapping<TokenEntity, CreateTokenDto, UpdateTokenDto>(token.type);
		} catch (error: unknown) {
			const err = error instanceof Error ? error : new Error('Unknown token mapping error');

			this.logger.error(`Unsupported token type for update: ${token.type}`, {
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
			this.logger.error(`Validation failed for token modification error=${JSON.stringify(errors)}`);

			throw ValidationExceptionFactory.createException(errors);
		}

		const updatedToken = await this.tokensService.update(token.id, updateDto.data);

		this.logger.debug(`Successfully updated token id=${updatedToken.id}`);

		const response = new TokenResponseModel();

		response.data = updatedToken;

		return response;
	}

	@ApiOperation({
		tags: [AUTH_MODULE_API_TAG_NAME],
		summary: 'Delete token',
		description: 'Delete an authentication token',
		operationId: 'delete-auth-module-token',
	})
	@ApiParam({ name: 'id', description: 'Token ID', type: 'string', format: 'uuid' })
	@ApiNoContentResponse({ description: 'Token deleted successfully' })
	@ApiForbiddenResponse('Cannot delete your own access token')
	@ApiNotFoundResponse('Token not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@HttpCode(204)
	@Delete(':id')
	async remove(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Req() req: AuthenticatedRequest,
	): Promise<void> {
		this.logger.debug(`Incoming request to delete token id=${id}`);

		const token = await this.getOneOrThrow(id);

		const { auth } = req;

		// Prevent token from deleting themselves
		if (auth && auth.type === 'user' && token instanceof AccessTokenEntity && token.owner.id === auth.id) {
			throw new ForbiddenException('You cannot delete your own account');
		}

		await this.tokensService.remove(token.id);

		this.logger.debug(`Successfully deleted token id=${id}`);
	}

	private async getOneOrThrow(id: string): Promise<TokenEntity> {
		this.logger.debug(`Checking existence of token id=${id}`);

		const token = await this.tokensService.findOne<TokenEntity>(id);

		if (!token) {
			this.logger.error(`token with id=${id} not found`);

			throw new NotFoundException('Requested token does not exist');
		}

		return token;
	}
}
