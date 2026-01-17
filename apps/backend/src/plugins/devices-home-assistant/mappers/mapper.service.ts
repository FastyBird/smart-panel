import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { DataTypeType, PermissionType } from '../../../modules/devices/devices.constants';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import {
	DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
	DEVICES_HOME_ASSISTANT_TYPE,
	HomeAssistantDomain,
} from '../devices-home-assistant.constants';
import { DevicesHomeAssistantValidationException } from '../devices-home-assistant.exceptions';
import { HomeAssistantStateDto } from '../dto/home-assistant-state.dto';
import {
	HomeAssistantChannelEntity,
	HomeAssistantChannelPropertyEntity,
	HomeAssistantDeviceEntity,
} from '../entities/devices-home-assistant.entity';
import { TransformerRegistry } from '../mappings/transformers/transformer.registry';
import { VirtualPropertyService } from '../services/virtual-property.service';

import { IEntityMapper } from './entity.mapper';
import { UniversalEntityMapperService } from './universal.entity.mapper.service';

const VIRTUAL_ATTRIBUTE_PREFIX = 'fb.virtual.';

type MappedToHa = {
	domain: string;
	state: string;
	service: string;
	entityId: string;
	attributes?: Map<string, string | number | number[] | boolean | null>;
	properties: HomeAssistantChannelPropertyEntity[];
};

export type MappedFromHaEntry = {
	property: HomeAssistantChannelPropertyEntity;
	value: string | number | boolean | null;
};

export type MappedFromHa = MappedFromHaEntry[];

