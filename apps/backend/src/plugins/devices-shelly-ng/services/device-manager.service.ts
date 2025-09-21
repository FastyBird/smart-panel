import { Injectable, Logger } from '@nestjs/common';

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
import { CreateShellyNgDeviceDto } from '../dto/create-device.dto';
import { UpdateShellyNgDeviceDto } from '../dto/update-device.dto';
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
			components,
		};
	}

	async createOrUpdate(
		hostname: string,
		password: string | undefined,
		category: DeviceCategory,
		name: string,
	): Promise<ShellyNgDeviceEntity> {
		const deviceInfo = await this.getDeviceInfo(hostname, password);

		const deviceSpec = this.getSpecification(deviceInfo.model);

		if (deviceSpec === null) {
			throw new DevicesShellyNgException(
				`Provided device is not supported hostname=${hostname} model=${deviceInfo.model}`,
			);
		}

		let device = await this.devicesService.findOneBy<ShellyNgDeviceEntity>(
			'identifier',
			deviceInfo.id,
			DEVICES_SHELLY_NG_TYPE,
		);

		if (device === null) {
			device = await this.devicesService.create<ShellyNgDeviceEntity, CreateShellyNgDeviceDto>({
				type: DEVICES_SHELLY_NG_TYPE,
				category: category,
				identifier: deviceInfo.id,
				hostname,
				name,
			});

			this.logger.debug(`[SHELLY NG][DEVICE MANAGER] Created new device=${device.id} in category=${category}`);
		} else if (device.hostname !== hostname) {
			device = await this.devicesService.update<ShellyNgDeviceEntity, UpdateShellyNgDeviceDto>(device.id, {
				type: DEVICES_SHELLY_NG_TYPE,
				hostname,
			});

			this.logger.debug(`[SHELLY NG][DEVICE MANAGER] Updated existing device=${device.id}`);
		}

		const deviceInformation = await this.ensureChannel(
			device,
			'category',
			ChannelCategory.DEVICE_INFORMATION,
			ChannelCategory.DEVICE_INFORMATION,
			'Device information',
		);

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
			deviceSpec.name,
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
			const wifiInfo = await this.shellyRpcClientService.getWifiStatus(hostname, { password });

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

		for (const [type, ids] of Object.entries(deviceComponents)) {
			if (
				type === String(ComponentType.SWITCH) &&
				(!deviceInfo.profile || deviceInfo.profile === String(DeviceProfile.SWITCH))
			) {
				for (const key of ids) {
					let switchStatus: Awaited<ReturnType<typeof this.shellyRpcClientService.getSwitchStatus>>;

					try {
						switchStatus = await this.shellyRpcClientService.getSwitchStatus(hostname, key, { password });
					} catch (error) {
						const err = error as Error;

						this.logger.error(
							`[SHELLY NG][DEVICE MANAGER] Failed to load switch status for device=${device.id} and switch=${key}`,
							{
								message: err.message,
								stack: err.stack,
							},
						);

						return;
					}

					let electricalEnergyChannelName: string | undefined = undefined;
					let electricalPowerChannelName: string | undefined = undefined;

					if (
						device.category === DeviceCategory.OUTLET ||
						device.category === DeviceCategory.SWITCHER ||
						device.category === DeviceCategory.PUMP
					) {
						const switcher = await this.ensureChannel(
							device,
							'identifier',
							`switch:${key}`,
							ChannelCategory.SWITCHER,
							`Switch: ${key}`,
						);

						await this.ensureProperty(switcher, PropertyCategory.ON, 'identifier', 'output', switchStatus.output);

						electricalEnergyChannelName = `Switch consumption: ${key}`;
						electricalPowerChannelName = `Switch power: ${key}`;
					} else if (device.category === DeviceCategory.FAN) {
						const fan = await this.ensureChannel(
							device,
							'identifier',
							`switch:${key}`,
							ChannelCategory.FAN,
							`Fan: ${key}`,
						);

						await this.ensureProperty(fan, PropertyCategory.ON, 'identifier', 'output', switchStatus.output);

						electricalEnergyChannelName = `Fan consumption: ${key}`;
						electricalPowerChannelName = `Fan power: ${key}`;
					} else if (device.category === DeviceCategory.SPRINKLER || device.category === DeviceCategory.VALVE) {
						const valve = await this.ensureChannel(
							device,
							'identifier',
							`switch:${key}`,
							ChannelCategory.VALVE,
							`Valve: ${key}`,
						);

						await this.ensureProperty(valve, PropertyCategory.ON, 'identifier', 'output', switchStatus.output);
						await this.ensureProperty(valve, PropertyCategory.TYPE, 'identifier', 'output', 'generic', {
							format: ['generic', 'irrigation', 'shower_head', 'water_faucet'],
						});

						electricalEnergyChannelName = `Valve consumption: ${key}`;
						electricalPowerChannelName = `Valve power: ${key}`;
					} else if (device.category === DeviceCategory.LIGHTING) {
						const light = await this.ensureChannel(
							device,
							'identifier',
							`switch:${key}`,
							ChannelCategory.LIGHT,
							`Light: ${key}`,
						);

						await this.ensureProperty(light, PropertyCategory.ON, 'identifier', 'output', switchStatus.output);

						electricalEnergyChannelName = `Light consumption: ${key}`;
						electricalPowerChannelName = `Light power: ${key}`;
					} else {
						continue;
					}

					await this.ensureElectricalEnergy(device, key, switchStatus, electricalEnergyChannelName);
					await this.ensureElectricalPower(device, key, switchStatus, electricalPowerChannelName);
				}
			} else if (type === String(ComponentType.COVER) && deviceInfo.profile === String(DeviceProfile.COVER)) {
				for (const key of ids) {
					let coverStatus: Awaited<ReturnType<typeof this.shellyRpcClientService.getCoverStatus>>;

					try {
						coverStatus = await this.shellyRpcClientService.getCoverStatus(hostname, key, { password });
					} catch (error) {
						const err = error as Error;

						this.logger.error(
							`[SHELLY NG][DEVICE MANAGER] Failed to load cover status for device=${device.id} and cover=${key}`,
							{
								message: err.message,
								stack: err.stack,
							},
						);

						return;
					}

					const cover = await this.ensureChannel(
						device,
						'identifier',
						`cover:${key}`,
						ChannelCategory.WINDOW_COVERING,
						`Cover: ${key}`,
					);

					await this.ensureProperty(cover, PropertyCategory.STATUS, 'identifier', 'state', coverStatus.state);

					await this.ensureProperty(
						cover,
						PropertyCategory.POSITION,
						'identifier',
						'current_pos',
						coverStatus.current_pos,
					);

					await this.ensureProperty(cover, PropertyCategory.COMMAND, 'category', PropertyCategory.COMMAND, 'stop');

					await this.ensureElectricalEnergy(device, key, coverStatus, `Cover consumption: ${key}`);
					await this.ensureElectricalPower(device, key, coverStatus, `Cover power: ${key}`);
				}
			} else if (type === String(ComponentType.LIGHT)) {
				for (const key of ids) {
					let lightStatus: Awaited<ReturnType<typeof this.shellyRpcClientService.getLightStatus>>;

					try {
						lightStatus = await this.shellyRpcClientService.getLightStatus(hostname, key, { password });
					} catch (error) {
						const err = error as Error;

						this.logger.error(
							`[SHELLY NG][DEVICE MANAGER] Failed to load light status for device=${device.id} and light=${key}`,
							{
								message: err.message,
								stack: err.stack,
							},
						);

						return;
					}

					const light = await this.ensureChannel(
						device,
						'identifier',
						`light:${key}`,
						ChannelCategory.LIGHT,
						`Light: ${key}`,
					);

					await this.ensureProperty(light, PropertyCategory.ON, 'identifier', 'output', lightStatus.output);

					if (typeof lightStatus.brightness !== 'undefined') {
						await this.ensureProperty(
							light,
							PropertyCategory.BRIGHTNESS,
							'identifier',
							'brightness',
							lightStatus.brightness,
						);
					}

					await this.ensureElectricalEnergy(device, key, lightStatus, `Light consumption: ${key}`);
					await this.ensureElectricalPower(device, key, lightStatus, `Light power: ${key}`);
				}
			} else if (type === String(ComponentType.INPUT)) {
				for (const key of ids) {
					let inputStatus: Awaited<ReturnType<typeof this.shellyRpcClientService.getInputStatus>>;

					try {
						inputStatus = await this.shellyRpcClientService.getInputStatus(hostname, key, { password });
					} catch (error) {
						const err = error as Error;

						this.logger.error(
							`[SHELLY NG][DEVICE MANAGER] Failed to load input status for device=${device.id} and input=${key}`,
							{
								message: err.message,
								stack: err.stack,
							},
						);

						return;
					}

					// TODO: To be implemented in the future
					this.logger.debug(`[SHELLY NG][DEVICE MANAGER] Received device input status for input=${key}`, inputStatus);
				}
			} else if (type === String(ComponentType.DEVICE_POWER)) {
				for (const key of ids) {
					let devicePowerStatus: Awaited<ReturnType<typeof this.shellyRpcClientService.getDevicePowerStatus>>;

					try {
						devicePowerStatus = await this.shellyRpcClientService.getDevicePowerStatus(hostname, key, { password });
					} catch (error) {
						const err = error as Error;

						this.logger.error(
							`[SHELLY NG][DEVICE MANAGER] Failed to load device power status for device=${device.id} and devicePower=${key}`,
							{
								message: err.message,
								stack: err.stack,
							},
						);

						return;
					}

					if (typeof devicePowerStatus.battery !== 'undefined') {
						const battery = await this.ensureChannel(
							device,
							'identifier',
							`devicePower:${key}`,
							ChannelCategory.BATTERY,
							`Device Power: ${key}`,
						);

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
				for (const key of ids) {
					let humidityStatus: Awaited<ReturnType<typeof this.shellyRpcClientService.getHumidityStatus>>;

					try {
						humidityStatus = await this.shellyRpcClientService.getHumidityStatus(hostname, key, { password });
					} catch (error) {
						const err = error as Error;

						this.logger.error(
							`[SHELLY NG][DEVICE MANAGER] Failed to load humidity status for device=${device.id} and humidity=${key}`,
							{
								message: err.message,
								stack: err.stack,
							},
						);

						return;
					}

					const humidity = await this.ensureChannel(
						device,
						'identifier',
						`humidity:${key}`,
						ChannelCategory.HUMIDITY,
						`Humidity: ${key}`,
					);

					await this.ensureProperty(humidity, PropertyCategory.HUMIDITY, 'identifier', 'rh', humidityStatus.rh);
				}
			} else if (type === String(ComponentType.TEMPERATURE)) {
				for (const key of ids) {
					let temperatureStatus: Awaited<ReturnType<typeof this.shellyRpcClientService.getTemperatureStatus>>;

					try {
						temperatureStatus = await this.shellyRpcClientService.getTemperatureStatus(hostname, key, { password });
					} catch (error) {
						const err = error as Error;

						this.logger.error(
							`[SHELLY NG][DEVICE MANAGER] Failed to load temperature status for device=${device.id} and temperature=${key}`,
							{
								message: err.message,
								stack: err.stack,
							},
						);

						return;
					}

					const temperature = await this.ensureChannel(
						device,
						'identifier',
						`temperature:${key}`,
						ChannelCategory.TEMPERATURE,
						`Temperature: ${key}`,
					);

					await this.ensureProperty(
						temperature,
						PropertyCategory.TEMPERATURE,
						'identifier',
						'tC',
						temperatureStatus.tC,
					);
				}
			} else if (type === String(ComponentType.PM)) {
				for (const key of ids) {
					let pm1Status: Awaited<ReturnType<typeof this.shellyRpcClientService.getPm1Status>>;

					try {
						pm1Status = await this.shellyRpcClientService.getPm1Status(hostname, key, { password });
					} catch (error) {
						const err = error as Error;

						this.logger.error(
							`[SHELLY NG][DEVICE MANAGER] Failed to load PM1 status for device=${device.id} and pm1=${key}`,
							{
								message: err.message,
								stack: err.stack,
							},
						);

						return;
					}

					await this.ensureElectricalEnergy(device, key, pm1Status);
					await this.ensureElectricalPower(device, key, pm1Status);
				}
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
				this.logger.warn(`[SHELLY NG][DEVICE MANAGER] Missing or invalid schema for channel category=${category}`);

				throw new DevicesShellyNgException('Failed to load specification for channel category');
			}

			channel = await this.channelsService.create<ShellyNgChannelEntity, CreateShellyNgChannelDto>({
				type: DEVICES_SHELLY_NG_TYPE,
				category,
				identifier: column === 'identifier' ? identifierOrCategory : null,
				name,
				device: device.id,
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
					'Provided channel property category is mismatched with searched: ${category} vs ${identifierOrCategory}',
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
					`[SHELLY NG][DEVICE MANAGER] Missing or invalid schema for channel category=${channel.category}`,
				);

				throw new DevicesShellyNgException('Failed to load specification for channel category');
			}

			const propertySpec = channelSpec['properties'][category] as
				| { permissions: string[]; data_type: string; unit: string | null; format: string[] | number[] | null }
				| undefined;

			if (!propertySpec || typeof propertySpec !== 'object') {
				this.logger.warn(`[SHELLY NG][DEVICE MANAGER] Missing or invalid schema for property category=${category}`);

				throw new DevicesShellyNgException('Failed to load specification for channel property category');
			}

			prop = await this.channelsPropertiesService.create<
				ShellyNgChannelPropertyEntity,
				CreateShellyNgChannelPropertyDto
			>(channel.id, {
				...{
					permissions: propertySpec.permissions,
					data_type: propertySpec.data_type,
					unit: propertySpec.unit,
					format: propertySpec.format,
				},
				type: DEVICES_SHELLY_NG_TYPE,
				category,
				identifier: column === 'identifier' ? identifierOrCategory : null,
				value,
				...options,
			} as CreateShellyNgChannelPropertyDto);
		}

		return prop;
	}

	private async ensureElectricalEnergy(
		device: ShellyNgDeviceEntity,
		key: number,
		status: { aenergy?: { total: number; by_minute: number[]; minute_ts: number } },
		name?: string,
	): Promise<void> {
		if (typeof status.aenergy !== 'undefined') {
			const electricalEnergy = await this.ensureChannel(
				device,
				'identifier',
				`energy:${key}`,
				ChannelCategory.ELECTRICAL_ENERGY,
				name ?? `Consumption: ${key}`,
			);

			await this.ensureProperty(
				electricalEnergy,
				PropertyCategory.CONSUMPTION,
				'identifier',
				'aenergy',
				toEnergy(status.aenergy),
			);
		}
	}

	private async ensureElectricalPower(
		device: ShellyNgDeviceEntity,
		key: number,
		status: { apower?: number; voltage?: number; current?: number },
		name?: string,
	): Promise<void> {
		if (typeof status.apower !== 'undefined') {
			const electricalPower = await this.ensureChannel(
				device,
				'identifier',
				`power:${key}`,
				ChannelCategory.ELECTRICAL_POWER,
				name ?? `Power: ${key}`,
			);

			await this.ensureProperty(electricalPower, PropertyCategory.POWER, 'identifier', 'apower', status.apower);

			if (typeof status.voltage !== 'undefined') {
				await this.ensureProperty(electricalPower, PropertyCategory.VOLTAGE, 'identifier', 'voltage', status.voltage);
			}

			if (typeof status.current !== 'undefined') {
				await this.ensureProperty(electricalPower, PropertyCategory.CURRENT, 'identifier', 'current', status.current);
			}
		}
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
