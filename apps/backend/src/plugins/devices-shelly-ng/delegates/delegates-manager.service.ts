import { instanceToPlain } from 'class-transformer';
import { CharacteristicValue, Device, Ethernet, WiFi } from 'shellies-ds9';

import { Injectable, Logger } from '@nestjs/common';

import { toInstance } from '../../../common/utils/transform.utils';
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
import { DEVICES_SHELLY_NG_TYPE } from '../devices-shelly-ng.constants';
import { DevicesShellyNgException } from '../devices-shelly-ng.exceptions';
import { CreateShellyNgChannelPropertyDto } from '../dto/create-channel-property.dto';
import { CreateShellyNgChannelDto } from '../dto/create-channel.dto';
import { CreateShellyNgDeviceDto } from '../dto/create-device.dto';
import { UpdateShellyNgChannelPropertyDto } from '../dto/update-channel-property.dto';
import { UpdateShellyNgDeviceDto } from '../dto/update-device.dto';
import {
	ShellyNgChannelEntity,
	ShellyNgChannelPropertyEntity,
	ShellyNgDeviceEntity,
} from '../entities/devices-shelly-ng.entity';

import { ShellyDeviceDelegate } from './shelly-device.delegate';

type MaybeNet = {
	wifi?: WiFi & { sta_ip?: string | null };
	ethernet?: Ethernet & { ip?: string | null };
};

@Injectable()
export class DelegatesManagerService {
	private readonly logger = new Logger(DelegatesManagerService.name);

	private readonly delegates: Map<Device['id'], ShellyDeviceDelegate> = new Map();

	private readonly delegateValueHandlers: Map<
		string,
		(compKey: string, attr: string, val: CharacteristicValue) => void
	> = new Map();

	private readonly delegateConnectionHandlers: Map<string, (state: boolean) => void> = new Map();

	private readonly changeHandlers: Map<string, (val: CharacteristicValue) => void> = new Map();

	private readonly setHandlers: Map<string, (val: string | number | boolean) => Promise<boolean>> = new Map();

	private readonly pendingWrites: Map<string, NodeJS.Timeout> = new Map();

	private readonly propertiesMap: Map<string, Set<string>> = new Map();

	constructor(
		private readonly devicesService: DevicesService,
		private readonly channelsService: ChannelsService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
	) {}

	get(id: Device['id']): ShellyDeviceDelegate | undefined {
		return this.delegates.get(id);
	}

