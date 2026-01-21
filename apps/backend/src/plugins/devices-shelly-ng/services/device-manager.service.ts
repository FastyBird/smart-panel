import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { pLimit, retry, withTimeout } from '../../../common/utils/http.utils';
import { clampNumber } from '../../../common/utils/transform.utils';
import {
	ChannelCategory,
	ConnectionState,
	DataTypeType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { ChannelDefinition, channelsSchema } from '../../../spec/channels';
import {
	ComponentType,
	DESCRIPTORS,
	DEVICES_SHELLY_NG_PLUGIN_NAME,
	DEVICES_SHELLY_NG_TYPE,
	DeviceDescriptor,
	DeviceProfile,
} from '../devices-shelly-ng.constants';
import { DevicesShellyNgException } from '../devices-shelly-ng.exceptions';
import { CreateShellyNgChannelPropertyDto } from '../dto/create-channel-property.dto';
import { CreateShellyNgChannelDto } from '../dto/create-channel.dto';
import { UpdateShellyNgChannelPropertyDto } from '../dto/update-channel-property.dto';
import { UpdateShellyNgChannelDto } from '../dto/update-channel.dto';
import {
	ShellyNgChannelEntity,
	ShellyNgChannelPropertyEntity,
	ShellyNgDeviceEntity,
} from '../entities/devices-shelly-ng.entity';
import {
	MappingContext,
	MappingLoaderService,
	PropertyMappingStorageService,
	ResolvedChannel,
	ResolvedProperty,
	TransformerRegistry,
} from '../mappings';
import { ITransformer } from '../mappings/transformers/transformer.types';
import { createInlineTransformer } from '../mappings/transformers/transformers';
import { AnyDerivation } from '../mappings/mapping.types';
import { rssiToQuality, toEnergy } from '../utils/transform.utils';

import { ShellyRpcClientService } from './shelly-rpc-client.service';

@Injectable()
export class DeviceManagerService {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_SHELLY_NG_PLUGIN_NAME,
		'DeviceManagerService',
	);

	private readonly provisionLocks: Map<string, Promise<unknown>> = new Map();
	private readonly defaultManager: EntityManager | undefined = ((): EntityManager | undefined => {
		// Reuse any available manager to avoid spawning new transactions for cleanup paths.
		const candidate =
			(this.channelsService as unknown as { dataSource?: { manager?: EntityManager } }).dataSource?.manager ??
			(this.channelsPropertiesService as unknown as { dataSource?: { manager?: EntityManager } }).dataSource?.manager;
		return candidate;
	})();

	private readonly strictSchema: boolean = false;

	private timeoutSec: number = 30;

	private rpcConcurrency: number = 1;

	constructor(
		private readonly shellyRpcClientService: ShellyRpcClientService,
		private readonly devicesService: DevicesService,
		private readonly channelsService: ChannelsService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly mappingLoaderService: MappingLoaderService,
		private readonly transformerRegistry: TransformerRegistry,
		private readonly propertyMappingStorage: PropertyMappingStorageService,
	) {}

	async getDeviceInfo(
		hostname: string,
		password: string | undefined,
	): Promise<{
		id: string;
		name: string | null | undefined;
		mac: string;
		model: string;
		fw_id: string;
		ver: string;
		app: string;
		profile?: string;
		auth_en: boolean;
		auth_domain: string | null;
		discoverable: boolean;
		key: string;
		batch: string;
		fw_sbits: string;
		components: {
			type: string;
			ids: number[];
		}[];
	}> {
		const deviceInfo = await this.shellyRpcClientService.getDeviceInfo(hostname, { password });
		const deviceProvidedComponents = await this.shellyRpcClientService.getComponents(hostname, { password });
		const systemConfig = await this.shellyRpcClientService.getSystemConfig(hostname, { password });

		const groups: Record<
			string,
			{
				ids: number[];
				keys: string[];
			}
		> = {};

		for (const { key } of deviceProvidedComponents) {
			const [type, rest] = key.split(':', 2);
			const g = (groups[type] ??= { ids: [], keys: [] });

			g.keys.push(key);

			if (typeof rest === 'string' && rest.length > 0) {
				const id = Number(rest);

				if (Number.isFinite(id) && !g.ids.includes(id)) {
					g.ids.push(id);
				}
			}
		}

		// sort for determinism
		for (const g of Object.values(groups)) {
			g.keys = Array.from(new Set(g.keys)).sort();
			g.ids.sort((a, b) => a - b);
		}

		const components = Object.entries(groups)
			.map(([type, g]) => ({ type, ids: g.ids }))
			.sort((a, b) => a.type.localeCompare(b.type));

		return {
			...deviceInfo,
			name: systemConfig.device.name,
			components,
		};
	}

	async createOrUpdate(id: string): Promise<ShellyNgDeviceEntity> {
		return this.enqueueProvision(id, async () => {
			const device = await this.devicesService.findOne<ShellyNgDeviceEntity>(id, DEVICES_SHELLY_NG_TYPE);

			if (device === null) {
				throw new DevicesShellyNgException('Device not found.');
			}

			const deviceInfo = await this.getDeviceInfo(device.hostname, device.password);

			const deviceSpec = this.getSpecification(deviceInfo.model);

			if (deviceSpec === null) {
				throw new DevicesShellyNgException(
					`Provided device is not supported hostname=${device.hostname} model=${deviceInfo.model}`,
				);
			}

		const channelsIds: string[] = [];

		const deviceInformation = await this.ensureChannel(
			device,
			'category',
			ChannelCategory.DEVICE_INFORMATION,
			ChannelCategory.DEVICE_INFORMATION,
			'Device information',
		);
		channelsIds.push(deviceInformation.id);

		await this.ensureProperty(
			deviceInformation,
			PropertyCategory.MANUFACTURER,
			'category',
			PropertyCategory.MANUFACTURER,
			'Shelly',
		);
		await this.ensureProperty(
			deviceInformation,
			PropertyCategory.MODEL,
			'category',
			PropertyCategory.MODEL,
			deviceInfo.model,
		);
		await this.ensureProperty(
			deviceInformation,
			PropertyCategory.SERIAL_NUMBER,
			'category',
			PropertyCategory.SERIAL_NUMBER,
			deviceInfo.id,
		);
		await this.ensureProperty(
			deviceInformation,
			PropertyCategory.FIRMWARE_REVISION,
			'category',
			PropertyCategory.FIRMWARE_REVISION,
			deviceInfo.ver,
		);
		await this.ensureProperty(
			deviceInformation,
			PropertyCategory.STATUS,
			'category',
			PropertyCategory.STATUS,
			ConnectionState.UNKNOWN,
			{
				format: [ConnectionState.CONNECTED, ConnectionState.DISCONNECTED, ConnectionState.UNKNOWN],
			},
		);

		try {
			const wifiInfo = await this.shellyRpcClientService.getWifiStatus(device.hostname, { password: device.password });

			await this.ensureProperty(
				deviceInformation,
				PropertyCategory.LINK_QUALITY,
				'category',
				PropertyCategory.LINK_QUALITY,
				rssiToQuality(wifiInfo.rssi),
			);
		} catch {
			// Could be ignored, a device is not supporting Wi-Fi component
		}

		const deviceComponents: { [key: string]: number[] } = deviceInfo.components.reduce((acc, group) => {
			acc[group.type] = group.ids;
			return acc;
		}, {});

		const limit = pLimit(this.rpcConcurrency);

		const host = device.hostname;
		const password = device.password;

		for (const [type, ids] of Object.entries(deviceComponents)) {
			if (
				type === String(ComponentType.SWITCH) &&
				(!deviceInfo.profile || deviceInfo.profile === String(DeviceProfile.SWITCH))
			) {
				const tasks = ids.map((key) =>
					limit(async () => {
						const [switchConfig, switchStatus] = await retry(
							() =>
								withTimeout(
									Promise.all([
										this.shellyRpcClientService.getSwitchConfig(host, key, { password }),
										this.shellyRpcClientService.getSwitchStatus(host, key, { password }),
									]),
									this.timeoutSec * 1000,
									`Switch.GetConfig+Switch.GetStatus - ${key}`,
								),
							{ retries: 2, baseMs: 300, factor: 2 },
						).catch((err: Error) => {
							this.logger.error(`Failed load for switch=${key} on device=${device.id}`, {
								resource: device.id,
								message: err.message,
								stack: err.stack,
							});

							throw err;
						});

						// Use YAML mapping to determine channel category based on device category
						const mappingContext: MappingContext = {
							componentType: ComponentType.SWITCH,
							componentKey: key,
							deviceCategory: device.category,
							model: deviceInfo.model,
							profile: deviceInfo.profile ?? undefined,
						};

						const mapping = this.mappingLoaderService.findMatchingMapping(mappingContext);

						if (!mapping || mapping.channels.length === 0) {
							this.logger.warn(
								`No mapping found for switch component key=${key} device=${device.id} category=${device.category}. Using default SWITCHER channel.`,
								{
									resource: device.id,
									componentKey: key,
									deviceCategory: device.category,
								},
							);

							// Fallback to default switcher channel
							const chan = await this.ensureChannel(
								device,
								'identifier',
								`switch:${key}`,
								ChannelCategory.SWITCHER,
								switchConfig.name ?? `Switch: ${key}`,
							);
							channelsIds.push(chan.id);
							await this.ensureProperty(chan, PropertyCategory.ON, 'identifier', 'output', !!switchStatus.output);
							return;
						}

						const channelDef = mapping.channels[0];
						const cat = channelDef.category;
						const chanName =
							switchConfig.name ??
							this.mappingLoaderService.interpolateTemplate(channelDef.name ?? `Switch: {key}`, mappingContext);

						const chan = await this.ensureChannel(device, 'identifier', `switch:${key}`, cat, chanName);

						channelsIds.push(chan.id);

						// Apply transformer if defined in mapping
						const onPropertyMapping = this.findPropertyMapping(channelDef, PropertyCategory.ON);
						const transformedOutput = this.applyTransformer(onPropertyMapping, switchStatus.output, 'read');
						await this.ensureProperty(
							chan,
							PropertyCategory.ON,
							'identifier',
							onPropertyMapping?.shellyProperty ?? 'output',
							transformedOutput as boolean,
							undefined,
							onPropertyMapping,
						);

						if (cat === ChannelCategory.VALVE) {
							await this.ensureProperty(chan, PropertyCategory.TYPE, 'identifier', 'output', 'generic', {
								format: ['generic', 'irrigation', 'shower_head', 'water_faucet'],
							});
						}

						const energyName = switchConfig.name
							? `Consumption: ${switchConfig.name}`
							: `${cat === ChannelCategory.LIGHT ? 'Light' : cat === ChannelCategory.FAN ? 'Fan' : cat === ChannelCategory.VALVE ? 'Valve' : 'Switch'} consumption: ${key}`;

						const powerName = switchConfig.name
							? `Power: ${switchConfig.name}`
							: `${cat === ChannelCategory.LIGHT ? 'Light' : cat === ChannelCategory.FAN ? 'Fan' : cat === ChannelCategory.VALVE ? 'Valve' : 'Switch'} power: ${key}`;

						const ee = await this.ensureElectricalEnergy(device, key, switchStatus, energyName, chan.id);

						if (ee) {
							channelsIds.push(ee.channel.id);
						}

						const ep = await this.ensureElectricalPower(device, key, switchStatus, powerName, chan.id);

						if (ep) {
							channelsIds.push(ep.channel.id);
						}
					}),
				);

				const settled = await Promise.allSettled(tasks);

				const failed = settled.filter((r) => r.status === 'rejected').length;

				if (failed) {
					this.logger.warn(`${failed}/${ids.length} switch component(s) failed for device=${device.id}`, {
						resource: device.id,
					});
				}
			} else if (type === String(ComponentType.COVER) && deviceInfo.profile === String(DeviceProfile.COVER)) {
				const tasks = ids.map((key) =>
					limit(async () => {
						const [coverConfig, coverStatus] = await retry(
							() =>
								withTimeout(
									Promise.all([
										this.shellyRpcClientService.getCoverConfig(host, key, { password }),
										this.shellyRpcClientService.getCoverStatus(host, key, { password }),
									]),
									this.timeoutSec * 1000,
									`Cover.GetConfig+Cover.GetStatus - ${key}`,
								),
							{ retries: 2, baseMs: 300, factor: 2 },
						).catch((err: Error) => {
							this.logger.error(`Failed load for cover=${key} on device=${device.id}`, {
								resource: device.id,
								message: err.message,
								stack: err.stack,
							});

							throw err;
						});

						// Use YAML mapping for cover component
						const coverMappingContext: MappingContext = {
							componentType: ComponentType.COVER,
							componentKey: key,
							deviceCategory: device.category,
							model: deviceInfo.model,
							profile: deviceInfo.profile ?? undefined,
						};

						const coverMapping = this.mappingLoaderService.findMatchingMapping(coverMappingContext);

						if (!coverMapping || coverMapping.channels.length === 0) {
							this.logger.warn(
								`No mapping found for cover component key=${key} device=${device.id} category=${device.category}. Using default WINDOW_COVERING channel.`,
								{
									resource: device.id,
									componentKey: key,
									deviceCategory: device.category,
								},
							);

							// Fallback to default window covering channel
							const chan = await this.ensureChannel(
								device,
								'identifier',
								`cover:${key}`,
								ChannelCategory.WINDOW_COVERING,
								coverConfig.name ?? `Cover: ${key}`,
							);
							channelsIds.push(chan.id);
							await this.ensureProperty(chan, PropertyCategory.STATUS, 'identifier', 'state', coverStatus.state);
							await this.ensureProperty(
								chan,
								PropertyCategory.POSITION,
								'identifier',
								'current_pos',
								coverStatus.current_pos,
							);
							await this.ensureProperty(chan, PropertyCategory.COMMAND, 'category', PropertyCategory.COMMAND, 'stop');
							return;
						}

						const coverChannelDef = coverMapping.channels[0];
						const coverCat = coverChannelDef.category;
						const coverChanName =
							coverConfig.name ??
							this.mappingLoaderService.interpolateTemplate(coverChannelDef.name ?? `Cover: {key}`, coverMappingContext);

						const chan = await this.ensureChannel(
							device,
							'identifier',
							`cover:${key}`,
							coverCat,
							coverChanName,
						);

						channelsIds.push(chan.id);

						// Apply transformers from mapping
						const statusPropertyMapping = this.findPropertyMapping(coverChannelDef, PropertyCategory.STATUS);
						const transformedState = this.applyTransformer(statusPropertyMapping, coverStatus.state, 'read');
						await this.ensureProperty(
							chan,
							PropertyCategory.STATUS,
							'identifier',
							statusPropertyMapping?.shellyProperty ?? 'state',
							transformedState as string,
							undefined,
							statusPropertyMapping,
						);

						const positionPropertyMapping = this.findPropertyMapping(coverChannelDef, PropertyCategory.POSITION);
						const transformedPosition = this.applyTransformer(
							positionPropertyMapping,
							coverStatus.current_pos,
							'read',
						);
						await this.ensureProperty(
							chan,
							PropertyCategory.POSITION,
							'identifier',
							positionPropertyMapping?.shellyProperty ?? 'current_pos',
							transformedPosition as number,
							undefined,
							positionPropertyMapping,
						);

						// Handle static properties
						if (coverChannelDef.staticProperties) {
							for (const staticProp of coverChannelDef.staticProperties) {
								await this.ensureProperty(
									chan,
									staticProp.identifier,
									'category',
									staticProp.identifier,
									staticProp.value,
									{
										data_type: staticProp.dataType,
										format: staticProp.format,
										unit: staticProp.unit ?? null,
									},
								);
							}
						}

						// Handle derived properties
						if (coverChannelDef.derivedProperties) {
							for (const derivedProp of coverChannelDef.derivedProperties) {
								// Find source property value
								const sourceProp = await this.channelsPropertiesService.findOneBy<ShellyNgChannelPropertyEntity>(
									'category',
									derivedProp.sourceProperty,
									chan.id,
								);

								if (sourceProp && sourceProp.value !== null && sourceProp.value !== undefined) {
									// Apply derivation rule
									const derivedValue = this.applyDerivation(
										derivedProp.derivationName ? this.mappingLoaderService.getDerivation(derivedProp.derivationName)?.rule : derivedProp.inlineDerivation,
										sourceProp.value,
									);

									if (derivedValue !== undefined) {
										await this.ensureProperty(
											chan,
											derivedProp.identifier,
											'category',
											derivedProp.identifier,
											derivedValue as string | number | boolean,
											{
												data_type: derivedProp.dataType,
												format: derivedProp.format,
												unit: derivedProp.unit ?? null,
											},
										);
									}
								}
							}
						}

						const ee = await this.ensureElectricalEnergy(
							device,
							key,
							coverStatus,
							coverConfig.name ? `Consumption: ${coverConfig.name}` : `Cover consumption: ${key}`,
							chan.id,
						);

						if (ee) {
							channelsIds.push(ee.channel.id);
						}

						const ep = await this.ensureElectricalPower(
							device,
							key,
							coverStatus,
							coverConfig.name ? `Power: ${coverConfig.name}` : `Cover power: ${key}`,
							chan.id,
						);

						if (ep) {
							channelsIds.push(ep.channel.id);
						}
					}),
				);

				const settled = await Promise.allSettled(tasks);

				const failed = settled.filter((r) => r.status === 'rejected').length;

				if (failed) {
					this.logger.warn(`${failed}/${ids.length} cover component(s) failed for device=${device.id}`, {
						resource: device.id,
					});
				}
			} else if (type === String(ComponentType.LIGHT)) {
				const tasks = ids.map((key) =>
					limit(async () => {
						const [lightConfig, lightStatus] = await retry(
							() =>
								withTimeout(
									Promise.all([
										this.shellyRpcClientService.getLightConfig(host, key, { password }),
										this.shellyRpcClientService.getLightStatus(host, key, { password }),
									]),
									this.timeoutSec * 1000,
									`Light.GetConfig+Light.GetStatus - ${key}`,
								),
							{ retries: 2, baseMs: 300, factor: 2 },
						).catch((err: Error) => {
							this.logger.error(`Failed load for light=${key} on device=${device.id}`, {
								resource: device.id,
								message: err.message,
								stack: err.stack,
							});

							throw err;
						});

						// Use YAML mapping for light component
						const lightMappingContext: MappingContext = {
							componentType: ComponentType.LIGHT,
							componentKey: key,
							deviceCategory: device.category,
							model: deviceInfo.model,
							profile: deviceInfo.profile ?? undefined,
						};

						const lightMapping = this.mappingLoaderService.findMatchingMapping(lightMappingContext);

						if (!lightMapping || lightMapping.channels.length === 0) {
							this.logger.warn(
								`No mapping found for light component key=${key} device=${device.id} category=${device.category}. Using default LIGHT channel.`,
								{
									resource: device.id,
									componentKey: key,
									deviceCategory: device.category,
								},
							);

							// Fallback to default light channel
							const chan = await this.ensureChannel(
								device,
								'identifier',
								`light:${key}`,
								ChannelCategory.LIGHT,
								lightConfig.name ?? `Light: ${key}`,
							);
							channelsIds.push(chan.id);
							await this.ensureProperty(chan, PropertyCategory.ON, 'identifier', 'output', lightStatus.output);
							if (typeof lightStatus.brightness !== 'undefined') {
								await this.ensureProperty(
									chan,
									PropertyCategory.BRIGHTNESS,
									'identifier',
									'brightness',
									lightStatus.brightness,
								);
							}
							return;
						}

						const lightChannelDef = lightMapping.channels[0];
						const lightCat = lightChannelDef.category;
						const lightChanName =
							lightConfig.name ??
							this.mappingLoaderService.interpolateTemplate(lightChannelDef.name ?? `Light: {key}`, lightMappingContext);

						const chan = await this.ensureChannel(
							device,
							'identifier',
							`light:${key}`,
							lightCat,
							lightChanName,
						);

						channelsIds.push(chan.id);

						// Apply transformers from mapping
						const onPropertyMapping = this.findPropertyMapping(lightChannelDef, PropertyCategory.ON);
						const transformedOutput = this.applyTransformer(onPropertyMapping, lightStatus.output, 'read');
						await this.ensureProperty(
							chan,
							PropertyCategory.ON,
							'identifier',
							onPropertyMapping?.shellyProperty ?? 'output',
							transformedOutput as boolean,
							undefined,
							onPropertyMapping,
						);

						if (typeof lightStatus.brightness !== 'undefined') {
							const brightnessPropertyMapping = this.findPropertyMapping(
								lightChannelDef,
								PropertyCategory.BRIGHTNESS,
							);
							const transformedBrightness = this.applyTransformer(
								brightnessPropertyMapping,
								lightStatus.brightness,
								'read',
							);
							await this.ensureProperty(
								chan,
								PropertyCategory.BRIGHTNESS,
								'identifier',
								brightnessPropertyMapping?.shellyProperty ?? 'brightness',
								transformedBrightness as number,
								undefined,
								brightnessPropertyMapping,
							);
						}

						const ee = await this.ensureElectricalEnergy(
							device,
							key,
							lightStatus,
							lightConfig.name ? `Consumption: ${lightConfig.name}` : `Light consumption: ${key}`,
							chan.id,
						);

						if (ee) {
							channelsIds.push(ee.channel.id);
						}

						const ep = await this.ensureElectricalPower(
							device,
							key,
							lightStatus,
							lightConfig.name ? `Power: ${lightConfig.name}` : `Light power: ${key}`,
							chan.id,
						);

						if (ep) {
							channelsIds.push(ep.channel.id);
						}
					}),
				);

				const settled = await Promise.allSettled(tasks);

				const failed = settled.filter((r) => r.status === 'rejected').length;

				if (failed) {
					this.logger.warn(`${failed}/${ids.length} light component(s) failed for device=${device.id}`, {
						resource: device.id,
					});
				}
			} else if (type === String(ComponentType.RGB)) {
				const tasks = ids.map((key) =>
					limit(async () => {
						const [rgbConfig, rgbStatus] = await retry(
							() =>
								withTimeout(
									Promise.all([
										this.shellyRpcClientService.getRgbConfig(host, key, { password }),
										this.shellyRpcClientService.getRgbStatus(host, key, { password }),
									]),
									this.timeoutSec * 1000,
									`RGB.GetConfig+RGB.GetStatus - ${key}`,
								),
							{ retries: 2, baseMs: 300, factor: 2 },
						).catch((err: Error) => {
							this.logger.error(`Failed load for rgb=${key} on device=${device.id}`, {
								resource: device.id,
								message: err.message,
								stack: err.stack,
							});

							throw err;
						});

						// Use YAML mapping for RGB component
						const rgbMappingContext: MappingContext = {
							componentType: ComponentType.RGB,
							componentKey: key,
							deviceCategory: device.category,
							model: deviceInfo.model,
							profile: deviceInfo.profile ?? undefined,
						};

						const rgbMapping = this.mappingLoaderService.findMatchingMapping(rgbMappingContext);

						if (!rgbMapping || rgbMapping.channels.length === 0) {
							this.logger.warn(
								`No mapping found for rgb component key=${key} device=${device.id} category=${device.category}. Using default LIGHT channel.`,
								{
									resource: device.id,
									componentKey: key,
									deviceCategory: device.category,
								},
							);

							// Fallback to default light channel
							const chan = await this.ensureChannel(
								device,
								'identifier',
								`rgb:${key}`,
								ChannelCategory.LIGHT,
								rgbConfig.name ?? `RGB: ${key}`,
							);
							channelsIds.push(chan.id);
							await this.ensureProperty(chan, PropertyCategory.ON, 'identifier', 'output', rgbStatus.output);
							if (typeof rgbStatus.brightness !== 'undefined') {
								await this.ensureProperty(
									chan,
									PropertyCategory.BRIGHTNESS,
									'identifier',
									'brightness',
									rgbStatus.brightness,
								);
							}
							if (typeof rgbStatus.rgb !== 'undefined' && Array.isArray(rgbStatus.rgb) && rgbStatus.rgb.length === 3) {
								await this.ensureProperty(chan, PropertyCategory.COLOR_RED, 'identifier', 'rgb:red', rgbStatus.rgb[0]);
								await this.ensureProperty(chan, PropertyCategory.COLOR_GREEN, 'identifier', 'rgb:green', rgbStatus.rgb[1]);
								await this.ensureProperty(chan, PropertyCategory.COLOR_BLUE, 'identifier', 'rgb:blue', rgbStatus.rgb[2]);
							}
							return;
						}

						const rgbChannelDef = rgbMapping.channels[0];
						const rgbCat = rgbChannelDef.category;
						const rgbChanName =
							rgbConfig.name ??
							this.mappingLoaderService.interpolateTemplate(rgbChannelDef.name ?? `RGB: {key}`, rgbMappingContext);

						const chan = await this.ensureChannel(
							device,
							'identifier',
							`rgb:${key}`,
							rgbCat,
							rgbChanName,
						);

						channelsIds.push(chan.id);

						// Apply transformers from mapping
						const onPropertyMapping = this.findPropertyMapping(rgbChannelDef, PropertyCategory.ON);
						const transformedOutput = this.applyTransformer(onPropertyMapping, rgbStatus.output, 'read');
						await this.ensureProperty(
							chan,
							PropertyCategory.ON,
							'identifier',
							onPropertyMapping?.shellyProperty ?? 'output',
							transformedOutput as boolean,
							undefined,
							onPropertyMapping,
						);

						if (typeof rgbStatus.brightness !== 'undefined') {
							const brightnessPropertyMapping = this.findPropertyMapping(
								rgbChannelDef,
								PropertyCategory.BRIGHTNESS,
							);
							const transformedBrightness = this.applyTransformer(
								brightnessPropertyMapping,
								rgbStatus.brightness,
								'read',
							);
							await this.ensureProperty(
								chan,
								PropertyCategory.BRIGHTNESS,
								'identifier',
								brightnessPropertyMapping?.shellyProperty ?? 'brightness',
								transformedBrightness as number,
								undefined,
								brightnessPropertyMapping,
							);
						}

						if (typeof rgbStatus.rgb !== 'undefined' && Array.isArray(rgbStatus.rgb) && rgbStatus.rgb.length === 3) {
							const redPropertyMapping = this.findPropertyMapping(rgbChannelDef, PropertyCategory.COLOR_RED);
							const transformedRed = this.applyTransformer(redPropertyMapping, rgbStatus.rgb[0], 'read');
							await this.ensureProperty(
								chan,
								PropertyCategory.COLOR_RED,
								'identifier',
								redPropertyMapping?.shellyProperty ?? 'rgb:red',
								transformedRed as number,
								undefined,
								redPropertyMapping,
							);

							const greenPropertyMapping = this.findPropertyMapping(rgbChannelDef, PropertyCategory.COLOR_GREEN);
							const transformedGreen = this.applyTransformer(greenPropertyMapping, rgbStatus.rgb[1], 'read');
							await this.ensureProperty(
								chan,
								PropertyCategory.COLOR_GREEN,
								'identifier',
								greenPropertyMapping?.shellyProperty ?? 'rgb:green',
								transformedGreen as number,
								undefined,
								greenPropertyMapping,
							);

							const bluePropertyMapping = this.findPropertyMapping(rgbChannelDef, PropertyCategory.COLOR_BLUE);
							const transformedBlue = this.applyTransformer(bluePropertyMapping, rgbStatus.rgb[2], 'read');
							await this.ensureProperty(
								chan,
								PropertyCategory.COLOR_BLUE,
								'identifier',
								bluePropertyMapping?.shellyProperty ?? 'rgb:blue',
								transformedBlue as number,
								undefined,
								bluePropertyMapping,
							);
						}

						const ee = await this.ensureElectricalEnergy(
							device,
							key,
							rgbStatus,
							rgbConfig.name ? `Consumption: ${rgbConfig.name}` : `RGB consumption: ${key}`,
							chan.id,
						);

						if (ee) {
							channelsIds.push(ee.channel.id);
						}

						const ep = await this.ensureElectricalPower(
							device,
							key,
							rgbStatus,
							rgbConfig.name ? `Power: ${rgbConfig.name}` : `RGB power: ${key}`,
							chan.id,
						);

						if (ep) {
							channelsIds.push(ep.channel.id);
						}
					}),
				);

				const settled = await Promise.allSettled(tasks);

				const failed = settled.filter((r) => r.status === 'rejected').length;

				if (failed) {
					this.logger.warn(`${failed}/${ids.length} rgb component(s) failed for device=${device.id}`, {
						resource: device.id,
					});
				}
			} else if (type === String(ComponentType.RGBW)) {
				const tasks = ids.map((key) =>
					limit(async () => {
						const [rgbwConfig, rgbwStatus] = await retry(
							() =>
								withTimeout(
									Promise.all([
										this.shellyRpcClientService.getRgbwConfig(host, key, { password }),
										this.shellyRpcClientService.getRgbwStatus(host, key, { password }),
									]),
									this.timeoutSec * 1000,
									`RGBW.GetConfig+RGBW.GetStatus - ${key}`,
								),
							{ retries: 2, baseMs: 300, factor: 2 },
						).catch((err: Error) => {
							this.logger.error(`Failed load for rgbw=${key} on device=${device.id}`, {
								resource: device.id,
								message: err.message,
								stack: err.stack,
							});

							throw err;
						});

						// Use YAML mapping for RGBW component
						const rgbwMappingContext: MappingContext = {
							componentType: ComponentType.RGBW,
							componentKey: key,
							deviceCategory: device.category,
							model: deviceInfo.model,
							profile: deviceInfo.profile ?? undefined,
						};

						const rgbwMapping = this.mappingLoaderService.findMatchingMapping(rgbwMappingContext);

						if (!rgbwMapping || rgbwMapping.channels.length === 0) {
							this.logger.warn(
								`No mapping found for rgbw component key=${key} device=${device.id} category=${device.category}. Using default LIGHT channel.`,
								{
									resource: device.id,
									componentKey: key,
									deviceCategory: device.category,
								},
							);

							// Fallback to default light channel
							const chan = await this.ensureChannel(
								device,
								'identifier',
								`rgbw:${key}`,
								ChannelCategory.LIGHT,
								rgbwConfig.name ?? `RGBW: ${key}`,
							);
							channelsIds.push(chan.id);
							await this.ensureProperty(chan, PropertyCategory.ON, 'identifier', 'output', rgbwStatus.output);
							if (typeof rgbwStatus.brightness !== 'undefined') {
								await this.ensureProperty(chan, PropertyCategory.BRIGHTNESS, 'identifier', 'brightness', rgbwStatus.brightness);
							}
							if (typeof rgbwStatus.rgb !== 'undefined' && Array.isArray(rgbwStatus.rgb) && rgbwStatus.rgb.length === 3) {
								await this.ensureProperty(chan, PropertyCategory.COLOR_RED, 'identifier', 'rgb:red', rgbwStatus.rgb[0]);
								await this.ensureProperty(chan, PropertyCategory.COLOR_GREEN, 'identifier', 'rgb:green', rgbwStatus.rgb[1]);
								await this.ensureProperty(chan, PropertyCategory.COLOR_BLUE, 'identifier', 'rgb:blue', rgbwStatus.rgb[2]);
							}
							if (typeof rgbwStatus.white !== 'undefined') {
								await this.ensureProperty(chan, PropertyCategory.COLOR_WHITE, 'identifier', 'white', rgbwStatus.white);
							}
							return;
						}

						const rgbwChannelDef = rgbwMapping.channels[0];
						const rgbwCat = rgbwChannelDef.category;
						const rgbwChanName =
							rgbwConfig.name ??
							this.mappingLoaderService.interpolateTemplate(rgbwChannelDef.name ?? `RGBW: {key}`, rgbwMappingContext);

						const chan = await this.ensureChannel(
							device,
							'identifier',
							`rgbw:${key}`,
							rgbwCat,
							rgbwChanName,
						);

						channelsIds.push(chan.id);

						// Apply transformers from mapping
						const onPropertyMapping = this.findPropertyMapping(rgbwChannelDef, PropertyCategory.ON);
						const transformedOutput = this.applyTransformer(onPropertyMapping, rgbwStatus.output, 'read');
						await this.ensureProperty(
							chan,
							PropertyCategory.ON,
							'identifier',
							onPropertyMapping?.shellyProperty ?? 'output',
							transformedOutput as boolean,
							undefined,
							onPropertyMapping,
						);

						if (typeof rgbwStatus.brightness !== 'undefined') {
							const brightnessPropertyMapping = this.findPropertyMapping(
								rgbwChannelDef,
								PropertyCategory.BRIGHTNESS,
							);
							const transformedBrightness = this.applyTransformer(
								brightnessPropertyMapping,
								rgbwStatus.brightness,
								'read',
							);
							await this.ensureProperty(
								chan,
								PropertyCategory.BRIGHTNESS,
								'identifier',
								brightnessPropertyMapping?.shellyProperty ?? 'brightness',
								transformedBrightness as number,
								undefined,
								brightnessPropertyMapping,
							);
						}

						if (typeof rgbwStatus.rgb !== 'undefined' && Array.isArray(rgbwStatus.rgb) && rgbwStatus.rgb.length === 3) {
							const redPropertyMapping = this.findPropertyMapping(rgbwChannelDef, PropertyCategory.COLOR_RED);
							const transformedRed = this.applyTransformer(redPropertyMapping, rgbwStatus.rgb[0], 'read');
							await this.ensureProperty(
								chan,
								PropertyCategory.COLOR_RED,
								'identifier',
								redPropertyMapping?.shellyProperty ?? 'rgb:red',
								transformedRed as number,
								undefined,
								redPropertyMapping,
							);

							const greenPropertyMapping = this.findPropertyMapping(rgbwChannelDef, PropertyCategory.COLOR_GREEN);
							const transformedGreen = this.applyTransformer(greenPropertyMapping, rgbwStatus.rgb[1], 'read');
							await this.ensureProperty(
								chan,
								PropertyCategory.COLOR_GREEN,
								'identifier',
								greenPropertyMapping?.shellyProperty ?? 'rgb:green',
								transformedGreen as number,
								undefined,
								greenPropertyMapping,
							);

							const bluePropertyMapping = this.findPropertyMapping(rgbwChannelDef, PropertyCategory.COLOR_BLUE);
							const transformedBlue = this.applyTransformer(bluePropertyMapping, rgbwStatus.rgb[2], 'read');
							await this.ensureProperty(
								chan,
								PropertyCategory.COLOR_BLUE,
								'identifier',
								bluePropertyMapping?.shellyProperty ?? 'rgb:blue',
								transformedBlue as number,
								undefined,
								bluePropertyMapping,
							);
						}

						if (typeof rgbwStatus.white !== 'undefined') {
							const whitePropertyMapping = this.findPropertyMapping(rgbwChannelDef, PropertyCategory.COLOR_WHITE);
							const transformedWhite = this.applyTransformer(whitePropertyMapping, rgbwStatus.white, 'read');
							await this.ensureProperty(
								chan,
								PropertyCategory.COLOR_WHITE,
								'identifier',
								whitePropertyMapping?.shellyProperty ?? 'white',
								transformedWhite as number,
								undefined,
								whitePropertyMapping,
							);
						}

						const ee = await this.ensureElectricalEnergy(
							device,
							key,
							rgbwStatus,
							rgbwConfig.name ? `Consumption: ${rgbwConfig.name}` : `RGBW consumption: ${key}`,
							chan.id,
						);

						if (ee) {
							channelsIds.push(ee.channel.id);
						}

						const ep = await this.ensureElectricalPower(
							device,
							key,
							rgbwStatus,
							rgbwConfig.name ? `Power: ${rgbwConfig.name}` : `RGBW power: ${key}`,
							chan.id,
						);

						if (ep) {
							channelsIds.push(ep.channel.id);
						}
					}),
				);

				const settled = await Promise.allSettled(tasks);

				const failed = settled.filter((r) => r.status === 'rejected').length;

				if (failed) {
					this.logger.warn(`${failed}/${ids.length} rgbw component(s) failed for device=${device.id}`, {
						resource: device.id,
					});
				}
			} else if (type === String(ComponentType.CCT)) {
				const tasks = ids.map((key) =>
					limit(async () => {
						const [cctConfig, cctStatus] = await retry(
							() =>
								withTimeout(
									Promise.all([
										this.shellyRpcClientService.getCctConfig(host, key, { password }),
										this.shellyRpcClientService.getCctStatus(host, key, { password }),
									]),
									this.timeoutSec * 1000,
									`CCT.GetConfig+CCT.GetStatus - ${key}`,
								),
							{ retries: 2, baseMs: 300, factor: 2 },
						).catch((err: Error) => {
							this.logger.error(`Failed load for cct=${key} on device=${device.id}`, {
								resource: device.id,
								message: err.message,
								stack: err.stack,
							});

							throw err;
						});

						// Use YAML mapping for CCT component
						const cctMappingContext: MappingContext = {
							componentType: ComponentType.CCT,
							componentKey: key,
							deviceCategory: device.category,
							model: deviceInfo.model,
							profile: deviceInfo.profile ?? undefined,
						};

						const cctMapping = this.mappingLoaderService.findMatchingMapping(cctMappingContext);

						if (!cctMapping || cctMapping.channels.length === 0) {
							this.logger.warn(
								`No mapping found for cct component key=${key} device=${device.id} category=${device.category}. Using default LIGHT channel.`,
								{
									resource: device.id,
									componentKey: key,
									deviceCategory: device.category,
								},
							);

							// Fallback to default light channel
							const chan = await this.ensureChannel(
								device,
								'identifier',
								`cct:${key}`,
								ChannelCategory.LIGHT,
								cctConfig.name ?? `CCT: ${key}`,
							);
							channelsIds.push(chan.id);
							await this.ensureProperty(chan, PropertyCategory.ON, 'identifier', 'output', cctStatus.output);
							if (typeof cctStatus.brightness !== 'undefined') {
								await this.ensureProperty(chan, PropertyCategory.BRIGHTNESS, 'identifier', 'brightness', cctStatus.brightness);
							}
							if (typeof cctStatus.ct !== 'undefined') {
								await this.ensureProperty(chan, PropertyCategory.COLOR_TEMPERATURE, 'identifier', 'temperature', cctStatus.ct);
							}
							return;
						}

						const cctChannelDef = cctMapping.channels[0];
						const cctCat = cctChannelDef.category;
						const cctChanName =
							cctConfig.name ??
							this.mappingLoaderService.interpolateTemplate(cctChannelDef.name ?? `CCT: {key}`, cctMappingContext);

						const chan = await this.ensureChannel(
							device,
							'identifier',
							`cct:${key}`,
							cctCat,
							cctChanName,
						);

						channelsIds.push(chan.id);

						// Apply transformers from mapping
						const onPropertyMapping = this.findPropertyMapping(cctChannelDef, PropertyCategory.ON);
						const transformedOutput = this.applyTransformer(onPropertyMapping, cctStatus.output, 'read');
						await this.ensureProperty(
							chan,
							PropertyCategory.ON,
							'identifier',
							onPropertyMapping?.shellyProperty ?? 'output',
							transformedOutput as boolean,
							undefined,
							onPropertyMapping,
						);

						if (typeof cctStatus.brightness !== 'undefined') {
							const brightnessPropertyMapping = this.findPropertyMapping(cctChannelDef, PropertyCategory.BRIGHTNESS);
							const transformedBrightness = this.applyTransformer(
								brightnessPropertyMapping,
								cctStatus.brightness,
								'read',
							);
							await this.ensureProperty(
								chan,
								PropertyCategory.BRIGHTNESS,
								'identifier',
								brightnessPropertyMapping?.shellyProperty ?? 'brightness',
								transformedBrightness as number,
								undefined,
								brightnessPropertyMapping,
							);
						}

						if (typeof cctStatus.ct !== 'undefined') {
							const ctPropertyMapping = this.findPropertyMapping(cctChannelDef, PropertyCategory.COLOR_TEMPERATURE);
							const transformedCt = this.applyTransformer(ctPropertyMapping, cctStatus.ct, 'read');
							await this.ensureProperty(
								chan,
								PropertyCategory.COLOR_TEMPERATURE,
								'identifier',
								ctPropertyMapping?.shellyProperty ?? 'temperature',
								transformedCt as number,
								undefined,
								ctPropertyMapping,
							);
						}

						const ee = await this.ensureElectricalEnergy(
							device,
							key,
							cctStatus,
							cctConfig.name ? `Consumption: ${cctConfig.name}` : `CCT consumption: ${key}`,
							chan.id,
						);

						if (ee) {
							channelsIds.push(ee.channel.id);
						}

						const ep = await this.ensureElectricalPower(
							device,
							key,
							cctStatus,
							cctConfig.name ? `Power: ${cctConfig.name}` : `CCT power: ${key}`,
							chan.id,
						);

						if (ep) {
							channelsIds.push(ep.channel.id);
						}
					}),
				);

				const settled = await Promise.allSettled(tasks);

				const failed = settled.filter((r) => r.status === 'rejected').length;

				if (failed) {
					this.logger.warn(`${failed}/${ids.length} cct component(s) failed for device=${device.id}`, {
						resource: device.id,
					});
				}
			} else if (type === String(ComponentType.INPUT)) {
				const tasks = ids.map((key) =>
					limit(async () => {
						await retry(
							() =>
								withTimeout(
									Promise.all([
										this.shellyRpcClientService.getInputConfig(host, key, { password }),
										this.shellyRpcClientService.getInputStatus(host, key, { password }),
									]),
									this.timeoutSec * 1000,
									`Input.GetConfig+Input.GetStatus - ${key}`,
								),
							{ retries: 2, baseMs: 300, factor: 2 },
						).catch((err: Error) => {
							this.logger.error(`Failed load for input=${key} on device=${device.id}`, {
								resource: device.id,
								message: err.message,
								stack: err.stack,
							});

							throw err;
						});

						/**
						 * NOTE: Input processing is not yet implemented.
						 *
						 * Future implementation should:
						 * 1. Create or update input channels based on inputConfig
						 * 2. Map input types (button, switch, analog) to appropriate channel properties
						 * 3. Store input state (pressed, released, long-press) based on inputStatus
						 * 4. Handle input events (single press, double press, long press) via WebSocket
						 *
						 * Reference: Shelly Gen2 API Input component documentation
						 * @see https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Input
						 */
					}),
				);

				const settled = await Promise.allSettled(tasks);

				const failed = settled.filter((r) => r.status === 'rejected').length;

				if (failed) {
					this.logger.warn(`${failed}/${ids.length} input component(s) failed for device=${device.id}`, {
						resource: device.id,
					});
				}
			} else if (type === String(ComponentType.DEVICE_POWER)) {
				for (const key of ids) {
					let devicePowerStatus: Awaited<ReturnType<typeof this.shellyRpcClientService.getDevicePowerStatus>>;

					try {
						devicePowerStatus = await this.shellyRpcClientService.getDevicePowerStatus(device.hostname, key, {
							password: device.password,
						});
					} catch (error) {
						const err = error as Error;

						this.logger.error(`Failed to load device power status for device=${device.id} and devicePower=${key}`, {
							resource: device.id,
							message: err.message,
							stack: err.stack,
						});

						continue;
					}

					if (typeof devicePowerStatus.battery !== 'undefined') {
						// Use YAML mapping for device power (battery) component
						const batteryMappingContext: MappingContext = {
							componentType: ComponentType.DEVICE_POWER,
							componentKey: key,
							deviceCategory: device.category,
							model: deviceInfo.model,
							profile: deviceInfo.profile ?? undefined,
						};

						const batteryMapping = this.mappingLoaderService.findMatchingMapping(batteryMappingContext);

						if (!batteryMapping || batteryMapping.channels.length === 0) {
							this.logger.warn(
								`No mapping found for device power component key=${key} device=${device.id} category=${device.category}. Using default BATTERY channel.`,
								{
									resource: device.id,
									componentKey: key,
									deviceCategory: device.category,
								},
							);

							// Fallback to default battery channel
							const battery = await this.ensureChannel(
								device,
								'identifier',
								`devicePower:${key}`,
								ChannelCategory.BATTERY,
								`Device power: ${key}`,
							);
							channelsIds.push(battery.id);
							await this.ensureProperty(battery, PropertyCategory.PERCENTAGE, 'identifier', 'battery', devicePowerStatus.battery.percent);
							continue;
						}

						const batteryChannelDef = batteryMapping.channels[0];
						const batteryCat = batteryChannelDef.category;
						const batteryChanName =
							this.mappingLoaderService.interpolateTemplate(batteryChannelDef.name ?? `Battery: {key}`, batteryMappingContext);

						const battery = await this.ensureChannel(
							device,
							'identifier',
							`devicePower:${key}`,
							batteryCat,
							batteryChanName,
						);
						channelsIds.push(battery.id);

						// Apply transformers from mapping
						const percentagePropertyMapping = this.findPropertyMapping(batteryChannelDef, PropertyCategory.PERCENTAGE);
						const transformedPercentage = this.applyTransformer(
							percentagePropertyMapping,
							devicePowerStatus.battery.percent,
							'read',
						);
						await this.ensureProperty(
							battery,
							PropertyCategory.PERCENTAGE,
							'identifier',
							percentagePropertyMapping?.shellyProperty ?? 'battery',
							transformedPercentage as number,
							undefined,
							percentagePropertyMapping,
						);

						// Handle derived properties
						if (batteryChannelDef.derivedProperties) {
							for (const derivedProp of batteryChannelDef.derivedProperties) {
								// Find source property value
								const sourceProp = await this.channelsPropertiesService.findOneBy<ShellyNgChannelPropertyEntity>(
									'category',
									derivedProp.sourceProperty,
									battery.id,
								);

								if (sourceProp && sourceProp.value !== null && sourceProp.value !== undefined) {
									// Apply derivation rule
									const derivedValue = this.applyDerivation(
										derivedProp.derivationName
											? this.mappingLoaderService.getDerivation(derivedProp.derivationName)?.rule
											: derivedProp.inlineDerivation,
										sourceProp.value,
									);

									if (derivedValue !== undefined) {
										await this.ensureProperty(
											battery,
											derivedProp.identifier,
											'category',
											derivedProp.identifier,
											derivedValue as string | number | boolean,
											{
												data_type: derivedProp.dataType,
												format: derivedProp.format,
												unit: derivedProp.unit ?? null,
											},
										);
									}
								}
							}
						}
					}
				}
			} else if (type === String(ComponentType.HUMIDITY)) {
				const tasks = ids.map((key) =>
					limit(async () => {
						const [humidityConfig, humidityStatus] = await retry(
							() =>
								withTimeout(
									Promise.all([
										this.shellyRpcClientService.getHumidityConfig(host, key, { password }),
										this.shellyRpcClientService.getHumidityStatus(host, key, { password }),
									]),
									this.timeoutSec * 1000,
									`Humidity.GetConfig+Humidity.GetStatus - ${key}`,
								),
							{ retries: 2, baseMs: 300, factor: 2 },
						).catch((err: Error) => {
							this.logger.error(`Failed load for humidity=${key} on device=${device.id}`, {
								resource: device.id,
								message: err.message,
								stack: err.stack,
							});

							throw err;
						});

						// Use YAML mapping for humidity component
						const humidityMappingContext: MappingContext = {
							componentType: ComponentType.HUMIDITY,
							componentKey: key,
							deviceCategory: device.category,
							model: deviceInfo.model,
							profile: deviceInfo.profile ?? undefined,
						};

						const humidityMapping = this.mappingLoaderService.findMatchingMapping(humidityMappingContext);

						if (!humidityMapping || humidityMapping.channels.length === 0) {
							this.logger.warn(
								`No mapping found for humidity component key=${key} device=${device.id} category=${device.category}. Using default HUMIDITY channel.`,
								{
									resource: device.id,
									componentKey: key,
									deviceCategory: device.category,
								},
							);

							// Fallback to default humidity channel
							const chan = await this.ensureChannel(
								device,
								'identifier',
								`humidity:${key}`,
								ChannelCategory.HUMIDITY,
								humidityConfig.name ?? `Humidity: ${key}`,
							);
							channelsIds.push(chan.id);
							await this.ensureProperty(chan, PropertyCategory.HUMIDITY, 'identifier', 'rh', humidityStatus.rh);
							return;
						}

						const humidityChannelDef = humidityMapping.channels[0];
						const humidityCat = humidityChannelDef.category;
						const humidityChanName =
							humidityConfig.name ??
							this.mappingLoaderService.interpolateTemplate(humidityChannelDef.name ?? `Humidity: {key}`, humidityMappingContext);

						const chan = await this.ensureChannel(
							device,
							'identifier',
							`humidity:${key}`,
							humidityCat,
							humidityChanName,
						);

						channelsIds.push(chan.id);

						// Apply transformers from mapping
						const humidityPropertyMapping = this.findPropertyMapping(humidityChannelDef, PropertyCategory.HUMIDITY);
						const transformedHumidity = this.applyTransformer(humidityPropertyMapping, humidityStatus.rh, 'read');
						await this.ensureProperty(
							chan,
							PropertyCategory.HUMIDITY,
							'identifier',
							humidityPropertyMapping?.shellyProperty ?? 'rh',
							transformedHumidity as number,
							undefined,
							humidityPropertyMapping,
						);
					}),
				);

				const settled = await Promise.allSettled(tasks);

				const failed = settled.filter((r) => r.status === 'rejected').length;

				if (failed) {
					this.logger.warn(`${failed}/${ids.length} humidity component(s) failed for device=${device.id}`, {
						resource: device.id,
					});
				}
			} else if (type === String(ComponentType.TEMPERATURE)) {
				const tasks = ids.map((key) =>
					limit(async () => {
						const [temperatureConfig, temperatureStatus] = await retry(
							() =>
								withTimeout(
									Promise.all([
										this.shellyRpcClientService.getTemperatureConfig(host, key, { password }),
										this.shellyRpcClientService.getTemperatureStatus(host, key, { password }),
									]),
									this.timeoutSec * 1000,
									`Temperature.GetConfig+Temperature.GetStatus - ${key}`,
								),
							{ retries: 2, baseMs: 300, factor: 2 },
						).catch((err: Error) => {
							this.logger.error(`Failed load for temperature=${key} on device=${device.id}`, {
								resource: device.id,
								message: err.message,
								stack: err.stack,
							});

							throw err;
						});

						// Use YAML mapping for temperature component
						const temperatureMappingContext: MappingContext = {
							componentType: ComponentType.TEMPERATURE,
							componentKey: key,
							deviceCategory: device.category,
							model: deviceInfo.model,
							profile: deviceInfo.profile ?? undefined,
						};

						const temperatureMapping = this.mappingLoaderService.findMatchingMapping(temperatureMappingContext);

						if (!temperatureMapping || temperatureMapping.channels.length === 0) {
							this.logger.warn(
								`No mapping found for temperature component key=${key} device=${device.id} category=${device.category}. Using default TEMPERATURE channel.`,
								{
									resource: device.id,
									componentKey: key,
									deviceCategory: device.category,
								},
							);

							// Fallback to default temperature channel
							const chan = await this.ensureChannel(
								device,
								'identifier',
								`temperature:${key}`,
								ChannelCategory.TEMPERATURE,
								temperatureConfig.name ?? `Temperature: ${key}`,
							);
							channelsIds.push(chan.id);
							await this.ensureProperty(chan, PropertyCategory.TEMPERATURE, 'identifier', 'tC', temperatureStatus.tC);
							return;
						}

						const temperatureChannelDef = temperatureMapping.channels[0];
						const temperatureCat = temperatureChannelDef.category;
						const temperatureChanName =
							temperatureConfig.name ??
							this.mappingLoaderService.interpolateTemplate(temperatureChannelDef.name ?? `Temperature: {key}`, temperatureMappingContext);

						const chan = await this.ensureChannel(
							device,
							'identifier',
							`temperature:${key}`,
							temperatureCat,
							temperatureChanName,
						);

						channelsIds.push(chan.id);

						// Apply transformers from mapping
						const temperaturePropertyMapping = this.findPropertyMapping(temperatureChannelDef, PropertyCategory.TEMPERATURE);
						const transformedTemperature = this.applyTransformer(temperaturePropertyMapping, temperatureStatus.tC, 'read');
						await this.ensureProperty(
							chan,
							PropertyCategory.TEMPERATURE,
							'identifier',
							temperaturePropertyMapping?.shellyProperty ?? 'tC',
							transformedTemperature as number,
							undefined,
							temperaturePropertyMapping,
						);
					}),
				);

				const settled = await Promise.allSettled(tasks);

				const failed = settled.filter((r) => r.status === 'rejected').length;

				if (failed) {
					this.logger.warn(`${failed}/${ids.length} temperature component(s) failed for device=${device.id}`, {
						resource: device.id,
					});
				}
			} else if (type === String(ComponentType.PM1)) {
				const tasks = ids.map((key) =>
					limit(async () => {
						const [pm1Config, pm1Status] = await retry(
							() =>
								withTimeout(
									Promise.all([
										this.shellyRpcClientService.getPm1Config(host, key, { password }),
										this.shellyRpcClientService.getPm1Status(host, key, { password }),
									]),
									this.timeoutSec * 1000,
									`Pm1.GetConfig+Pm1.GetStatus - ${key}`,
								),
							{ retries: 2, baseMs: 300, factor: 2 },
						).catch((err: Error) => {
							this.logger.error(`Failed load for pm1=${key} on device=${device.id}`, {
								resource: device.id,
								message: err.message,
								stack: err.stack,
							});

							throw err;
						});

						const eeResult = await this.ensureElectricalEnergy(device, key, pm1Status, pm1Config.name ?? undefined);

						if (eeResult) {
							channelsIds.push(eeResult.channel.id);
						}

						const epResult = await this.ensureElectricalPower(device, key, pm1Status, pm1Config.name ?? undefined);

						if (epResult) {
							channelsIds.push(epResult.channel.id);
						}
					}),
				);

				const settled = await Promise.allSettled(tasks);

				const failed = settled.filter((r) => r.status === 'rejected').length;

				if (failed) {
					this.logger.warn(`${failed}/${ids.length} pm1 component(s) failed for device=${device.id}`, {
						resource: device.id,
					});
				}
			}
		}

		const allChannels = await this.channelsService.findAll(device.id, DEVICES_SHELLY_NG_TYPE);

		for (const channel of allChannels) {
			if (!channelsIds.includes(channel.id)) {
				try {
					if (this.defaultManager) {
						await this.channelsService.remove(channel.id, this.defaultManager);
					} else {
						await this.channelsService.remove(channel.id);
					}
				} catch (error) {
					const err = error as Error;

					this.logger.warn(`Failed to remove stale channel id=${channel.id}: ${err.message}`, {
						resource: device.id,
					});
				}
			}
		}

		return device;
		});
	}

	private enqueueProvision<T>(deviceId: string, task: () => Promise<T>): Promise<T> {
		const previous = this.provisionLocks.get(deviceId) ?? Promise.resolve();

		const chained = previous.catch(() => undefined).then(task);

		this.provisionLocks.set(deviceId, chained);

		return chained.finally(() => {
			if (this.provisionLocks.get(deviceId) === chained) {
				this.provisionLocks.delete(deviceId);
			}
		});
	}

	private async ensureChannel(
		device: ShellyNgDeviceEntity,
		column: 'identifier' | 'category',
		identifierOrCategory: string | ChannelCategory,
		category: ChannelCategory,
		name: string,
		parent?: string | null,
	): Promise<ShellyNgChannelEntity> {
		if (column === 'category') {
			if ((identifierOrCategory as ChannelCategory) !== category) {
				throw new DevicesShellyNgException(
					`Provided channel category is mismatched with searched: ${category} vs ${identifierOrCategory}`,
				);
			}
		}

		let channel = await this.channelsService.findOneBy(column, identifierOrCategory, device.id, DEVICES_SHELLY_NG_TYPE);

		if (channel === null) {
			const channelSpec = channelsSchema[category] as ChannelDefinition | undefined;

			if (!channelSpec || typeof channelSpec !== 'object') {
				this.logger.warn(
					`Missing or invalid schema for channel category=${category}. Falling back to minimal channel`,
					{
						resource: device.id,
					},
				);

				if (this.strictSchema) {
					throw new DevicesShellyNgException('Failed to load specification for channel category');
				}
			}

			channel = await this.channelsService.create<ShellyNgChannelEntity, CreateShellyNgChannelDto>({
				type: DEVICES_SHELLY_NG_TYPE,
				category,
				identifier: column === 'identifier' ? identifierOrCategory : null,
				name,
				device: device.id,
				parent: parent ?? null,
			});
		} else {
			channel = await this.channelsService.update<ShellyNgChannelEntity, UpdateShellyNgChannelDto>(channel.id, {
				type: DEVICES_SHELLY_NG_TYPE,
				category,
				identifier: column === 'identifier' ? identifierOrCategory : channel.identifier,
				parent: parent ?? null,
			});
		}

		return channel;
	}

	/**
	 * Apply transformer to a value if transformer is defined in property mapping
	 */
	private applyTransformer(
		propertyMapping: ResolvedProperty | undefined,
		shellyValue: unknown,
		direction: 'read' | 'write' = 'read',
	): unknown {
		if (!propertyMapping) {
			return shellyValue;
		}

		let transformer: ITransformer | null = null;

		// Get transformer from named reference or inline transform
		if (propertyMapping.transformerName) {
			transformer = this.transformerRegistry.get(propertyMapping.transformerName);
		} else if (propertyMapping.inlineTransform) {
			transformer = createInlineTransformer(propertyMapping.inlineTransform);
		}

		if (!transformer) {
			return shellyValue;
		}

		// Check if transformer supports the requested direction
		if (direction === 'read' && !transformer.canRead()) {
			this.logger.warn(
				`Transformer does not support read operation for property mapping`,
			);
			return shellyValue;
		}

		if (direction === 'write' && !transformer.canWrite()) {
			this.logger.warn(
				`Transformer does not support write operation for property mapping`,
			);
			return shellyValue;
		}

		try {
			return direction === 'read' ? transformer.read(shellyValue) : transformer.write(shellyValue);
		} catch (error) {
			this.logger.warn(`Failed to apply transformer: ${error instanceof Error ? error.message : String(error)}`);
			return shellyValue;
		}
	}

	/**
	 * Find property mapping by panel property identifier
	 */
	private findPropertyMapping(
		channelDef: ResolvedChannel,
		propertyIdentifier: PropertyCategory,
	): ResolvedProperty | undefined {
		return channelDef.properties?.find((p) => p.panel.identifier === propertyIdentifier);
	}

	/**
	 * Apply derivation rule to derive property value from source property
	 */
	private applyDerivation(derivation: AnyDerivation | undefined, sourceValue: string | number | boolean): unknown {
		if (!derivation) {
			return undefined;
		}

		try {
			switch (derivation.type) {
				case 'threshold': {
					if (typeof sourceValue !== 'number') {
						return undefined;
					}
					// Find first matching threshold
					for (const threshold of derivation.thresholds) {
						const min = threshold.min ?? Number.NEGATIVE_INFINITY;
						const max = threshold.max ?? Number.POSITIVE_INFINITY;
						if (sourceValue >= min && sourceValue <= max) {
							return threshold.value;
						}
					}
					return undefined;
				}

				case 'boolean_map': {
					const boolValue = Boolean(sourceValue);
					return boolValue ? derivation.true_value : derivation.false_value;
				}

				case 'position_status': {
					if (typeof sourceValue !== 'number') {
						return undefined;
					}
					if (sourceValue === 0) {
						return derivation.closed_value;
					} else if (sourceValue === 100) {
						return derivation.opened_value;
					} else {
						return derivation.partial_value ?? derivation.closed_value;
					}
				}

				default:
					return undefined;
			}
		} catch (error) {
			this.logger.warn(
				`Failed to apply derivation: ${error instanceof Error ? error.message : String(error)}`,
			);
			return undefined;
		}
	}

	private async ensureProperty(
		channel: ShellyNgChannelEntity,
		category: PropertyCategory,
		column: 'identifier' | 'category',
		identifierOrCategory: string | PropertyCategory,
		value?: string | number | boolean,
		options?: {
			data_type?: DataTypeType;
			format?: string[] | number[];
			permissions?: PermissionType[];
			unit?: string | null;
		},
		propertyMapping?: ResolvedProperty,
	): Promise<ShellyNgChannelPropertyEntity> {
		if (column === 'category') {
			if ((identifierOrCategory as PropertyCategory) !== category) {
				throw new DevicesShellyNgException(
					`Provided channel property category is mismatched with searched: ${category} vs ${identifierOrCategory}`,
				);
			}
		}

		const channelSpec = channelsSchema[channel.category] as ChannelDefinition | undefined;
		const propertySpec =
			typeof channelSpec === 'object'
				? (channelSpec['properties'][category] as
						| {
								permissions: PermissionType[];
								data_type: DataTypeType;
								unit: string | null;
								format: string[] | number[] | null;
						  }
						| undefined)
				: undefined;

		const normalizedValue = this.normalizeValue(value, propertySpec, options);

		let prop = await this.channelsPropertiesService.findOneBy<ShellyNgChannelPropertyEntity>(
			column,
			identifierOrCategory,
			channel.id,
		);

		if (prop === null) {
			if (!channelSpec || typeof channelSpec !== 'object') {
				this.logger.warn(
					`Missing or invalid schema for channel category=${channel.category}. Falling back to minimal channel`,
				);

				if (this.strictSchema) {
					throw new DevicesShellyNgException('Failed to load specification for channel category');
				}
			}

			const spec =
				propertySpec ??
				(typeof channelSpec === 'object'
					? (channelSpec['properties'][category] as
							| {
									permissions: PermissionType[];
									data_type: DataTypeType;
									unit: string | null;
									format: string[] | number[] | null;
							  }
							| undefined)
					: undefined);

			if (!spec || typeof spec !== 'object') {
				this.logger.warn(
					`Missing or invalid schema for property category=${category}. Falling back to minimal property.`,
				);

				if (this.strictSchema) {
					throw new DevicesShellyNgException('Failed to load specification for channel property category');
				}
			}

			const inferredType =
				typeof normalizedValue === 'number'
					? 'number'
					: typeof normalizedValue === 'boolean'
						? 'boolean'
						: typeof normalizedValue === 'string'
							? 'string'
							: 'mixed';

			const inferredDataType: DataTypeType =
				spec?.data_type ??
				(inferredType === 'number'
					? DataTypeType.FLOAT
					: inferredType === 'boolean'
						? DataTypeType.BOOL
						: inferredType === 'string'
							? DataTypeType.STRING
							: DataTypeType.UNKNOWN);

			const permissions: PermissionType[] = spec?.permissions ?? [PermissionType.READ_WRITE];

			prop = await this.channelsPropertiesService.create<
				ShellyNgChannelPropertyEntity,
				CreateShellyNgChannelPropertyDto
			>(channel.id, {
				...{
					permissions,
					data_type: inferredDataType,
					unit: spec?.unit,
					format: spec?.format,
				},
				type: DEVICES_SHELLY_NG_TYPE,
				category,
				identifier: column === 'identifier' ? identifierOrCategory : null,
				value: normalizedValue,
				...options,
			});
		} else {
			prop = await this.channelsPropertiesService.update<
				ShellyNgChannelPropertyEntity,
				UpdateShellyNgChannelPropertyDto
			>(prop.id, {
				type: DEVICES_SHELLY_NG_TYPE,
				category,
				identifier: column === 'identifier' ? identifierOrCategory : null,
				value: normalizedValue,
				...options,
			});
		}

		return prop;
	}

	private normalizeValue(
		value: string | number | boolean | undefined,
		propertySpec?:
			| {
					format?: string[] | number[] | null;
			  }
			| null,
		options?:
			| {
					format?: string[] | number[];
			  }
			| null,
	): string | number | boolean | undefined {
		if (typeof value !== 'number') {
			return value;
		}

		const range = this.getNumericRange(options?.format ?? propertySpec?.format);

		if (range) {
			return clampNumber(value, range.min, range.max);
		}

		// Without an explicit range, keep the original value so that mapping definitions
		// (which should include min/max) drive validation instead of a blanket clamp.
		return value;
	}

	private getNumericRange(format: string[] | number[] | null | undefined): { min: number; max: number } | null {
		if (!Array.isArray(format)) {
			return null;
		}

		if (format.length === 2 && format.every((n) => typeof n === 'number' && Number.isFinite(n))) {
			return { min: Number(format[0]), max: Number(format[1]) };
		}

		return null;
	}

	private async ensureElectricalEnergy(
		device: ShellyNgDeviceEntity,
		key: number,
		status: { aenergy?: { total: number; by_minute: number[]; minute_ts: number } },
		name?: string,
		parent?: string | null,
	): Promise<{ channel: ShellyNgChannelEntity; properties: ShellyNgChannelPropertyEntity[] } | null> {
		if (typeof status.aenergy !== 'undefined') {
			const electricalEnergy = await this.ensureChannel(
				device,
				'identifier',
				`energy:${key}`,
				ChannelCategory.ELECTRICAL_ENERGY,
				name ?? `Consumption: ${key}`,
				parent,
			);

			const consumption = await this.ensureProperty(
				electricalEnergy,
				PropertyCategory.CONSUMPTION,
				'identifier',
				'aenergy',
				toEnergy(status.aenergy),
			);

			return {
				channel: electricalEnergy,
				properties: [consumption],
			};
		}

		return null;
	}

	private async ensureElectricalPower(
		device: ShellyNgDeviceEntity,
		key: number,
		status: { apower?: number; voltage?: number; current?: number },
		name?: string,
		parent?: string | null,
	): Promise<{ channel: ShellyNgChannelEntity; properties: ShellyNgChannelPropertyEntity[] } | null> {
		if (typeof status.apower !== 'undefined') {
			const electricalPower = await this.ensureChannel(
				device,
				'identifier',
				`power:${key}`,
				ChannelCategory.ELECTRICAL_POWER,
				name ?? `Power: ${key}`,
				parent,
			);

			const power = await this.ensureProperty(
				electricalPower,
				PropertyCategory.POWER,
				'identifier',
				'apower',
				status.apower,
			);

			const properties = [power];

			if (typeof status.voltage !== 'undefined') {
				properties.push(
					await this.ensureProperty(electricalPower, PropertyCategory.VOLTAGE, 'identifier', 'voltage', status.voltage),
				);
			}

			if (typeof status.current !== 'undefined') {
				properties.push(
					await this.ensureProperty(electricalPower, PropertyCategory.CURRENT, 'identifier', 'current', status.current),
				);
			}

			return {
				channel: electricalPower,
				properties,
			};
		}

		return null;
	}

	private getSpecification(model: string): DeviceDescriptor | null {
		for (const DESCRIPTOR of Object.values(DESCRIPTORS)) {
			if (DESCRIPTOR.models.includes(model.toUpperCase())) {
				return DESCRIPTOR;
			}
		}

		return null;
	}
}
