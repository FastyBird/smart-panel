import { Injectable, Logger } from '@nestjs/common';

import { pLimit, retry, withTimeout } from '../../../common/utils/http.utils';
import {
	ChannelCategory,
	ConnectionState,
	DataTypeType,
	DeviceCategory,
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
import { rssiToQuality, toEnergy } from '../utils/transform.utils';

import { ShellyRpcClientService } from './shelly-rpc-client.service';

@Injectable()
export class DeviceManagerService {
	private readonly logger = new Logger(DeviceManagerService.name);

	private readonly strictSchema: boolean = true;

	private timeoutSec: number = 5;

	private rpcConcurrency: number = 1;

	constructor(
		private readonly shellyRpcClientService: ShellyRpcClientService,
		private readonly devicesService: DevicesService,
		private readonly channelsService: ChannelsService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
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
			// Could be ignored, device is not supporting WiFi component
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
							this.logger.error(`[SHELLY NG][DEVICE MANAGER] Failed load for switch=${key} on device=${device.id}`, {
								message: err.message,
								stack: err.stack,
							});

							throw err;
						});

						let cat: ChannelCategory | null = null;
						let chanName: string;

						if (
							device.category === DeviceCategory.OUTLET ||
							device.category === DeviceCategory.SWITCHER ||
							device.category === DeviceCategory.PUMP
						) {
							cat = ChannelCategory.SWITCHER;
							chanName = switchConfig.name ?? `Switch: ${key}`;
						} else if (device.category === DeviceCategory.FAN) {
							cat = ChannelCategory.FAN;
							chanName = switchConfig.name ?? `Fan: ${key}`;
						} else if (device.category === DeviceCategory.SPRINKLER || device.category === DeviceCategory.VALVE) {
							cat = ChannelCategory.VALVE;
							chanName = switchConfig.name ?? `Valve: ${key}`;
						} else if (device.category === DeviceCategory.LIGHTING) {
							cat = ChannelCategory.LIGHT;
							chanName = switchConfig.name ?? `Light: ${key}`;
						} else {
							return;
						}

						const chan = await this.ensureChannel(device, 'identifier', `switch:${key}`, cat, chanName);

						channelsIds.push(chan.id);

						await this.ensureProperty(chan, PropertyCategory.ON, 'identifier', 'output', !!switchStatus.output);

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

						const ee = await this.ensureElectricalEnergy(device, key, switchStatus, energyName);

						if (ee) {
							channelsIds.push(ee.channel.id);
						}

						const ep = await this.ensureElectricalPower(device, key, switchStatus, powerName);

						if (ep) {
							channelsIds.push(ep.channel.id);
						}
					}),
				);

				const settled = await Promise.allSettled(tasks);

				const failed = settled.filter((r) => r.status === 'rejected').length;

				if (failed) {
					this.logger.warn(
						`[SHELLY NG][DEVICE MANAGER] ${failed}/${ids.length} switch component(s) failed for device=${device.id}`,
					);
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
							this.logger.error(`[SHELLY NG][DEVICE MANAGER] Failed load for cover=${key} on device=${device.id}`, {
								message: err.message,
								stack: err.stack,
							});

							throw err;
						});

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

						const ee = await this.ensureElectricalEnergy(
							device,
							key,
							coverStatus,
							coverConfig.name ? `Consumption: ${coverConfig.name}` : `Cover consumption: ${key}`,
						);

						if (ee) {
							channelsIds.push(ee.channel.id);
						}

						const ep = await this.ensureElectricalPower(
							device,
							key,
							coverStatus,
							coverConfig.name ? `Power: ${coverConfig.name}` : `Cover power: ${key}`,
						);

						if (ep) {
							channelsIds.push(ep.channel.id);
						}
					}),
				);

				const settled = await Promise.allSettled(tasks);

				const failed = settled.filter((r) => r.status === 'rejected').length;

				if (failed) {
					this.logger.warn(
						`[SHELLY NG][DEVICE MANAGER] ${failed}/${ids.length} cover component(s) failed for device=${device.id}`,
					);
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
							this.logger.error(`[SHELLY NG][DEVICE MANAGER] Failed load for light=${key} on device=${device.id}`, {
								message: err.message,
								stack: err.stack,
							});

							throw err;
						});

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

						const ee = await this.ensureElectricalEnergy(
							device,
							key,
							lightStatus,
							lightConfig.name ? `Consumption: ${lightConfig.name}` : `Light consumption: ${key}`,
						);

						if (ee) {
							channelsIds.push(ee.channel.id);
						}

						const ep = await this.ensureElectricalPower(
							device,
							key,
							lightStatus,
							lightConfig.name ? `Power: ${lightConfig.name}` : `Light power: ${key}`,
						);

						if (ep) {
							channelsIds.push(ep.channel.id);
						}
					}),
				);

				const settled = await Promise.allSettled(tasks);

				const failed = settled.filter((r) => r.status === 'rejected').length;

				if (failed) {
					this.logger.warn(
						`[SHELLY NG][DEVICE MANAGER] ${failed}/${ids.length} light component(s) failed for device=${device.id}`,
					);
				}
			} else if (type === String(ComponentType.INPUT)) {
				const tasks = ids.map((key) =>
					limit(async () => {
						const [inputConfig, inputStatus] = await retry(
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
							this.logger.error(`[SHELLY NG][DEVICE MANAGER] Failed load for input=${key} on device=${device.id}`, {
								message: err.message,
								stack: err.stack,
							});

							throw err;
						});

						// TODO: To be implemented in the future
						this.logger.debug(
							`[SHELLY NG][DEVICE MANAGER] Received device input status for input=${key}`,
							inputConfig,
							inputStatus,
						);
					}),
				);

				const settled = await Promise.allSettled(tasks);

				const failed = settled.filter((r) => r.status === 'rejected').length;

				if (failed) {
					this.logger.warn(
						`[SHELLY NG][DEVICE MANAGER] ${failed}/${ids.length} input component(s) failed for device=${device.id}`,
					);
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

						this.logger.error(
							`[SHELLY NG][DEVICE MANAGER] Failed to load device power status for device=${device.id} and devicePower=${key}`,
							{
								message: err.message,
								stack: err.stack,
							},
						);

						continue;
					}

					if (typeof devicePowerStatus.battery !== 'undefined') {
						const battery = await this.ensureChannel(
							device,
							'identifier',
							`devicePower:${key}`,
							ChannelCategory.BATTERY,
							`Device power: ${key}`,
						);
						channelsIds.push(battery.id);

						await this.ensureProperty(
							battery,
							PropertyCategory.PERCENTAGE,
							'identifier',
							'battery',
							devicePowerStatus.battery.percent,
						);
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
							this.logger.error(`[SHELLY NG][DEVICE MANAGER] Failed load for humidity=${key} on device=${device.id}`, {
								message: err.message,
								stack: err.stack,
							});

							throw err;
						});

						const chan = await this.ensureChannel(
							device,
							'identifier',
							`humidity:${key}`,
							ChannelCategory.HUMIDITY,
							humidityConfig.name ?? `Humidity: ${key}`,
						);

						channelsIds.push(chan.id);

						await this.ensureProperty(chan, PropertyCategory.HUMIDITY, 'identifier', 'rh', humidityStatus.rh);
					}),
				);

				const settled = await Promise.allSettled(tasks);

				const failed = settled.filter((r) => r.status === 'rejected').length;

				if (failed) {
					this.logger.warn(
						`[SHELLY NG][DEVICE MANAGER] ${failed}/${ids.length} humidity component(s) failed for device=${device.id}`,
					);
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
							this.logger.error(
								`[SHELLY NG][DEVICE MANAGER] Failed load for temperature=${key} on device=${device.id}`,
								{
									message: err.message,
									stack: err.stack,
								},
							);

							throw err;
						});

						const chan = await this.ensureChannel(
							device,
							'identifier',
							`temperature:${key}`,
							ChannelCategory.TEMPERATURE,
							temperatureConfig.name ?? `Temperature: ${key}`,
						);

						channelsIds.push(chan.id);

						await this.ensureProperty(chan, PropertyCategory.TEMPERATURE, 'identifier', 'tC', temperatureStatus.tC);
					}),
				);

				const settled = await Promise.allSettled(tasks);

				const failed = settled.filter((r) => r.status === 'rejected').length;

				if (failed) {
					this.logger.warn(
						`[SHELLY NG][DEVICE MANAGER] ${failed}/${ids.length} temperature component(s) failed for device=${device.id}`,
					);
				}
			} else if (type === String(ComponentType.PM)) {
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
							this.logger.error(`[SHELLY NG][DEVICE MANAGER] Failed load for pm1=${key} on device=${device.id}`, {
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
					this.logger.warn(
						`[SHELLY NG][DEVICE MANAGER] ${failed}/${ids.length} pm1 component(s) failed for device=${device.id}`,
					);
				}
			}
		}

		const allChannels = await this.channelsService.findAll(device.id, DEVICES_SHELLY_NG_TYPE);

		for (const channel of allChannels) {
			if (!channelsIds.includes(channel.id)) {
				await this.channelsService.remove(channel.id);

				this.logger.debug(
					`[SHELLY NG][DEVICE MANAGER] Remove channel=${channel.id} because this channel is not specified for current device`,
				);
			}
		}

		return device;
	}

	private async ensureChannel(
		device: ShellyNgDeviceEntity,
		column: 'identifier' | 'category',
		identifierOrCategory: string | ChannelCategory,
		category: ChannelCategory,
		name: string,
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
					`[SHELLY NG][DEVICE MANAGER] Missing or invalid schema for channel category=${category}. Falling back to minimal channel`,
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
			});
		} else {
			channel = await this.channelsService.update<ShellyNgChannelEntity, UpdateShellyNgChannelDto>(channel.id, {
				type: DEVICES_SHELLY_NG_TYPE,
				category,
				identifier: column === 'identifier' ? identifierOrCategory : channel.identifier,
			});
		}

		return channel;
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
	): Promise<ShellyNgChannelPropertyEntity> {
		if (column === 'category') {
			if ((identifierOrCategory as PropertyCategory) !== category) {
				throw new DevicesShellyNgException(
					`Provided channel property category is mismatched with searched: ${category} vs ${identifierOrCategory}`,
				);
			}
		}

		let prop = await this.channelsPropertiesService.findOneBy<ShellyNgChannelPropertyEntity>(
			column,
			identifierOrCategory,
			channel.id,
		);

		if (prop === null) {
			const channelSpec = channelsSchema[channel.category] as ChannelDefinition | undefined;

			if (!channelSpec || typeof channelSpec !== 'object') {
				this.logger.warn(
					`[SHELLY NG][DEVICE MANAGER] Missing or invalid schema for channel category=${channel.category}. Falling back to minimal channel`,
				);

				if (this.strictSchema) {
					throw new DevicesShellyNgException('Failed to load specification for channel category');
				}
			}

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

			if (!propertySpec || typeof propertySpec !== 'object') {
				this.logger.warn(
					`[SHELLY NG][DEVICE MANAGER] Missing or invalid schema for property category=${category}. Falling back to minimal property.`,
				);

				if (this.strictSchema) {
					throw new DevicesShellyNgException('Failed to load specification for channel property category');
				}
			}

			const inferredType =
				typeof value === 'number'
					? 'number'
					: typeof value === 'boolean'
						? 'boolean'
						: typeof value === 'string'
							? 'string'
							: 'mixed';

			const inferredDataType: DataTypeType =
				propertySpec?.data_type ??
				(inferredType === 'number'
					? DataTypeType.FLOAT
					: inferredType === 'boolean'
						? DataTypeType.BOOL
						: inferredType === 'string'
							? DataTypeType.STRING
							: DataTypeType.UNKNOWN);

			const permissions: PermissionType[] = propertySpec?.permissions ?? [PermissionType.READ_WRITE];

			prop = await this.channelsPropertiesService.create<
				ShellyNgChannelPropertyEntity,
				CreateShellyNgChannelPropertyDto
			>(channel.id, {
				...{
					permissions,
					data_type: inferredDataType,
					unit: propertySpec?.unit,
					format: propertySpec?.format,
				},
				type: DEVICES_SHELLY_NG_TYPE,
				category,
				identifier: column === 'identifier' ? identifierOrCategory : null,
				value,
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
				value,
				...options,
			});
		}

		return prop;
	}

	private async ensureElectricalEnergy(
		device: ShellyNgDeviceEntity,
		key: number,
		status: { aenergy?: { total: number; by_minute: number[]; minute_ts: number } },
		name?: string,
	): Promise<{ channel: ShellyNgChannelEntity; properties: ShellyNgChannelPropertyEntity[] } | null> {
		if (typeof status.aenergy !== 'undefined') {
			const electricalEnergy = await this.ensureChannel(
				device,
				'identifier',
				`energy:${key}`,
				ChannelCategory.ELECTRICAL_ENERGY,
				name ?? `Consumption: ${key}`,
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
	): Promise<{ channel: ShellyNgChannelEntity; properties: ShellyNgChannelPropertyEntity[] } | null> {
		if (typeof status.apower !== 'undefined') {
			const electricalPower = await this.ensureChannel(
				device,
				'identifier',
				`power:${key}`,
				ChannelCategory.ELECTRICAL_POWER,
				name ?? `Power: ${key}`,
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