	async insert(shelly: Device & MaybeNet): Promise<ShellyDeviceDelegate> {
		if (this.delegates.has(shelly.id)) {
			return this.delegates.get(shelly.id);
		}

		const delegate = new ShellyDeviceDelegate(shelly);

		this.delegates.set(shelly.id, delegate);

		let device = await this.devicesService.findOneBy<ShellyNgDeviceEntity>(
			'identifier',
			shelly.id,
			DEVICES_SHELLY_NG_TYPE,
		);

		const hostname = shelly.wifi?.sta_ip ?? shelly.ethernet?.ip ?? null;

		if (device === null) {
			device = await this.devicesService.create<ShellyNgDeviceEntity, CreateShellyNgDeviceDto>({
				type: DEVICES_SHELLY_NG_TYPE,
				category: this.determineCategory(delegate),
				identifier: shelly.id,
				hostname,
				name: shelly.system.config.device.name ?? shelly.modelName,
			});
		} else if (device.hostname !== hostname) {
			device = await this.devicesService.update<ShellyNgDeviceEntity, UpdateShellyNgDeviceDto>(device.id, {
				type: DEVICES_SHELLY_NG_TYPE,
				hostname,
			});
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
			shelly.modelName,
		);
		await this.ensureProperty(
			deviceInformation,
			PropertyCategory.SERIAL_NUMBER,
			'category',
			PropertyCategory.SERIAL_NUMBER,
			shelly.id,
		);
		await this.ensureProperty(
			deviceInformation,
			PropertyCategory.FIRMWARE_REVISION,
			'category',
			PropertyCategory.FIRMWARE_REVISION,
			shelly.firmware.version,
		);
		const connectionState = await this.ensureProperty(
			deviceInformation,
			PropertyCategory.STATUS,
			'category',
			PropertyCategory.STATUS,
			ConnectionState.UNKNOWN,
			{
				format: [ConnectionState.CONNECTED, ConnectionState.DISCONNECTED, ConnectionState.UNKNOWN],
			},
		);

		if ('wifi' in shelly) {
			const comp = shelly.wifi as WiFi;

			const linkQuality = await this.ensureProperty(
				deviceInformation,
				PropertyCategory.LINK_QUALITY,
				'category',
				PropertyCategory.LINK_QUALITY,
				this.rssiToQuality(comp.rssi),
			);

			this.changeHandlers.set(`${delegate.id}|${comp.key}|rssi`, (val: CharacteristicValue): void => {
				this.handleChange(linkQuality, this.clampNumber(this.rssiToQuality(Number(val)), 0, 100)).catch(
					(err: Error): void => {
						this.logger.error(
							`[SHELLY NG][DELEGATES MANAGER] Failed to set value for component=${comp.key} attribute=rssi and property=${linkQuality.id}`,
							{
								message: err.message,
								stack: err.stack,
							},
						);
					},
				);
			});
		}

		for (const comp of delegate.switches.values()) {
			const switcher = await this.ensureChannel(
				device,
				'identifier',
				`switch:${comp.key}`,
				ChannelCategory.SWITCHER,
				comp.name,
			);

			const switcherOn = await this.ensureProperty(switcher, PropertyCategory.ON, 'identifier', 'output', comp.output);

			this.changeHandlers.set(`${delegate.id}|${comp.key}|output`, (val: CharacteristicValue): void => {
				this.handleChange(switcherOn, !!val).catch((err: Error): void => {
					this.logger.error(
						`[SHELLY NG][DELEGATES MANAGER] Failed to set value for component=${comp.key} attribute=output and property=${switcherOn.id}`,
						{
							message: err.message,
							stack: err.stack,
						},
					);
				});
			});

			this.setHandlers.set(
				`${delegate.id}|${switcherOn.id}`,
				async (val: string | number | boolean): Promise<boolean> => {
					if (typeof val !== 'boolean') {
						return false;
					}

					const result = await comp.set(val);

					return result.was_on !== val;
				},
			);

			if (typeof comp.aenergy !== 'undefined') {
				const electricalEnergy = await this.ensureChannel(
					device,
					'identifier',
					`energy:${comp.key}`,
					ChannelCategory.ELECTRICAL_ENERGY,
					comp.name,
				);

				const consumption = await this.ensureProperty(
					electricalEnergy,
					PropertyCategory.CONSUMPTION,
					'identifier',
					'aenergy',
					this.toEnergy(comp.aenergy),
				);

				this.changeHandlers.set(`${delegate.id}|${comp.key}|aenergy`, (val: CharacteristicValue): void => {
					this.handleChange(consumption, this.toEnergy(val), false).catch((err: Error): void => {
						this.logger.error(
							`[SHELLY NG][DELEGATES MANAGER] Failed to set value for component=${comp.key} attribute=aenergy and property=${consumption.id}`,
							{
								message: err.message,
								stack: err.stack,
							},
						);
					});
				});
			}

			if (typeof comp.apower !== 'undefined') {
				const electricalPower = await this.ensureChannel(
					device,
					'identifier',
					`power:${comp.key}`,
					ChannelCategory.ELECTRICAL_POWER,
					comp.name,
				);

				const power = await this.ensureProperty(
					electricalPower,
					PropertyCategory.POWER,
					'identifier',
					'apower',
					comp.apower,
				);

				this.changeHandlers.set(`${delegate.id}|${comp.key}|apower`, (val: CharacteristicValue): void => {
					this.handleChange(power, Number(val), false).catch((err: Error): void => {
						this.logger.error(
							`[SHELLY NG][DELEGATES MANAGER] Failed to set value for component=${comp.key} attribute=apower and property=${power.id}`,
							{
								message: err.message,
								stack: err.stack,
							},
						);
					});
				});

				if (typeof comp.voltage !== 'undefined') {
					const voltage = await this.ensureProperty(
						electricalPower,
						PropertyCategory.VOLTAGE,
						'identifier',
						'voltage',
						comp.voltage,
					);

					this.changeHandlers.set(`${delegate.id}|${comp.key}|voltage`, (val: CharacteristicValue): void => {
						this.handleChange(voltage, Number(val), false).catch((err: Error): void => {
							this.logger.error(
								`[SHELLY NG][DELEGATES MANAGER] Failed to set value for component=${comp.key} attribute=voltage and property=${voltage.id}`,
								{
									message: err.message,
									stack: err.stack,
								},
							);
						});
					});
				}

				if (typeof comp.current !== 'undefined') {
					const current = await this.ensureProperty(
						electricalPower,
						PropertyCategory.CURRENT,
						'identifier',
						'current',
						comp.current,
					);

					this.changeHandlers.set(`${delegate.id}|${comp.key}|current`, (val: CharacteristicValue): void => {
						this.handleChange(current, Number(val), false).catch((err: Error): void => {
							this.logger.error(
								`[SHELLY NG][DELEGATES MANAGER] Failed to set value for component=${comp.key} attribute=current and property=${current.id}`,
								{
									message: err.message,
									stack: err.stack,
								},
							);
						});
					});
				}
			}
		}

		for (const comp of delegate.lights.values()) {
			const light = await this.ensureChannel(
				device,
				'identifier',
				`light:${comp.key}`,
				ChannelCategory.LIGHT,
				comp.name,
			);

			const lightOn = await this.ensureProperty(light, PropertyCategory.ON, 'identifier', 'output', comp.output);

			this.changeHandlers.set(`${delegate.id}|${comp.key}|output`, (val: CharacteristicValue): void => {
				this.handleChange(lightOn, !!val).catch((err: Error): void => {
					this.logger.error(
						`[SHELLY NG][DELEGATES MANAGER] Failed to set value for component=${comp.key} attribute=output and property=${lightOn.id}`,
						{
							message: err.message,
							stack: err.stack,
						},
					);
				});
			});

			this.setHandlers.set(`${delegate.id}|${lightOn.id}`, async (val: string | number | boolean): Promise<boolean> => {
				if (typeof val !== 'boolean') {
					return false;
				}

				await comp.set(val);

				return true;
			});

			if (typeof comp.brightness !== 'undefined') {
				const brightness = await this.ensureProperty(
					light,
					PropertyCategory.BRIGHTNESS,
					'identifier',
					'brightness',
					comp.brightness,
				);

				this.changeHandlers.set(`${delegate.id}|${comp.key}|brightness`, (val: CharacteristicValue): void => {
					this.handleChange(brightness, this.clampNumber(Number(val), 0, 100)).catch((err: Error): void => {
						this.logger.error(
							`[SHELLY NG][DELEGATES MANAGER] Failed to set value for component=${comp.key} attribute=brightness and property=${brightness.id}`,
							{
								message: err.message,
								stack: err.stack,
							},
						);
					});
				});

				this.setHandlers.set(
					`${delegate.id}|${brightness.id}`,
					async (val: string | number | boolean): Promise<boolean> => {
						if (typeof val !== 'number') {
							return false;
						}

						await comp.set(comp.output, this.clampNumber(val, 0, 100));

						return true;
					},
				);
			}
		}

		for (const comp of delegate.covers.values()) {
			const cover = await this.ensureChannel(
				device,
				'identifier',
				`cover:${comp.key}`,
				ChannelCategory.WINDOW_COVERING,
				comp.name,
			);

			const coverState = await this.ensureProperty(cover, PropertyCategory.STATUS, 'identifier', 'state', comp.state);

			this.changeHandlers.set(`${delegate.id}|${comp.key}|state`, (val: CharacteristicValue): void => {
				if (typeof val !== 'string') {
					return;
				}

				if (val === 'calibrating') return;

				this.handleChange(coverState, val).catch((err: Error): void => {
					this.logger.error(
						`[SHELLY NG][DELEGATES MANAGER] Failed to set value for component=${comp.key} attribute=state and property=${coverState.id}`,
						{
							message: err.message,
							stack: err.stack,
						},
					);
				});
			});

			const coverPosition = await this.ensureProperty(
				cover,
				PropertyCategory.POSITION,
				'identifier',
				'current_pos',
				comp.current_pos,
			);

			this.changeHandlers.set(`${delegate.id}|${comp.key}|current_pos`, (val: CharacteristicValue): void => {
				this.handleChange(coverPosition, Number(val)).catch((err: Error): void => {
					this.logger.error(
						`[SHELLY NG][DELEGATES MANAGER] Failed to set value for component=${comp.key} attribute=current_pos and property=${coverPosition.id}`,
						{
							message: err.message,
							stack: err.stack,
						},
					);
				});
			});

			this.setHandlers.set(
				`${delegate.id}|${coverPosition.id}`,
				async (val: string | number | boolean): Promise<boolean> => {
					if (typeof val !== 'number') {
						return false;
					}

					await comp.goToPosition(this.clampNumber(val, 0, 100));

					return true;
				},
			);

			const coverCommand = await this.ensureProperty(
				cover,
				PropertyCategory.COMMAND,
				'category',
				PropertyCategory.COMMAND,
				'stop',
			);

			this.setHandlers.set(
				`${delegate.id}|${coverCommand.id}`,
				async (val: string | number | boolean): Promise<boolean> => {
					if (typeof val !== 'string') {
						return false;
					}

					if (val === 'open') await comp.open();
					if (val === 'close') await comp.close();
					if (val === 'stop') await comp.stop();

					return true;
				},
			);
		}

		const valueHandler = (compKey: string, attr: string, val: CharacteristicValue): void => {
			const handler = this.changeHandlers.get(`${delegate.id}|${compKey}|${attr}`);

			if (!handler) {
				return;
			}

			try {
				handler(val);
			} catch (error) {
				const err = error as Error;

				this.logger.error(
					`[SHELLY NG][DELEGATES MANAGER] Shelly handler error for component=${compKey} attribute=${attr}`,
					{
						message: err.message,
						stack: err.stack,
					},
				);
			}
		};

		delegate.on('value', valueHandler);

		this.delegateValueHandlers.set(delegate.id, valueHandler);

		const connectionHandler = (state: boolean): void => {
			this.handleChange(connectionState, state ? ConnectionState.CONNECTED : ConnectionState.DISCONNECTED)
				.then((): void => {
					if (state) {
						this.logger.debug(
							`[SHELLY NG][DELEGATES MANAGER] Connection state for device=${delegate.id} changed to connected`,
							state,
						);
					} else {
						this.logger.debug(
							`[SHELLY NG][DELEGATES MANAGER] Connection state for device=${delegate.id} changed to disconnected`,
							state,
						);
					}
				})
				.catch((err: Error) => {
					this.logger.error(
						`[SHELLY NG][DELEGATES MANAGER] Failed to set state=${state ? ConnectionState.CONNECTED : ConnectionState.DISCONNECTED} for device=${delegate.id}`,
						{
							message: err.message,
							stack: err.stack,
						},
					);
				});
		};

		delegate.on('connected', connectionHandler);

		this.delegateConnectionHandlers.set(delegate.id, connectionHandler);

		this.logger.log(`[SHELLY NG][DELEGATES MANAGER] Attached Shelly device=${delegate.id}`);

		return delegate;
	}

