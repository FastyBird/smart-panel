import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { createExtensionLogger } from '../../../common/logger';
import {
	ApiBadRequestResponse,
	ApiInternalServerErrorResponse,
	ApiSuccessResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { BUDDY_MODULE_API_TAG_NAME, BUDDY_MODULE_NAME } from '../buddy.constants';
import { MessagingProviderStatusesResponseModel } from '../models/messaging-provider-status.model';
import { ProviderStatusesResponseModel } from '../models/provider-status.model';
import {
	SttProviderStatusesResponseModel,
	TtsProviderStatusesResponseModel,
} from '../models/voice-provider-status.model';
import { BuddyProviderStatusService } from '../services/buddy-provider-status.service';
import { MessagingProviderStatusService } from '../services/messaging-provider-status.service';
import { SttProviderStatusService } from '../services/stt-provider-status.service';
import { TtsProviderStatusService } from '../services/tts-provider-status.service';

@ApiTags(BUDDY_MODULE_API_TAG_NAME)
@Controller('providers')
export class BuddyProvidersController {
	private readonly logger = createExtensionLogger(BUDDY_MODULE_NAME, 'BuddyProvidersController');

	constructor(
		private readonly providerStatusService: BuddyProviderStatusService,
		private readonly sttProviderStatusService: SttProviderStatusService,
		private readonly ttsProviderStatusService: TtsProviderStatusService,
		private readonly messagingProviderStatusService: MessagingProviderStatusService,
	) {}

	@ApiOperation({
		tags: [BUDDY_MODULE_API_TAG_NAME],
		summary: 'List provider statuses',
		description:
			'Retrieves the configuration status of all registered LLM providers, including whether each is enabled, configured, and currently selected.',
		operationId: 'get-buddy-module-provider-statuses',
	})
	@ApiSuccessResponse(ProviderStatusesResponseModel, 'A list of provider statuses successfully retrieved.')
	@ApiBadRequestResponse('Invalid request parameters')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	getProviderStatuses(): ProviderStatusesResponseModel {
		this.logger.debug('Fetching provider statuses');

		const statuses = this.providerStatusService.getProviderStatuses();

		this.logger.debug(`Retrieved ${statuses.length} provider statuses`);

		const response = new ProviderStatusesResponseModel();

		response.data = statuses;

		return response;
	}

	@ApiOperation({
		tags: [BUDDY_MODULE_API_TAG_NAME],
		summary: 'List STT provider statuses',
		description:
			'Retrieves the configuration status of all registered Speech-to-Text providers, including whether each is enabled, configured, and currently selected.',
		operationId: 'get-buddy-module-stt-provider-statuses',
	})
	@ApiSuccessResponse(SttProviderStatusesResponseModel, 'A list of STT provider statuses successfully retrieved.')
	@ApiBadRequestResponse('Invalid request parameters')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get('stt')
	getSttProviderStatuses(): SttProviderStatusesResponseModel {
		this.logger.debug('Fetching STT provider statuses');

		const statuses = this.sttProviderStatusService.getProviderStatuses();

		this.logger.debug(`Retrieved ${statuses.length} STT provider statuses`);

		const response = new SttProviderStatusesResponseModel();

		response.data = statuses;

		return response;
	}

	@ApiOperation({
		tags: [BUDDY_MODULE_API_TAG_NAME],
		summary: 'List TTS provider statuses',
		description:
			'Retrieves the configuration status of all registered Text-to-Speech providers, including whether each is enabled, configured, and currently selected.',
		operationId: 'get-buddy-module-tts-provider-statuses',
	})
	@ApiSuccessResponse(TtsProviderStatusesResponseModel, 'A list of TTS provider statuses successfully retrieved.')
	@ApiBadRequestResponse('Invalid request parameters')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get('tts')
	getTtsProviderStatuses(): TtsProviderStatusesResponseModel {
		this.logger.debug('Fetching TTS provider statuses');

		const statuses = this.ttsProviderStatusService.getProviderStatuses();

		this.logger.debug(`Retrieved ${statuses.length} TTS provider statuses`);

		const response = new TtsProviderStatusesResponseModel();

		response.data = statuses;

		return response;
	}

	@ApiOperation({
		tags: [BUDDY_MODULE_API_TAG_NAME],
		summary: 'List messaging provider statuses',
		description:
			'Retrieves the configuration status of all registered messaging adapter providers (Telegram, Discord, WhatsApp, etc.), including whether each is enabled and configured.',
		operationId: 'get-buddy-module-messaging-provider-statuses',
	})
	@ApiSuccessResponse(
		MessagingProviderStatusesResponseModel,
		'A list of messaging provider statuses successfully retrieved.',
	)
	@ApiBadRequestResponse('Invalid request parameters')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get('messaging')
	getMessagingProviderStatuses(): MessagingProviderStatusesResponseModel {
		this.logger.debug('Fetching messaging provider statuses');

		const statuses = this.messagingProviderStatusService.getProviderStatuses();

		this.logger.debug(`Retrieved ${statuses.length} messaging provider statuses`);

		const response = new MessagingProviderStatusesResponseModel();

		response.data = statuses;

		return response;
	}
}
