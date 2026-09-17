import { randomUUID } from 'crypto';

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { ChannelCategory, DEVICES_MODULE_NAME, DataTypeType, EventType, PermissionType } from '../devices.constants';
import { DevicesNotFoundException, DevicesValidationException } from '../devices.exceptions';
import { CreateChannelInputOccurrenceDto } from '../dto/channel-input-occurrence.dto';
import {
	ChannelInputCapabilitiesModel,
	ChannelInputPropertyCapabilityModel,
} from '../models/channel-input-capabilities.model';
import { ChannelInputOccurrencePayload } from '../models/channel-input-occurrence.model';

import { ChannelInputDeduplicationService } from './channel-input-deduplication.service';
import { ChannelsPropertiesService } from './channels.properties.service';
import { ChannelsService } from './channels.service';
import { DevicesService } from './devices.service';

/**
 * Service for ingesting, validating, deduplicating, and dispatching hardware input occurrences.
 *
 * Hardware input occurrences (such as button presses, discrete pulses, and multi-clicks)
 * are delivered independently of cached property state to ensure rapid identical events
 * are never suppressed by equality deduplication.
 */
@Injectable()
export class ChannelInputOccurrencesService {
	private readonly logger = createExtensionLogger(DEVICES_MODULE_NAME, 'ChannelInputOccurrencesService');