	remove(deviceId: string): void {
		const delegate = this.delegates.get(deviceId);

		if (!delegate) {
			return;
		}

		const valueHandler = this.delegateValueHandlers.get(delegate.id);

		if (valueHandler) {
			delegate.off('value', valueHandler);
		}

		const connectionHandler = this.delegateConnectionHandlers.get(delegate.id);

		if (connectionHandler) {
			delegate.off('connected', connectionHandler);
		}

		this.delegateValueHandlers.delete(delegate.id);
		this.delegateConnectionHandlers.delete(delegate.id);

		for (const key of Array.from(this.changeHandlers.keys())) {
			if (key.startsWith(`${deviceId}|`)) {
				this.changeHandlers.delete(key);
			}
		}

		for (const key of Array.from(this.setHandlers.keys())) {
			if (key.startsWith(`${deviceId}|`)) {
				this.setHandlers.delete(key);
			}
		}

		const ids = this.propertiesMap.get(deviceId);

		if (ids) {
			for (const pid of ids) {
				clearTimeout(this.pendingWrites.get(pid));

				this.pendingWrites.delete(pid);
			}

			this.propertiesMap.delete(deviceId);
		}

		this.delegates.delete(deviceId);

		this.logger.log(`[SHELLY NG][DELEGATES MANAGER] Detached Shelly device=${deviceId}`);
	}

