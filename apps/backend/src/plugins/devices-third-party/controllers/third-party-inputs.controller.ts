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
	UnprocessableEntityException,
} from '@nestjs/common';
import {
	ApiBadRequestResponse,
	ApiBearerAuth,
	ApiBody,
	ApiNotFoundResponse,
	ApiOperation,
	ApiParam,
	ApiResponse,
	ApiTags,
	ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { ChannelEntity, ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { ChannelInputOccurrencesService } from '../../../modules/devices/services/channel-input-occurrences.service';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DEVICES_THIRD_PARTY_PLUGIN_API_TAG_NAME, DEVICES_THIRD_PARTY_PLUGIN_NAME, DEVICES_THIRD_PARTY_TYPE } from '../devices-third-party.constants';
import { ReportInputOccurrenceDto, ReportInputOccurrenceResponseDto } from '../dto/report-input-occurrence.dto';
import { ThirdPartyDeviceEntity } from '../entities/devices-third-party.entity';

@ApiTags(DEVICES_THIRD_PARTY_PLUGIN_API_TAG_NAME)
@ApiBearerAuth()
@Controller('devices')
export class ThirdPartyInputsController {
	private readonly logger = createExtensionLogger(DEVICES_THIRD_PARTY_PLUGIN_NAME, ThirdPartyInputsController.name);

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
		description: 'Third-party device UUID',
	})
	@ApiParam({
		name: 'channelId',
		type: 'string',
		format: 'uuid',
		description: 'Hardware input channel UUID',
	})
	@ApiBody({
		type: ReportInputOccurrenceDto,
		description: 'Occurrence payload including event name and optional deduplication or timing metadata',
	})
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Occurrence ingested and broadcast successfully',
		type: ReportInputOccurrenceResponseDto,
	})
	@ApiBadRequestResponse({ description: 'Invalid device type or input channel' })
	@ApiNotFoundResponse({ description: 'Device, channel, or target property not found' })
	@ApiUnprocessableEntityResponse({ description: 'Reported event is not declared as a supported capability for this channel' })
	@Post(':id/channels/:channelId/occurrences')
	@HttpCode(HttpStatus.CREATED)
	async reportOccurrence(
		@Param('id', ParseUUIDPipe) deviceId: string,
		@Param('channelId', ParseUUIDPipe) channelId: string,
		@Body() dto: ReportInputOccurrenceDto,
	): Promise<ReportInputOccurrenceResponseDto> {
		// 1. Verify device ownership and type
		const device = await this.devicesService.findOne<ThirdPartyDeviceEntity>(deviceId);
		if (!device) {
			throw new NotFoundException(`Device id=${deviceId} not found`);
		}

		if (device.type !== DEVICES_THIRD_PARTY_TYPE) {
			throw new BadRequestException(`Device id=${deviceId} is not a third-party device`);
		}

		// 2. Verify channel existence on device
		const channel = await this.channelsService.findOne<ChannelEntity>(channelId);
		const channelDeviceId = channel ? (typeof channel.device === 'string' ? channel.device : channel.device?.id) : null;

		if (!channel || channelDeviceId !== device.id) {
			throw new NotFoundException(`Channel id=${channelId} not found on device id=${deviceId}`);
		}

		// 3. Resolve target property
		let property: ChannelPropertyEntity | null;

		if (dto.property) {
			property = await this.channelsPropertiesService.findOne(dto.property);
			const propChannelId = property ? (typeof property.channel === 'string' ? property.channel : property.channel?.id) : null;

			if (!property || propChannelId !== channel.id) {
				throw new NotFoundException(`Property id=${dto.property} not found on channel id=${channelId}`);
			}
		} else {
			// Find primary input event property
			property = await this.channelsPropertiesService.findOneBy(
				'identifier',
				'event',
				channel.id,
				DEVICES_THIRD_PARTY_TYPE,
			);
		}

		if (!property) {
			throw new NotFoundException(`No suitable input property found on channel id=${channelId}`);
		}

		// 4. Validate event capability against property format if declared
		if (Array.isArray(property.format) && property.format.length > 0) {
			const supportedEvents = property.format.map((v) => String(v));
			if (!supportedEvents.includes(dto.event)) {
				throw new UnprocessableEntityException(
					`Event '${dto.event}' is not supported by channel id=${channelId}. Supported events: ${supportedEvents.join(', ')}`,
				);
			}
		}

		// 5. Publish occurrence through occurrences service
		const occurrence = await this.channelInputOccurrencesService.publishOccurrence({
			deviceId: device.id,
			channelId: channel.id,
			propertyId: property.id,
			event: dto.event,
			nativeEventType: dto.nativeEventType,
			sourceOccurrenceId: dto.sourceOccurrenceId,
			sourceTimestamp: dto.sourceTimestamp,
		});

		return {
			id: occurrence.id,
			deviceId: occurrence.deviceId,
			channelId: occurrence.channelId,
			propertyId: occurrence.propertyId,
			event: occurrence.event,
			nativeEventType: occurrence.nativeEventType,
			sourceOccurrenceId: occurrence.sourceOccurrenceId,
			timestamp: occurrence.timestamp,
		};
	}

	@ApiOperation({
		tags: [DEVICES_THIRD_PARTY_PLUGIN_API_TAG_NAME],
		summary: 'Report a physical hardware input event from an authenticated third-party device',
		description:
			'Ingests physical button presses, switch clicks, or sensor occurrences for third-party devices. Alias for occurrences endpoint.',
		operationId: 'report-devices-third-party-input-event',
	})
	@ApiParam({
		name: 'id',
		type: 'string',
		format: 'uuid',
		description: 'Third-party device UUID',
	})
	@ApiParam({
		name: 'channelId',
		type: 'string',
		format: 'uuid',
		description: 'Hardware input channel UUID',
	})
	@ApiBody({
		type: ReportInputOccurrenceDto,
		description: 'Occurrence payload including event name and optional deduplication or timing metadata',
	})
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Occurrence ingested and broadcast successfully',
		type: ReportInputOccurrenceResponseDto,
	})
	@ApiBadRequestResponse({ description: 'Invalid device type or input channel' })
	@ApiNotFoundResponse({ description: 'Device, channel, or target property not found' })
	@ApiUnprocessableEntityResponse({ description: 'Reported event is not declared as a supported capability for this channel' })
	@Post(':id/channels/:channelId/events')
	@HttpCode(HttpStatus.CREATED)
	async reportEvent(
		@Param('id', ParseUUIDPipe) deviceId: string,
		@Param('channelId', ParseUUIDPipe) channelId: string,
		@Body() dto: ReportInputOccurrenceDto,
	): Promise<ReportInputOccurrenceResponseDto> {
		return this.reportOccurrence(deviceId, channelId, dto);
	}
}