	constructor(
		private readonly devicesService: DevicesService,
		private readonly channelsService: ChannelsService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly deduplicationService: ChannelInputDeduplicationService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	/**
	 * Ingests a hardware input occurrence (alias for publishOccurrence).
	 *
	 * @param dto - Occurrence payload details
	 * @returns Published occurrence payload envelope, or null if dropped
	 */
	async ingestOccurrence(dto: CreateChannelInputOccurrenceDto): Promise<ChannelInputOccurrencePayload | null> {
		return this.publishOccurrence(dto);
	}

	/**
	 * Ingests, validates, deduplicates, and publishes a physical hardware input occurrence.
	 *
	 * @param dto - Occurrence payload details
	 * @returns Published occurrence payload envelope, or null if dropped (e.g. duplicate or disabled device)
	 */
	async publishOccurrence(dto: CreateChannelInputOccurrenceDto): Promise<ChannelInputOccurrencePayload | null> {
		const device = await this.devicesService.findOne(dto.deviceId);
		if (!device) {
			throw new DevicesNotFoundException(`Device with ID ${dto.deviceId} was not found.`);
		}

		if (!device.enabled) {
			this.logger.warn(`[OCCURRENCE DROPPED] Device ${device.id} is disabled. Occurrence dropped.`);
			return null;
		}

		const channel = await this.channelsService.findOne(dto.channelId);
		if (!channel) {
			throw new DevicesNotFoundException(`Channel with ID ${dto.channelId} was not found.`);
		}

		const channelDeviceId = typeof channel.device === 'string' ? channel.device : channel.device?.id;
		if (channelDeviceId !== dto.deviceId) {
			throw new DevicesValidationException(`Channel ${dto.channelId} does not belong to device ${dto.deviceId}.`);
		}

		const property = await this.channelsPropertiesService.findOne(dto.propertyId);
		if (!property) {
			throw new DevicesNotFoundException(`Property with ID ${dto.propertyId} was not found.`);
		}

		const propertyChannelId = typeof property.channel === 'string' ? property.channel : property.channel?.id;
		if (propertyChannelId !== dto.channelId) {
			throw new DevicesValidationException(`Property ${dto.propertyId} does not belong to channel ${dto.channelId}.`);
		}

		// Validate property permissions - input occurrences must have EVENT_ONLY or READ_ONLY permissions
		const hasInputPermission = property.permissions.some((p) =>
			[PermissionType.EVENT_ONLY, PermissionType.READ_ONLY].includes(p),
		);
		if (!hasInputPermission) {
			throw new DevicesValidationException(
				`Property ${property.id} does not permit input occurrences (permissions: ${property.permissions.join(',')}).`,
			);
		}

		// Validate channel category / input classification
		const isInputChannel =
			[ChannelCategory.BUTTON, ChannelCategory.BINARY_INPUT, ChannelCategory.ANALOG_INPUT].includes(channel.category) ||
			property.permissions.includes(PermissionType.EVENT_ONLY);
		if (!isInputChannel) {
			throw new DevicesValidationException(
				`Channel ${channel.id} is not an input channel and property ${property.id} does not have EVENT_ONLY permission.`,
			);
		}

		// Validate event format if an enum format is defined
		if (property.dataType === DataTypeType.ENUM && Array.isArray(property.format) && property.format.length > 0) {
			const allowedValues = property.format.map((val) => String(val));
			if (!allowedValues.includes(String(dto.event))) {
				throw new DevicesValidationException(
					`Event '${dto.event}' is not supported for property ${property.id}. Allowed values: ${allowedValues.join(', ')}.`,
				);
			}
		}

		// Transport-level source identity deduplication
		if (
			this.deduplicationService.isDuplicate(
				device.id,
				channel.id,
				dto.sourceOccurrenceId,
				property.id,
				dto.event,
				dto.nativeEventType,
			)
		) {
			this.logger.debug(
				`[OCCURRENCE DROPPED] Duplicate redelivery detected for device=${device.id} channel=${channel.id} property=${property.id} event=${dto.event} sourceOccurrenceId=${dto.sourceOccurrenceId}`,
			);
			return null;
		}

		const occurrence: ChannelInputOccurrencePayload = {
			id: randomUUID(),
			deviceId: device.id,
			channelId: channel.id,
			propertyId: property.id,
			deviceCategory: device.category,
			channelCategory: channel.category,
			propertyCategory: property.category,
			event: dto.event,
			timestamp: new Date().toISOString(),
			sourceTimestamp: dto.sourceTimestamp,
			sourceOccurrenceId: dto.sourceOccurrenceId,
			nativeEventType: dto.nativeEventType,
			data: dto.data,
			integration: device.type,
			endpoint: device.identifier ?? null,
		};

		this.eventEmitter.emit(EventType.CHANNEL_INPUT_OCCURRENCE, occurrence);

		return occurrence;
	}

	/**
	 * Subscribes an in-process listener to hardware input occurrences.
	 *
	 * @param listener - Callback receiving published occurrence envelopes
	 * @returns Unsubscribe function
	 */
	subscribe(listener: (occurrence: ChannelInputOccurrencePayload) => void | Promise<void>): () => void {
		const reportError = (error: unknown): void => {
			const err = error as Error;
			this.logger.error(`Error in occurrence subscriber callback: ${err.message}`, {
				message: err.message,
				stack: err.stack,
			});
		};

		const handler = (payload: ChannelInputOccurrencePayload) => {
			try {
				void Promise.resolve(listener(payload)).catch(reportError);
			} catch (error) {
				reportError(error);
			}
		};

		this.eventEmitter.on(EventType.CHANNEL_INPUT_OCCURRENCE, handler);

		return () => {
			this.eventEmitter.off(EventType.CHANNEL_INPUT_OCCURRENCE, handler);
		};
	}

	/**
	 * Retrieves input capabilities and supported event interactions for a channel.
	 *
	 * @param channelId - Target channel unique identifier
	 * @returns Capability descriptor, or null if channel not found
	 */
	async getInputCapabilities(channelId: string): Promise<ChannelInputCapabilitiesModel | null> {
		const channel = await this.channelsService.findOne(channelId);
		if (!channel) {
			return null;
		}

		const deviceId = typeof channel.device === 'string' ? channel.device : channel.device?.id;
		const properties = (channel.properties ?? []).filter((prop) =>
			prop.permissions.some((p) => [PermissionType.EVENT_ONLY, PermissionType.READ_ONLY].includes(p)),
		);

		const isInputChannel =
			[ChannelCategory.BUTTON, ChannelCategory.BINARY_INPUT, ChannelCategory.ANALOG_INPUT].includes(channel.category) ||
			properties.some((p) => p.permissions.includes(PermissionType.EVENT_ONLY));

		const supportedEvents = new Set<string>();

		for (const prop of properties) {
			if (prop.dataType === DataTypeType.ENUM && Array.isArray(prop.format)) {
				for (const item of prop.format) {
					supportedEvents.add(String(item));
				}
			}
		}

		const propertyModels: ChannelInputPropertyCapabilityModel[] = properties.map((prop) => ({
			id: prop.id,
			category: prop.category,
			permissions: prop.permissions,
			data_type: prop.dataType,
			format: Array.isArray(prop.format) ? prop.format : null,
		}));

		return {
			channel_id: channel.id,
			device_id: deviceId ?? '',
			category: channel.category,
			is_input: isInputChannel,
			supported_events: Array.from(supportedEvents),
			properties: propertyModels,
		};
	}
}
