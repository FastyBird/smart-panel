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
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { toInstance } from '../../../common/utils/transform.utils';
import { PermissionType, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { ChannelInputOccurrencesService } from '../../../modules/devices/services/channel-input-occurrences.service';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import {
	ApiBadRequestResponse,
	ApiNotFoundResponse,
	ApiUnprocessableEntityResponse,
} from '../../../modules/swagger/decorators/api-documentation.decorator';
import {
	DEVICES_THIRD_PARTY_PLUGIN_API_TAG_NAME,
	DEVICES_THIRD_PARTY_PLUGIN_NAME,
	DEVICES_THIRD_PARTY_TYPE,
} from '../devices-third-party.constants';
import { ReportInputOccurrenceResponseDto } from '../dto/report-input-occurrence-response.dto';
import { ReportInputOccurrenceDto } from '../dto/report-input-occurrence.dto';
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
	@ApiBadRequestResponse('Invalid device type or input channel')
	@ApiNotFoundResponse('Device, channel, or target property not found')
	@ApiUnprocessableEntityResponse('Reported event is not declared as a supported capability for this channel')
	@Post([':id/channels/:channelId/occurrences', ':id/channels/:channelId/events'])
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
			if (!property) {
				property = await this.channelsPropertiesService.findOneBy('identifier', dto.property, channel.id, device.type);
			}

			const propertyChannelId = property
				? typeof property.channel === 'string'
					? property.channel
					: property.channel?.id
				: null;

			if (!property || propertyChannelId !== channel.id) {
				throw new NotFoundException(
					`Property '${dto.property}' not found on channel id=${channel.id} of device id=${deviceId}`,
				);
			}
		} else {
			// Find default event property
			const properties = await this.channelsPropertiesService.findAll(channel.id);
			property =
				properties.find(
					(p) =>
						p.identifier === 'event' ||
						p.category === PropertyCategory.EVENT ||
						p.permissions?.includes(PermissionType.EVENT_ONLY),
				) ?? null;

			if (!property) {
				throw new BadRequestException(
					`No input event property found on channel id=${channel.id}. Specify property explicitly.`,
				);
			}
		}

		// 4. Validate channel capabilities if declared
		if (property.format) {
			let allowedEvents: string[] | null = null;
			const rawFormat = property.format as unknown;

			if (Array.isArray(rawFormat)) {
				allowedEvents = (rawFormat as unknown[]).map(String);
			} else if (typeof rawFormat === 'string' && rawFormat.trim()) {
				try {
					const parsed: unknown = JSON.parse(rawFormat);
					if (Array.isArray(parsed)) {
						allowedEvents = (parsed as unknown[]).map(String);
					}
				} catch {
					allowedEvents = rawFormat.split(',').map((s) => s.trim());
				}
			}

			if (allowedEvents && allowedEvents.length > 0 && !allowedEvents.includes(dto.event)) {
				throw new UnprocessableEntityException(
					`Event '${dto.event}' is not declared as a supported capability for channel id=${channel.id}. Supported: ${allowedEvents.join(', ')}`,
				);
			}
		}

		// 5. Ingest and broadcast occurrence
		const occurrence = await this.channelInputOccurrencesService.publishOccurrence({
			deviceId: device.id,
			channelId: channel.id,
			propertyId: property.id,
			event: dto.event,
			sourceOccurrenceId: dto.sourceOccurrenceId,
			sourceTimestamp: dto.sourceTimestamp,
			nativeEventType: dto.nativeEventType ?? dto.event,
			data: dto.data,
		});

		this.logger.log(
			`Ingested occurrence id=${occurrence.id} event=${dto.event} for device id=${device.id} channel id=${channel.id}`,
			{ resource: device.id },
		);

		return toInstance(ReportInputOccurrenceResponseDto, {
			id: occurrence.id,
			timestamp: occurrence.timestamp,
			event: occurrence.event,
		});
	}
}
