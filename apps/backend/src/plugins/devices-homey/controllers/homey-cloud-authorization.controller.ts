import { FastifyReply } from 'fastify';

import {
	BadRequestException,
	Body,
	ConflictException,
	Controller,
	ForbiddenException,
	GatewayTimeoutException,
	Get,
	HttpCode,
	InternalServerErrorException,
	Param,
	Post,
	Query,
	Req,
	Res,
	ServiceUnavailableException,
	UnprocessableEntityException,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';

import { AuthenticatedRequest, Public } from '../../../modules/auth/guards/auth.guard';
import {
	ApiBadRequestResponse,
	ApiForbiddenResponse,
	ApiInternalServerErrorResponse,
	ApiSeeOtherResponse,
	ApiServiceUnavailableResponse,
	ApiSuccessResponse,
	ApiUnprocessableEntityResponse,
} from '../../../modules/swagger/decorators/api-documentation.decorator';
import { Roles } from '../../../modules/users/guards/roles.guard';
import { UserRole } from '../../../modules/users/users.constants';
import {
	DEVICES_HOMEY_PLUGIN_API_TAG_NAME,
	HOMEY_CLOUD_MAX_AUTHORIZATION_CODE_LENGTH,
	HOMEY_CLOUD_MAX_TRANSACTION_ID_LENGTH,
} from '../devices-homey.constants';
import {
	HomeyCloudAuthorizationSelectionRequestDto,
	HomeyCloudAuthorizationTransactionRequestDto,
} from '../dto/cloud-authorization.dto';
import {
	HomeyCloudAuthorizationCapacityError,
	HomeyCloudAuthorizationStateError,
	HomeyCloudConfigurationError,
	HomeyCloudProviderError,
	HomeyCloudProviderErrorCategory,
	HomeyCloudSelectionError,
} from '../errors/homey-cloud-authorization.error';
import {
	HomeyCloudGrantAuthorityError,
	HomeyCloudGrantConflictError,
	HomeyCloudGrantStateError,
} from '../errors/homey-cloud-grant.error';
import {
	HomeyCloudAuthorizationCompletionModel,
	HomeyCloudAuthorizationCompletionResponseModel,
	HomeyCloudAuthorizationCompletionStatus,
	HomeyCloudAuthorizationStartModel,
	HomeyCloudAuthorizationStartResponseModel,
	HomeyCloudChoiceModel,
	HomeyCloudChoicesModel,
	HomeyCloudChoicesResponseModel,
} from '../models/cloud-authorization.model';
import { HomeyCloudAuthorizationHttpService } from '../services/homey-cloud-authorization-http.service';

type CallbackQuery = Record<string, unknown>;

@ApiTags(DEVICES_HOMEY_PLUGIN_API_TAG_NAME)
@Controller('oauth')
export class HomeyCloudAuthorizationController {
	constructor(private readonly cloudAuthorization: HomeyCloudAuthorizationHttpService) {}

	@ApiOperation({
		tags: [DEVICES_HOMEY_PLUGIN_API_TAG_NAME],
		summary: 'Start Homey Cloud authorization',
		description:
			'Creates a bounded, single-use authorization transaction for the authenticated owner or administrator.',
		operationId: 'start-devices-homey-plugin-cloud-authorization',
	})
	@ApiSuccessResponse(HomeyCloudAuthorizationStartResponseModel, 'Homey Cloud authorization started successfully')
	@ApiForbiddenResponse('The authenticated credential is not associated with an authorized user')
	@ApiServiceUnavailableResponse('Homey Cloud authorization is not configured or is temporarily unavailable')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post('authorize')
	@HttpCode(200)
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	async start(@Req() request: AuthenticatedRequest): Promise<HomeyCloudAuthorizationStartResponseModel> {
		return this.run(() => this.createStartResponse(this.getActorId(request)));
	}

	@ApiOperation({
		tags: [DEVICES_HOMEY_PLUGIN_API_TAG_NAME],
		summary: 'Restart Homey Cloud authorization',
		description:
			'Starts a replacement authorization transaction without exposing or mutating the active grant until activation.',
		operationId: 'reconnect-devices-homey-plugin-cloud-authorization',
	})
	@ApiSuccessResponse(HomeyCloudAuthorizationStartResponseModel, 'Homey Cloud reauthorization started successfully')
	@ApiForbiddenResponse('The authenticated credential is not associated with an authorized user')
	@ApiServiceUnavailableResponse('Homey Cloud authorization is not configured or is temporarily unavailable')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post('reconnect')
	@HttpCode(200)
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	async reconnect(@Req() request: AuthenticatedRequest): Promise<HomeyCloudAuthorizationStartResponseModel> {
		return this.run(() => this.createStartResponse(this.getActorId(request)));
	}

	@ApiOperation({
		tags: [DEVICES_HOMEY_PLUGIN_API_TAG_NAME],
		summary: 'Complete Homey Cloud authorization callback',
		description:
			'Consumes the exact one-time state before any provider exchange and always redirects to a query-free same-origin result page.',
		operationId: 'complete-devices-homey-plugin-cloud-authorization',
	})
	@ApiQuery({ name: 'code', required: false, type: String, description: 'Provider authorization code' })
	@ApiQuery({ name: 'state', required: false, type: String, description: 'Single-use authorization state' })
	@ApiQuery({ name: 'error', required: false, type: String, description: 'Provider cancellation or error category' })
	@ApiSeeOtherResponse('Redirect to the clean Homey plugin configuration page')
	@Get('callback')
	@Public()
	async callback(@Query() query: CallbackQuery, @Res() reply: FastifyReply): Promise<void> {
		try {
			await this.cloudAuthorization.completeCallback({
				code: this.readQueryString(query.code, HOMEY_CLOUD_MAX_AUTHORIZATION_CODE_LENGTH),
				providerError: query.error !== undefined,
				state: this.readQueryString(query.state, HOMEY_CLOUD_MAX_AUTHORIZATION_CODE_LENGTH),
			});
		} catch {
			// The callback must always leave the credential-bearing request target through the same clean redirect.
		}

		void reply
			.header('Cache-Control', 'no-store')
			.header('Pragma', 'no-cache')
			.header('Referrer-Policy', 'no-referrer')
			.redirect(this.cloudAuthorization.getResultUrl(), 303);
	}

	@ApiOperation({
		tags: [DEVICES_HOMEY_PLUGIN_API_TAG_NAME],
		summary: 'List Homeys for a cloud authorization transaction',
		description: 'Returns only eligible, sanitized Homey choices bound to the authenticated initiating user.',
		operationId: 'list-devices-homey-plugin-cloud-authorization-homeys',
	})
	@ApiParam({ name: 'transactionId', schema: { type: 'string', maxLength: HOMEY_CLOUD_MAX_TRANSACTION_ID_LENGTH } })
	@ApiSuccessResponse(HomeyCloudChoicesResponseModel, 'Eligible Homeys retrieved successfully')
	@ApiBadRequestResponse('Invalid authorization transaction identifier')
	@ApiForbiddenResponse('The transaction is no longer authorized for this user')
	@ApiServiceUnavailableResponse('The Homey Cloud provider is temporarily unavailable')
	@ApiUnprocessableEntityResponse('No eligible Homey is available')
	@Get('transactions/:transactionId/homeys')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	async listHomeys(
		@Param('transactionId') transactionId: string,
		@Req() request: AuthenticatedRequest,
	): Promise<HomeyCloudChoicesResponseModel> {
		return this.run(async () => {
			const choices = await this.cloudAuthorization.listHomeys(transactionId, this.getActorId(request));
			const response = new HomeyCloudChoicesResponseModel();

			response.data = Object.assign(new HomeyCloudChoicesModel(), {
				homeys: choices.map((choice) => Object.assign(new HomeyCloudChoiceModel(), choice)),
			});

			return response;
		});
	}

	@ApiOperation({
		tags: [DEVICES_HOMEY_PLUGIN_API_TAG_NAME],
		summary: 'Select a Homey for cloud authorization',
		description: 'Activates only an eligible Homey from the exact transaction bound to the initiating user.',
		operationId: 'select-devices-homey-plugin-cloud-authorization-homey',
	})
	@ApiBody({ type: HomeyCloudAuthorizationSelectionRequestDto })
	@ApiSuccessResponse(HomeyCloudAuthorizationCompletionResponseModel, 'Selected Homey activated successfully')
	@ApiBadRequestResponse('Invalid Homey authorization selection')
	@ApiForbiddenResponse('The transaction is no longer authorized for this user')
	@ApiServiceUnavailableResponse('The Homey Cloud provider is temporarily unavailable')
	@Post('select')
	@HttpCode(200)
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	async select(
		@Body() body: HomeyCloudAuthorizationSelectionRequestDto,
		@Req() request: AuthenticatedRequest,
	): Promise<HomeyCloudAuthorizationCompletionResponseModel> {
		return this.run(async () => {
			const result = await this.cloudAuthorization.selectHomey(
				body.data.transactionId,
				this.getActorId(request),
				body.data.homeyId,
			);

			return this.createCompletionResponse(HomeyCloudAuthorizationCompletionStatus.CONNECTED, true, result.homey.id);
		});
	}

	@ApiOperation({
		tags: [DEVICES_HOMEY_PLUGIN_API_TAG_NAME],
		summary: 'Cancel Homey Cloud authorization',
		description: 'Deletes only the pending authorization transaction owned by the authenticated initiating user.',
		operationId: 'cancel-devices-homey-plugin-cloud-authorization',
	})
	@ApiBody({ type: HomeyCloudAuthorizationTransactionRequestDto })
	@ApiSuccessResponse(HomeyCloudAuthorizationCompletionResponseModel, 'Authorization transaction cancelled')
	@ApiBadRequestResponse('Invalid authorization transaction')
	@ApiForbiddenResponse('The authenticated credential is not associated with an authorized user')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post('cancel')
	@HttpCode(200)
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	async cancel(
		@Body() body: HomeyCloudAuthorizationTransactionRequestDto,
		@Req() request: AuthenticatedRequest,
	): Promise<HomeyCloudAuthorizationCompletionResponseModel> {
		return this.run(async () => {
			const changed = await this.cloudAuthorization.cancel(body.data.transactionId, this.getActorId(request));

			return this.createCompletionResponse(HomeyCloudAuthorizationCompletionStatus.CANCELLED, changed);
		});
	}

	@ApiOperation({
		tags: [DEVICES_HOMEY_PLUGIN_API_TAG_NAME],
		summary: 'Disconnect Homey Cloud',
		description: 'Revokes the active local cloud grant reference and every pending cloud authorization transaction.',
		operationId: 'disconnect-devices-homey-plugin-cloud-authorization',
	})
	@ApiSuccessResponse(HomeyCloudAuthorizationCompletionResponseModel, 'Homey Cloud disconnected')
	@ApiForbiddenResponse('The authenticated credential is not associated with an authorized user')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post('disconnect')
	@HttpCode(200)
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	async disconnect(@Req() request: AuthenticatedRequest): Promise<HomeyCloudAuthorizationCompletionResponseModel> {
		return this.run(async () => {
			const changed = await this.cloudAuthorization.disconnect(this.getActorId(request));

			return this.createCompletionResponse(HomeyCloudAuthorizationCompletionStatus.DISCONNECTED, changed);
		});
	}

	private async createStartResponse(initiatingUserId: string): Promise<HomeyCloudAuthorizationStartResponseModel> {
		const flow = await this.cloudAuthorization.start(initiatingUserId);
		const response = new HomeyCloudAuthorizationStartResponseModel();

		response.data = Object.assign(new HomeyCloudAuthorizationStartModel(), {
			authorizeUrl: flow.authorizeUrl,
			transactionId: flow.transactionId,
			expiresAt: flow.expiresAt.toISOString(),
		});

		return response;
	}

	private createCompletionResponse(
		status: HomeyCloudAuthorizationCompletionStatus,
		changed: boolean,
		homeyId: string | null = null,
	): HomeyCloudAuthorizationCompletionResponseModel {
		const response = new HomeyCloudAuthorizationCompletionResponseModel();

		response.data = Object.assign(new HomeyCloudAuthorizationCompletionModel(), { status, changed, homeyId });

		return response;
	}

	private getActorId(request: AuthenticatedRequest): string {
		if (request.auth?.type === 'user') return request.auth.id;
		if (request.auth?.type === 'token' && request.auth.ownerId) return request.auth.ownerId;

		throw new ForbiddenException('The authenticated credential is not associated with a user');
	}

	private readQueryString(value: unknown, maximumLength: number): string | undefined {
		return typeof value === 'string' && value.length > 0 && value.length <= maximumLength ? value : undefined;
	}

	private async run<T>(operation: () => Promise<T>): Promise<T> {
		try {
			return await operation();
		} catch (error) {
			throw this.toHttpException(error);
		}
	}

	private toHttpException(error: unknown): Error {
		if (error instanceof ForbiddenException) return error;
		if (error instanceof HomeyCloudGrantAuthorityError) {
			return new ForbiddenException('Homey Cloud authorization authority is no longer valid');
		}
		if (error instanceof HomeyCloudAuthorizationStateError || error instanceof HomeyCloudGrantConflictError) {
			return new ConflictException('Homey Cloud authorization transaction is invalid, expired, or no longer current');
		}
		if (error instanceof HomeyCloudSelectionError) {
			return new BadRequestException('The selected Homey is not available for this authorization transaction');
		}
		if (error instanceof HomeyCloudProviderError) return this.providerHttpException(error.category);
		if (
			error instanceof HomeyCloudConfigurationError ||
			error instanceof HomeyCloudAuthorizationCapacityError ||
			error instanceof HomeyCloudGrantStateError
		) {
			return new ServiceUnavailableException('Homey Cloud authorization is temporarily unavailable');
		}
		if (error instanceof TypeError) return new BadRequestException('Homey Cloud authorization request is invalid');

		return new InternalServerErrorException('Homey Cloud authorization could not be completed');
	}

	private providerHttpException(category: HomeyCloudProviderErrorCategory): Error {
		if (category === HomeyCloudProviderErrorCategory.TIMEOUT) {
			return new GatewayTimeoutException('The Homey Cloud provider did not respond in time');
		}
		if (category === HomeyCloudProviderErrorCategory.NO_ELIGIBLE_HOMEYS) {
			return new UnprocessableEntityException('No eligible Homey is available for this account');
		}
		if (
			category === HomeyCloudProviderErrorCategory.INVALID_GRANT ||
			category === HomeyCloudProviderErrorCategory.INVALID_TOKEN
		) {
			return new ConflictException('Homey Cloud authorization must be restarted');
		}

		return new ServiceUnavailableException('The Homey Cloud provider is temporarily unavailable');
	}
}
