import { isUUID } from 'class-validator';
import { FastifyReply } from 'fastify';

import {
	BadRequestException,
	Body,
	Controller,
	HttpCode,
	HttpStatus,
	NotFoundException,
	Param,
	ParseUUIDPipe,
	Post,
	Res,
	UnprocessableEntityException,
} from '@nestjs/common';
import { ApiBody, ApiNoContentResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { ChannelEntity, ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { ChannelInputOccurrenceResponseModel } from '../../../modules/devices/models/channel-input-occurrence.model';
import { ChannelInputOccurrencesService } from '../../../modules/devices/services/channel-input-occurrences.service';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import {
	ApiBadRequestResponse,
	ApiCreatedSuccessResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiUnprocessableEntityResponse,
} from '../../../modules/swagger/decorators/api-documentation.decorator';
import {
	DEVICES_THIRD_PARTY_PLUGIN_API_TAG_NAME,
	DEVICES_THIRD_PARTY_PLUGIN_NAME,
	DEVICES_THIRD_PARTY_TYPE,
} from '../devices-third-party.constants';
import { ReportInputOccurrenceDto } from '../dto/report-input-occurrence.dto';
import { ThirdPartyDeviceEntity } from '../entities/devices-third-party.entity';

/**
 * Controller for ingesting physical hardware inputs from third-party devices and extensions.
 */
@ApiTags(DEVICES_THIRD_PARTY_PLUGIN_API_TAG_NAME)
@Controller('devices')
export class ThirdPartyInputsController {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_THIRD_PARTY_PLUGIN_NAME,
		ThirdPartyInputsController.name,
	);

	constructor(
		private readonly devicesService: DevicesService,
		private readonly channelsService: ChannelsService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly channelInputOccurrencesService: ChannelInputOccurrencesService,
	) {}

	@ApiOperation({
		tags: [DEVICES_THIRD_PARTY_PLUGIN_API_TAG_NAME],
		summary: 'Report a physical hardware input occurrence from an authenticated third-party device',
		description:
			'Ingests physical button presses, switch clicks, or sensor occurrences for third-party devices. Validates device ownership, channel capabilities, and deduplication tokens.',
		operationId: 'report-devices-third-party-input-occurrence',
	})
	@ApiParam({
		name: 'id',
		type: 'string',
		format: 'uuid',
		description: 'Third-party device unique identifier',
	})
	@ApiParam({
		name: 'channelId',
		type: 'string',
		format: 'uuid',
		description: 'Input channel unique identifier',
	})
	@ApiBody({
		type: ReportInputOccurrenceDto,
		description: 'Occurrence payload including event name and optional deduplication or timing metadata',
	})
	@ApiCreatedSuccessResponse(ChannelInputOccurrenceResponseModel, 'Occurrence ingested and broadcast successfully')
	@ApiNoContentResponse({ description: 'Occurrence was deduplicated or dropped' })
	@ApiBadRequestResponse('Invalid device type or input channel')
	@ApiNotFoundResponse('Device, channel, or target property not found')
	@ApiUnprocessableEntityResponse('Reported event is not declared as a supported capability for this channel')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post(':id/channels/:channelId/occurrences')
	@HttpCode(HttpStatus.CREATED)
	async reportOccurrence(
		@Param('id', ParseUUIDPipe) deviceId: string,
		@Param('channelId', ParseUUIDPipe) channelId: string,
		@Body() dto: ReportInputOccurrenceDto,
		@Res({ passthrough: true }) res?: FastifyReply,
	): Promise<ChannelInputOccurrenceResponseModel | void> {
		// 1. Verify device ownership and type
		const device = await this.devicesService.findOne<ThirdPartyDeviceEntity>(deviceId);
		if (!device) {
			throw new NotFoundException(`Device id=${deviceId} not found`);
		}

		if (device.type !== DEVICES_THIRD_PARTY_TYPE) {
			throw new BadRequestException(`Device id=${deviceId} is not a third-party device`);
		}

		// 2. Verify channel existence and linkage
		const channel = await this.channelsService.findOne<ChannelEntity>(channelId);
		const devChannelId = typeof channel?.device === 'string' ? channel.device : channel?.device?.id;
		if (!channel || devChannelId !== device.id) {
			throw new NotFoundException(`Channel id=${channelId} not found on device id=${deviceId}`);
		}

		// 3. Resolve target property
		let property: ChannelPropertyEntity | null;
		if (dto.property) {
			if (isUUID(dto.property)) {
				property = await this.channelsPropertiesService.findOne<ChannelPropertyEntity>(dto.property);
				const propChannelId = typeof property?.channel === 'string' ? property.channel : property?.channel?.id;
				if (!property || propChannelId !== channel.id) {
					throw new NotFoundException(`Property id=${dto.property} not found on channel id=${channelId}`);
				}
			} else {
				property = await this.channelsPropertiesService.findOneBy('identifier', dto.property, channel.id);
				if (
					!property ||
					(typeof property.channel === 'string' ? property.channel : property.channel?.id) !== channel.id
				) {
					const allProps = await this.channelsPropertiesService.findAll();
					property =
						allProps.find(
							(p) =>
								(typeof p.channel === 'string' ? p.channel : p.channel?.id) === channel.id &&
								p.identifier === dto.property,
						) ?? null;
				}
				if (!property) {
					throw new NotFoundException(`Property identifier=${dto.property} not found on channel id=${channelId}`);
				}
			}
		} else {
			// Find 'event' or first property on channel
			property = await this.channelsPropertiesService.findOneBy('identifier', 'event', channel.id);
			if (
				!property ||
				(typeof property.channel === 'string' ? property.channel : property.channel?.id) !== channel.id
			) {
				const allProps = await this.channelsPropertiesService.findAll();
				property =
					allProps.find(
						(p) =>
							(typeof p.channel === 'string' ? p.channel : p.channel?.id) === channel.id && p.identifier === 'event',
					) ??
					allProps.find((p) => (typeof p.channel === 'string' ? p.channel : p.channel?.id) === channel.id) ??
					null;
			}
		}

		if (!property) {
			throw new NotFoundException(`No valid property found for channel id=${channelId} to associate event with`);
		}

		// 4. Validate capability/format constraints if enum format is declared
		if (property.format && Array.isArray(property.format) && property.format.length > 0) {
			const supportedEvents = property.format.map((val) => String(val));
			if (!supportedEvents.includes(String(dto.event))) {
				throw new UnprocessableEntityException(
					`Reported event '${dto.event}' is not within declared supported events: ${supportedEvents.join(', ')}`,
				);
			}
		}

		// 5. Emit normalized occurrence
		const occurrence = await this.channelInputOccurrencesService.publishOccurrence({
			deviceId: device.id,
			channelId: channel.id,
			propertyId: property.id,
			event: dto.event,
			sourceOccurrenceId: dto.sourceOccurrenceId,
			sourceTimestamp: dto.sourceTimestamp,
			nativeEventType: dto.nativeEventType,
			data: dto.data,
		});

		if (!occurrence) {
			this.logger.debug(
				`Duplicate occurrence dropped: device=${deviceId} channel=${channelId} sourceOccurrenceId=${dto.sourceOccurrenceId}`,
			);
			if (res !== undefined) {
				res.status(HttpStatus.NO_CONTENT);
			}
			return;
		}

		const response = new ChannelInputOccurrenceResponseModel();
		response.data = occurrence;
		return response;
	}

	@ApiOperation({
		tags: [DEVICES_THIRD_PARTY_PLUGIN_API_TAG_NAME],
		summary: 'Report a physical hardware input event for a third-party channel',
		description: 'Alternative alias endpoint to report hardware input occurrences for third-party devices.',
		operationId: 'report-devices-third-party-input-event',
	})
	@ApiParam({
		name: 'id',
		type: 'string',
		format: 'uuid',
		description: 'Third-party device unique identifier',
	})
	@ApiParam({
		name: 'channelId',
		type: 'string',
		format: 'uuid',
		description: 'Input channel unique identifier',
	})
	@ApiBody({
		type: ReportInputOccurrenceDto,
		description: 'Occurrence payload including event name and optional deduplication or timing metadata',
	})
	@ApiCreatedSuccessResponse(ChannelInputOccurrenceResponseModel, 'Occurrence ingested and broadcast successfully')
	@ApiNoContentResponse({ description: 'Occurrence was deduplicated or dropped' })
	@ApiBadRequestResponse('Invalid device type or input channel')
	@ApiNotFoundResponse('Device, channel, or target property not found')
	@ApiUnprocessableEntityResponse('Reported event is not declared as a supported capability for this channel')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post(':id/channels/:channelId/events')
	@HttpCode(HttpStatus.CREATED)
	async reportEvent(
		@Param('id', ParseUUIDPipe) deviceId: string,
		@Param('channelId', ParseUUIDPipe) channelId: string,
		@Body() dto: ReportInputOccurrenceDto,
		@Res({ passthrough: true }) res?: FastifyReply,
	): Promise<ChannelInputOccurrenceResponseModel | void> {
		return this.reportOccurrence(deviceId, channelId, dto, res);
	}
}