@Injectable()
export class MapperService {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
		'MapperService',
	);

	private readonly mappers = new Map<HomeAssistantDomain, IEntityMapper>();

	constructor(
		private readonly channelsService: ChannelsService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly universalEntityMapperService: UniversalEntityMapperService,
		private readonly virtualPropertyService: VirtualPropertyService,
		private readonly transformerRegistry: TransformerRegistry,
	) {}

	registerMapper(mapper: IEntityMapper): void {
		this.mappers.set(mapper.domain, mapper);
	}

	async mapFromHA(device: HomeAssistantDeviceEntity, states: HomeAssistantStateDto[]): Promise<MappedFromHa[]> {
		const channels = await this.getChannels(device);
		const readableProperties = await this.getReadableProperties(channels);
		const grouped = this.groupProperties(readableProperties);

		// Debug: Log property grouping details
		this.logger.debug(
			`[MAP FROM HA] Device ${device.id}: Found ${readableProperties.length} readable properties, ` +
				`grouped into ${grouped.size} entities`,
		);

		// Log all entity IDs that have properties
		const entityIds = Array.from(grouped.keys());
		this.logger.debug(`[MAP FROM HA] Properties grouped by entity IDs: ${entityIds.join(', ')}`);

		// Log each property's details
		for (const prop of readableProperties) {
			this.logger.debug(
				`[MAP FROM HA] Property: category=${prop.category}, haAttribute=${prop.haAttribute}, ` +
					`haEntityId=${prop.haEntityId}, permissions=${prop.permissions.join(',')}`,
			);
		}

		const updates: MappedFromHa[] = [];

		for (const state of states) {
			const domain = this.getDomain(state.entity_id);

			const properties = grouped.get(state.entity_id);

			if (!properties) {
				this.logger.debug(
					`[MAP FROM HA] No properties found for entityId=${state.entity_id}. ` +
						`Available entity IDs: ${entityIds.join(', ')}`,
				);

				continue;
			}

			this.logger.debug(
				`[MAP FROM HA] Found ${properties.length} properties for entity ${state.entity_id}: ` +
					`${properties.map((p) => `${p.category}:${p.haAttribute}`).join(', ')}`,
			);

			const mapper = this.mappers.get(domain);

			const primary = mapper ? await mapper.mapFromHA(properties, state) : new Map();

			const secondary = await this.universalEntityMapperService.mapFromHA(properties, state);

			const resultMap = new Map<string, string | number | boolean | null>(primary);

			for (const [key, value] of secondary.entries()) {
				if (!resultMap.has(key)) {
					resultMap.set(key, value);
				}
			}

			// Convert Map to array with property entities and apply transformers
			// Transformers are applied when:
			// 1. Property has a transformer configured (haTransformer is set)
			// 2. Value is not null
			//
			// Domain mappers are aware of transformers and pass through raw values when
			// a property has a transformer configured. This allows the transformer to
			// handle the conversion consistently for both read and write paths.
			const result: MappedFromHaEntry[] = [];
			for (const [propertyId, value] of resultMap.entries()) {
				const property = properties.find((p) => p.id === propertyId);
				if (property) {
					let transformedValue: string | number | boolean | null = value;

					// Apply transformer if property has one configured
					if (property.haTransformer && value !== null) {
						const transformer = this.transformerRegistry.getOrCreate(property.haTransformer);
						if (transformer.canRead()) {
							try {
								const rawTransformed = transformer.read(value);
								// Ensure transformed value is the expected type
								if (
									typeof rawTransformed === 'string' ||
									typeof rawTransformed === 'number' ||
									typeof rawTransformed === 'boolean' ||
									rawTransformed === null
								) {
									transformedValue = rawTransformed as string | number | boolean | null;
								} else {
									this.logger.warn(
										`[MAP FROM HA] Transformer ${property.haTransformer} returned unexpected type ` +
											`for property ${property.id}: ${typeof rawTransformed}`,
									);
								}
							} catch (error) {
								this.logger.error(
									`[MAP FROM HA] Transformer ${property.haTransformer} threw error for property ${property.id}: ` +
										`${error instanceof Error ? error.message : String(error)}`,
								);
								// Fall back to original value on transformer error
							}
						}
					} else if (!property.haTransformer && property.dataType === DataTypeType.BOOL && value !== null) {
						// Fallback: Convert boolean values for properties with BOOL dataType when no transformer is configured.
						// This maintains backward compatibility for existing devices in the database.
						const boolValue = this.convertToBoolean(value);
						if (boolValue !== null) {
							transformedValue = boolValue;
						}
					}
					result.push({ property, value: transformedValue });
				}
			}

			// Log what was mapped
			if (result.length > 0) {
				this.logger.debug(
					`[MAP FROM HA] Mapped ${result.length} values for entity ${state.entity_id}: ` +
						`${result.map(({ property, value }) => `${property.id}=${String(value)}`).join(', ')}`,
				);
				updates.push(result);
			} else {
				this.logger.debug(`[MAP FROM HA] No values mapped for entity ${state.entity_id}`);
			}
		}

		return updates;
	}

	async mapToHA(
		device: HomeAssistantDeviceEntity,
		values: Map<HomeAssistantChannelPropertyEntity['id'], string | number | boolean>,
	): Promise<MappedToHa[]> {
		const channels = await this.getChannels(device);
		const allWritableProperties = await this.getWritableProperties(channels);

		// Separate virtual command properties from regular properties
		const virtualCommandProps: HomeAssistantChannelPropertyEntity[] = [];
		const regularProps: HomeAssistantChannelPropertyEntity[] = [];

		for (const prop of allWritableProperties) {
			if (this.isVirtualProperty(prop)) {
				virtualCommandProps.push(prop);
			} else {
				regularProps.push(prop);
			}
		}

		// Apply transformers to values before passing to domain mappers
		// This converts Smart Panel values to HA values
		const transformedValues = new Map<string, string | number | boolean>();
		for (const [propertyId, value] of values.entries()) {
			const property = allWritableProperties.find((p) => p.id === propertyId);
			if (property?.haTransformer) {
				const transformer = this.transformerRegistry.getOrCreate(property.haTransformer);
				if (transformer.canWrite()) {
					try {
						const transformed = transformer.write(value);
						const isValidType =
							typeof transformed === 'string' || typeof transformed === 'number' || typeof transformed === 'boolean';
						if (isValidType) {
							transformedValues.set(propertyId, transformed);
						} else {
							this.logger.warn(
								`[MAP TO HA] Transformer ${property.haTransformer} returned unexpected type ` +
									`for property ${property.id}: ${typeof transformed}`,
							);
							transformedValues.set(propertyId, value);
						}
					} catch (error) {
						this.logger.error(
							`[MAP TO HA] Transformer ${property.haTransformer} threw error for property ${property.id}: ` +
								`${error instanceof Error ? error.message : String(error)}`,
						);
						// Fall back to original value on transformer error
						transformedValues.set(propertyId, value);
					}
				} else {
					transformedValues.set(propertyId, value);
				}
			} else if (property && property.dataType === DataTypeType.BOOL) {
				// Fallback: Convert boolean values for properties with BOOL dataType when no transformer is configured.
				// This maintains backward compatibility for existing devices in the database.
				transformedValues.set(propertyId, this.convertFromBoolean(value));
			} else {
				transformedValues.set(propertyId, value);
			}
		}

		const updates: MappedToHa[] = [];

		// Handle regular properties through standard mappers
		const grouped = this.groupProperties(regularProps);

		for (const [entityId, properties] of grouped.entries()) {
			const domain = this.getDomain(entityId);

			const mapper = this.mappers.get(domain);

			if (!mapper) {
				this.logger.warn(`No mapper found for domain=${domain}`);

				continue;
			}

			const mapped = await mapper.mapToHA(properties, transformedValues);

			if (mapped === null) {
				continue;
			}

			const result = { domain, entityId, ...mapped, properties };

			updates.push(result);
		}

		// Handle virtual command properties (also use transformed values)
		const virtualUpdates = this.handleVirtualCommandProperties(virtualCommandProps, transformedValues, channels);
		updates.push(...virtualUpdates);

		return updates;
	}

	/**
	 * Handle virtual command properties by translating them to HA service calls
	 */
	private handleVirtualCommandProperties(
		properties: HomeAssistantChannelPropertyEntity[],
		values: Map<HomeAssistantChannelPropertyEntity['id'], string | number | boolean>,
		channels: HomeAssistantChannelEntity[],
	): MappedToHa[] {
		const updates: MappedToHa[] = [];

		// Build a map from channel ID to channel for quick lookup
		// Properties have a channel field (either string ID or ChannelEntity) that we can use
		const channelMap = new Map<string, HomeAssistantChannelEntity>();
		for (const channel of channels) {
			channelMap.set(channel.id, channel);
		}

		for (const property of properties) {
			const value = values.get(property.id);
			if (value === undefined) {
				continue;
			}

			// Find the channel for this property using the property's channel reference
			// property.channel can be either a string (channel ID) or a ChannelEntity
			const channelId = typeof property.channel === 'string' ? property.channel : property.channel?.id;
			const channel = channelId ? channelMap.get(channelId) : undefined;
			if (!channel) {
				this.logger.warn(`Could not find channel for virtual property ${property.id} (channelId: ${channelId})`);
				continue;
			}

			// Virtual command properties need a valid entity ID to send commands to
			if (!property.haEntityId) {
				this.logger.warn(`Virtual command property ${property.id} has no haEntityId, cannot send command`);
				continue;
			}

			// Get the service call from VirtualPropertyService
			const serviceCall = this.virtualPropertyService.getServiceCallForCommand(
				channel.category,
				property.category,
				String(value),
				property.haEntityId,
			);

			if (!serviceCall) {
				this.logger.warn(
					`Could not get service call for virtual command property: ` +
						`channel=${channel.category}, property=${property.category}, value=${value}`,
				);
				continue;
			}

			this.logger.debug(
				`[VIRTUAL COMMAND] Translating command: channel=${channel.category}, ` +
					`property=${property.category}, value=${value} -> ` +
					`service=${serviceCall.domain}.${serviceCall.service}`,
			);

			updates.push({
				domain: serviceCall.domain,
				entityId: serviceCall.entityId,
				state: String(value),
				service: serviceCall.service,
				attributes: serviceCall.data
					? new Map(Object.entries(serviceCall.data) as [string, string | number | number[] | boolean | null][])
					: undefined,
				properties: [property],
			});
		}

		return updates;
	}

	private async getChannels(device: HomeAssistantDeviceEntity): Promise<HomeAssistantChannelEntity[]> {
		return await this.channelsService.findAll<HomeAssistantChannelEntity>(device.id, DEVICES_HOME_ASSISTANT_TYPE);
	}

	private async getProperties(channels: HomeAssistantChannelEntity[]): Promise<HomeAssistantChannelPropertyEntity[]> {
		return await this.channelsPropertiesService.findAll<HomeAssistantChannelPropertyEntity>(
			channels.map((channel) => channel.id),
			DEVICES_HOME_ASSISTANT_TYPE,
		);
	}

	private async getReadableProperties(
		channels: HomeAssistantChannelEntity[],
	): Promise<HomeAssistantChannelPropertyEntity[]> {
		return (await this.getProperties(channels)).filter(
			(property) =>
				// Must have readable permission
				(property.permissions.includes(PermissionType.READ_WRITE) ||
					property.permissions.includes(PermissionType.READ_ONLY)) &&
				// Virtual properties don't have real HA data to read
				!this.isVirtualProperty(property),
		);
	}

	private async getWritableProperties(
		channels: HomeAssistantChannelEntity[],
	): Promise<HomeAssistantChannelPropertyEntity[]> {
		return (await this.getProperties(channels)).filter(
			(property) =>
				property.permissions.includes(PermissionType.READ_WRITE) ||
				property.permissions.includes(PermissionType.WRITE_ONLY),
		);
	}

	private groupProperties(
		properties: HomeAssistantChannelPropertyEntity[],
	): Map<string, HomeAssistantChannelPropertyEntity[]> {
		const mapped = new Map<string, HomeAssistantChannelPropertyEntity[]>();

		for (const property of properties) {
			const list = mapped.get(property.haEntityId);

			if (list) {
				list.push(property);
			} else {
				mapped.set(property.haEntityId, [property]);
			}
		}

		return mapped;
	}

	private getDomain(entityId: string): HomeAssistantDomain {
		const domain = entityId.toLowerCase().split('.')[0] as HomeAssistantDomain;

		if (!Object.values(HomeAssistantDomain).includes(domain)) {
			throw new DevicesHomeAssistantValidationException(`Unknown or unsupported Home Assistant domain: ${domain}`);
		}

		return domain;
	}

	/**
	 * Check if a property is a virtual property based on its haAttribute
	 * Virtual properties have haAttribute starting with 'fb.virtual.'
	 */
	private isVirtualProperty(property: HomeAssistantChannelPropertyEntity): boolean {
		return property.haAttribute?.startsWith(VIRTUAL_ATTRIBUTE_PREFIX) ?? false;
	}

	/**
	 * Fallback boolean conversion for properties with dataType BOOL when no transformer is configured.
	 * This maintains backward compatibility for existing devices in the database that were created
	 * before the transformer system was introduced.
	 *
	 * Converts common Home Assistant boolean string representations to actual booleans:
	 * - 'on', 'true', '1', 'yes' -> true
	 * - 'off', 'false', '0', 'no' -> false
	 */
	private convertToBoolean(value: string | number | boolean | null): boolean | null {
		if (value === null) {
			return null;
		}

		if (typeof value === 'boolean') {
			return value;
		}

		if (typeof value === 'number') {
			return value !== 0;
		}

		const normalized = String(value).toLowerCase().trim();

		if (['on', 'true', '1', 'yes'].includes(normalized)) {
			return true;
		}

		if (['off', 'false', '0', 'no'].includes(normalized)) {
			return false;
		}

		// If the string doesn't match known patterns, log a warning and return null
		this.logger.warn(`[FALLBACK BOOL] Could not convert value "${value}" to boolean, unknown format`);

		return null;
	}

	/**
	 * Fallback boolean conversion for mapToHA - converts boolean to Home Assistant 'on'/'off' string.
	 * This maintains backward compatibility for existing devices without haTransformer configured.
	 */
	private convertFromBoolean(value: string | number | boolean): string {
		if (typeof value === 'boolean') {
			return value ? 'on' : 'off';
		}

		if (typeof value === 'number') {
			return value !== 0 ? 'on' : 'off';
		}

		// If already a string, check if it needs conversion
		const normalized = String(value).toLowerCase().trim();
		if (['true', '1', 'yes'].includes(normalized)) {
			return 'on';
		}
		if (['false', '0', 'no'].includes(normalized)) {
			return 'off';
		}

		// Return as-is if not a recognized boolean format
		return String(value);
	}
}