	async setPropertyValue(
		device: ShellyNgDeviceEntity,
		property: ShellyNgChannelPropertyEntity,
		value: string | number | boolean,
	): Promise<boolean> {
		const handler = this.setHandlers.get(`${device.identifier}|${property.id}`);

		if (!handler) {
			this.logger.warn(
				`[SHELLY NG][DELEGATES MANAGER] Trying to write to device=${device.identifier} to not writable property=${property.id} value=${value}`,
			);

			return Promise.resolve(false);
		}

		this.logger.debug(
			`[SHELLY NG][DELEGATES MANAGER] Writing value to Shelly device=${device.identifier} property=${property.id} value=${value}`,
		);

		return handler(value);
	}

	private async handleChange(
		property: ShellyNgChannelPropertyEntity,
		value: string | number | boolean,
		immediately = true,
	): Promise<void> {
		this.logger.debug(`[SHELLY NG][DELEGATES MANAGER] Received component attribute update from Shelly device`);

		if (immediately) {
			await this.writeValueToProperty(property, value);
		} else {
			this.scheduleWrite(property, value);
		}
	}

	private async ensureChannel(
		device: ShellyNgDeviceEntity,
		column: 'identifier' | 'category',
		identifierOrCategory: string | ChannelCategory,
		category: ChannelCategory,
		name: string,
	): Promise<ShellyNgChannelEntity> {
		if (column === 'category' && (typeof identifierOrCategory === 'string' || identifierOrCategory !== category)) {
			throw new DevicesShellyNgException('Provided channel category is mismatched with searched');
		}

		let channel = await this.channelsService.findOneBy(column, identifierOrCategory, device.id, DEVICES_SHELLY_NG_TYPE);

		if (channel === null) {
			const channelSpec = channelsSchema[category] as ChannelDefinition | undefined;

			if (!channelSpec || typeof channelSpec !== 'object') {
				this.logger.warn(`[SHELLY NG][DELEGATES MANAGER] Missing or invalid schema for channel category=${category}`);

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
		value: string | number | boolean,
		options?: {
			data_type?: DataTypeType;
			format?: string[] | number[];
			permissions?: PermissionType[];
			unit?: string | null;
		},
	): Promise<ShellyNgChannelPropertyEntity> {
		if (column === 'category' && (typeof identifierOrCategory === 'string' || identifierOrCategory !== category)) {
			throw new DevicesShellyNgException('Provided channel property category is mismatched with searched');
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
					`[SHELLY NG][DELEGATES MANAGER] Missing or invalid schema for channel category=${channel.category}`,
				);

				throw new DevicesShellyNgException('Failed to load specification for channel category');
			}

			const propertySpec = channelSpec['properties'][category] as
				| { permissions: string[]; data_type: string; unit: string | null; format: string[] | number[] | null }
				| undefined;

			if (!propertySpec || typeof propertySpec !== 'object') {
				this.logger.warn(`[SHELLY NG][DELEGATES MANAGER] Missing or invalid schema for property category=${category}`);

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

		await this.writeValueToProperty(prop, value);

		const deviceId = typeof channel.device === 'string' ? channel.device : channel.device.id;

		let set = this.propertiesMap.get(deviceId);

		if (!set) {
			this.propertiesMap.set(deviceId, (set = new Set()));
		}

		set.add(prop.id);

		return prop;
	}

	private determineCategory(delegate: ShellyDeviceDelegate): DeviceCategory {
		if (delegate.covers.size > 0) {
			return DeviceCategory.WINDOW_COVERING;
		} else if (delegate.lights.size > 0) {
			return DeviceCategory.LIGHTING;
		}

		return DeviceCategory.SWITCHER;
	}

	private clampNumber(number: number, min: number, max: number): number {
		return Math.max(min, Math.min(max, Number(number)));
	}

	private scheduleWrite(property: ShellyNgChannelPropertyEntity, value: string | number | boolean): void {
		clearTimeout(this.pendingWrites.get(property.id));

		const t = setTimeout((): void => {
			this.writeValueToProperty(property, value).catch((err: Error) => {
				this.logger.error(
					`[SHELLY NG][DELEGATES MANAGER] Failed to process scheduled write of value=${value} to property=${property.id}`,
					{
						message: err.message,
						stack: err.stack,
					},
				);
			});
		}, 250);

		this.pendingWrites.set(property.id, t);
	}

	private toEnergy(v: unknown): number {
		if (typeof v === 'number') {
			return v;
		}

		if (typeof v === 'object' && v !== null) {
			const rec = v as Record<string, unknown>;

			const t = rec.total;

			if (typeof t === 'number') {
				return t;
			}

			if (typeof t === 'string') {
				const n = Number(t);

				return Number.isFinite(n) ? n : 0;
			}
		}

		return 0;
	}

	private rssiToQuality(rssi: number): number {
		if (rssi <= -100) {
			return 0;
		}

		if (rssi >= -50) {
			return 100;
		}

		return Math.round(2 * (rssi + 100));
	}

	private async writeValueToProperty(
		property: ShellyNgChannelPropertyEntity,
		value: string | number | boolean,
	): Promise<ShellyNgChannelPropertyEntity> {
		return await this.channelsPropertiesService.update(
			property.id,
			toInstance(UpdateShellyNgChannelPropertyDto, {
				...instanceToPlain(property),
				value,
			}),
		);
	}

	detach(): void {
		for (const [deviceId] of this.delegates.entries()) {
			this.remove(deviceId);
		}

		this.changeHandlers.clear();
		this.setHandlers.clear();
		this.propertiesMap.clear();
	}

	destroy(): void {
		this.detach();
	}
}
