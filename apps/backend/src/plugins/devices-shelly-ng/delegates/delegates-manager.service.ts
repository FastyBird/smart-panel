import { instanceToPlain } from 'class-transformer';
import { CharacteristicValue, Device, Ethernet, WiFi } from 'shellies-ds9';

import { Injectable, Logger } from '@nestjs/common';

import {
	clampNumber,
	coerceBooleanSafe,
	coerceNumberSafe,
	safeToString,
	toInstance,
} from '../../../common/utils/transform.utils';
import {
	ChannelCategory,
	ConnectionState,
	DeviceCategory,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { ComponentType, DEVICES_SHELLY_NG_TYPE } from '../devices-shelly-ng.constants';
import { DevicesShellyNgException, DevicesShellyNgNotFoundException } from '../devices-shelly-ng.exceptions';
import { CreateShellyNgDeviceDto } from '../dto/create-device.dto';
import { UpdateShellyNgChannelPropertyDto } from '../dto/update-channel-property.dto';
import {
	ShellyNgChannelEntity,
	ShellyNgChannelPropertyEntity,
	ShellyNgDeviceEntity,
} from '../entities/devices-shelly-ng.entity';
import { CoerceNumberOpts, rssiToQuality, toEnergy } from '../utils/transform.utils';

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

		const hostname = shelly.wifi?.sta_ip ?? shelly.ethernet?.ip ?? null;

		if (hostname === null) {
			throw new DevicesShellyNgException('Missing device hostname or IP address');
		}

		let device = await this.devicesService.findOneBy<ShellyNgDeviceEntity>(
			'identifier',
			shelly.id,
			DEVICES_SHELLY_NG_TYPE,
		);

		if (device === null) {
			device = await this.devicesService.create<ShellyNgDeviceEntity, CreateShellyNgDeviceDto>({
				type: DEVICES_SHELLY_NG_TYPE,
				category: this.determineCategory(delegate),
				identifier: shelly.id,
				hostname,
				name: shelly.system.config.device.name ?? shelly.modelName,
			});
		}

		const deviceInformation = await this.channelsService.findOneBy<ShellyNgChannelEntity>(
			'category',
			ChannelCategory.DEVICE_INFORMATION,
			device.id,
			DEVICES_SHELLY_NG_TYPE,
		);

		if (deviceInformation === null) {
			throw new DevicesShellyNgNotFoundException('Failed to load device information channel');
		}

		const connectionState = await this.channelsPropertiesService.findOneBy<ShellyNgChannelPropertyEntity>(
			'category',
			PropertyCategory.STATUS,
			deviceInformation.id,
		);

		const linkQuality = await this.channelsPropertiesService.findOneBy<ShellyNgChannelPropertyEntity>(
			'category',
			PropertyCategory.LINK_QUALITY,
			deviceInformation.id,
		);

		if (linkQuality !== null) {
			if (ComponentType.WIFI in shelly) {
				const comp = shelly.wifi as WiFi;

				await this.setDefaultPropertyValue(device.id, linkQuality, clampNumber(rssiToQuality(comp.rssi), 0, 100));
			}

			this.changeHandlers.set(
				`${delegate.id}|${deviceInformation.identifier}|rssi`,
				(val: CharacteristicValue): void => {
					const n = coerceNumberSafe(val);

					if (n === null || Number.isNaN(n)) {
						this.logger.warn(
							`[SHELLY NG][DELEGATES MANAGER] Dropping invalid numeric update for link quality -> ${safeToString(val)} (property=${linkQuality.id})`,
						);

						return;
					}

					this.handleChange(linkQuality, clampNumber(rssiToQuality(n), 0, 100)).catch((err: Error): void => {
						this.logger.error(
							`[SHELLY NG][DELEGATES MANAGER] Failed to set value for component=${deviceInformation.identifier} attribute=rssi and property=${linkQuality.id}`,
							{
								message: err.message,
								stack: err.stack,
							},
						);
					});
				},
			);
		}

		for (const comp of delegate.switches.values()) {
			const switcher = await this.channelsService.findOneBy<ShellyNgChannelEntity>(
				'identifier',
				`switch:${comp.id}`,
				device.id,
				DEVICES_SHELLY_NG_TYPE,
			);

			if (switcher === null) {
				throw new DevicesShellyNgNotFoundException('Failed to load switcher channel');
			}

			const switcherOn = await this.channelsPropertiesService.findOneBy<ShellyNgChannelPropertyEntity>(
				'identifier',
				'output',
				switcher.id,
			);

			if (switcherOn === null) {
				throw new DevicesShellyNgNotFoundException('Failed to load switcher on channel property');
			}

			await this.setDefaultPropertyValue(device.id, switcherOn, comp.output);

			this.changeHandlers.set(`${delegate.id}|${comp.key}|output`, (val: CharacteristicValue): void => {
				this.handleChange(switcherOn, coerceBooleanSafe(val)).catch((err: Error): void => {
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

					await comp.set(val);

					return true;
				},
			);

			if (typeof comp.aenergy !== 'undefined') {
				const electricalEnergy = await this.channelsService.findOneBy<ShellyNgChannelEntity>(
					'identifier',
					`energy:${comp.id}`,
					device.id,
					DEVICES_SHELLY_NG_TYPE,
				);

				if (electricalEnergy === null) {
					throw new DevicesShellyNgNotFoundException('Failed to load energy channel');
				}

				const consumption = await this.channelsPropertiesService.findOneBy<ShellyNgChannelPropertyEntity>(
					'identifier',
					'aenergy',
					electricalEnergy.id,
				);

				if (consumption === null) {
					throw new DevicesShellyNgNotFoundException('Failed to load energy consumption channel property');
				}

				await this.setDefaultPropertyValue(device.id, consumption, toEnergy(comp.aenergy));

				this.changeHandlers.set(`${delegate.id}|${comp.key}|aenergy`, (val: CharacteristicValue): void => {
					this.handleNumericChange(comp.key, 'aenergy', consumption.id, val, (n) =>
						this.handleChange(consumption, toEnergy(n), false),
					);
				});
			}

			if (typeof comp.apower !== 'undefined') {
				const electricalPower = await this.channelsService.findOneBy<ShellyNgChannelEntity>(
					'identifier',
					`power:${comp.id}`,
					device.id,
					DEVICES_SHELLY_NG_TYPE,
				);

				if (electricalPower === null) {
					throw new DevicesShellyNgNotFoundException('Failed to load electrical power channel');
				}

				const power = await this.channelsPropertiesService.findOneBy<ShellyNgChannelPropertyEntity>(
					'identifier',
					'apower',
					electricalPower.id,
				);

				if (power === null) {
					throw new DevicesShellyNgNotFoundException('Failed to load electrical power channel property');
				}

				await this.setDefaultPropertyValue(device.id, power, comp.apower);

				this.changeHandlers.set(`${delegate.id}|${comp.key}|apower`, (val: CharacteristicValue): void => {
					this.handleNumericChange(comp.key, 'apower', power.id, val, (n) => this.handleChange(power, n, false));
				});

				if (typeof comp.voltage !== 'undefined') {
					const voltage = await this.channelsPropertiesService.findOneBy<ShellyNgChannelPropertyEntity>(
						'identifier',
						'voltage',
						electricalPower.id,
					);

					if (voltage === null) {
						throw new DevicesShellyNgNotFoundException('Failed to load electrical power voltage channel property');
					}

					await this.setDefaultPropertyValue(device.id, voltage, comp.voltage);

					this.changeHandlers.set(`${delegate.id}|${comp.key}|voltage`, (val: CharacteristicValue): void => {
						this.handleNumericChange(comp.key, 'voltage', voltage.id, val, (n) => this.handleChange(voltage, n, false));
					});
				}

				if (typeof comp.current !== 'undefined') {
					const current = await this.channelsPropertiesService.findOneBy<ShellyNgChannelPropertyEntity>(
						'identifier',
						'current',
						electricalPower.id,
					);

					if (current === null) {
						throw new DevicesShellyNgNotFoundException('Failed to load electrical power current channel property');
					}

					await this.setDefaultPropertyValue(device.id, current, comp.current);

					this.changeHandlers.set(`${delegate.id}|${comp.key}|current`, (val: CharacteristicValue): void => {
						this.handleNumericChange(comp.key, 'current', current.id, val, (n) => this.handleChange(current, n, false));
					});
				}
			}
		}

		for (const comp of delegate.lights.values()) {
			const light = await this.channelsService.findOneBy<ShellyNgChannelEntity>(
				'identifier',
				`light:${comp.id}`,
				device.id,
				DEVICES_SHELLY_NG_TYPE,
			);

			if (light === null) {
				throw new DevicesShellyNgNotFoundException('Failed to load light channel');
			}

			const lightOn = await this.channelsPropertiesService.findOneBy<ShellyNgChannelPropertyEntity>(
				'identifier',
				'output',
				light.id,
			);

			if (lightOn === null) {
				throw new DevicesShellyNgNotFoundException('Failed to load light on channel property');
			}

			await this.setDefaultPropertyValue(device.id, lightOn, comp.output);

			this.changeHandlers.set(`${delegate.id}|${comp.key}|output`, (val: CharacteristicValue): void => {
				this.handleChange(lightOn, coerceBooleanSafe(val)).catch((err: Error): void => {
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
				const brightness = await this.channelsPropertiesService.findOneBy<ShellyNgChannelPropertyEntity>(
					'identifier',
					'brightness',
					light.id,
				);

				if (brightness === null) {
					throw new DevicesShellyNgNotFoundException('Failed to load light brightness channel property');
				}

				await this.setDefaultPropertyValue(device.id, brightness, clampNumber(comp.brightness, 0, 100));

				this.changeHandlers.set(`${delegate.id}|${comp.key}|brightness`, (val: CharacteristicValue): void => {
					this.handleNumericChange(
						comp.key,
						'brightness',
						brightness.id,
						val,
						(n) => this.handleChange(brightness, n, false),
						{ clamp: { min: 0, max: 100 } },
					);
				});

				this.setHandlers.set(
					`${delegate.id}|${brightness.id}`,
					async (val: string | number | boolean): Promise<boolean> => {
						const n = coerceNumberSafe(val);

						if (n === null || Number.isNaN(n)) {
							this.logger.warn(
								`[SHELLY NG][DELEGATES MANAGER] Dropping invalid numeric update for ${comp.key}.brightness -> ${String(val)} (property=${brightness.id})`,
							);

							return;
						}

						await comp.set(comp.output, clampNumber(n, 0, 100));

						return true;
					},
				);
			}
		}

		for (const comp of delegate.covers.values()) {
			const cover = await this.channelsService.findOneBy<ShellyNgChannelEntity>(
				'identifier',
				`cover:${comp.id}`,
				device.id,
				DEVICES_SHELLY_NG_TYPE,
			);

			if (cover === null) {
				throw new DevicesShellyNgNotFoundException('Failed to load cover channel');
			}

			const coverState = await this.channelsPropertiesService.findOneBy<ShellyNgChannelPropertyEntity>(
				'identifier',
				'state',
				cover.id,
			);

			if (coverState === null) {
				throw new DevicesShellyNgNotFoundException('Failed to load cover state channel property');
			}

			await this.setDefaultPropertyValue(device.id, coverState, comp.state);

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

			const coverPosition = await this.channelsPropertiesService.findOneBy<ShellyNgChannelPropertyEntity>(
				'identifier',
				'current_pos',
				cover.id,
			);

			if (coverPosition === null) {
				throw new DevicesShellyNgNotFoundException('Failed to load cover position channel property');
			}

			await this.setDefaultPropertyValue(device.id, coverPosition, clampNumber(comp.current_pos, 0, 100));

			this.changeHandlers.set(`${delegate.id}|${comp.key}|current_pos`, (val: CharacteristicValue): void => {
				this.handleNumericChange(
					comp.key,
					'current_pos',
					coverPosition.id,
					val,
					(n) => this.handleChange(coverPosition, n, false),
					{ clamp: { min: 0, max: 100 } },
				);
			});

			this.setHandlers.set(
				`${delegate.id}|${coverPosition.id}`,
				async (val: string | number | boolean): Promise<boolean> => {
					const n = coerceNumberSafe(val);

					if (n === null || Number.isNaN(n)) {
						this.logger.warn(
							`[SHELLY NG][DELEGATES MANAGER] Dropping invalid numeric update for ${comp.key}.current_pos -> ${String(val)} (property=${coverPosition.id})`,
						);

						return;
					}

					await comp.goToPosition(clampNumber(n, 0, 100));

					return true;
				},
			);

			const coverCommand = await this.channelsPropertiesService.findOneBy<ShellyNgChannelPropertyEntity>(
				'category',
				PropertyCategory.COMMAND,
				cover.id,
			);

			if (coverCommand === null) {
				throw new DevicesShellyNgNotFoundException('Failed to load cover command channel property');
			}

			await this.setDefaultPropertyValue(device.id, coverCommand, 'stop');

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

		for (const comp of delegate.hums.values()) {
			const humidity = await this.channelsService.findOneBy<ShellyNgChannelEntity>(
				'identifier',
				`humidity:${comp.id}`,
				device.id,
				DEVICES_SHELLY_NG_TYPE,
			);

			if (humidity === null) {
				throw new DevicesShellyNgNotFoundException('Failed to load humidity channel');
			}

			const relativeHumidity = await this.channelsPropertiesService.findOneBy<ShellyNgChannelPropertyEntity>(
				'identifier',
				'rh',
				humidity.id,
			);

			if (relativeHumidity === null) {
				throw new DevicesShellyNgNotFoundException('Failed to load humidity channel property');
			}

			await this.setDefaultPropertyValue(device.id, relativeHumidity, clampNumber(comp.rh, 0, 100));

			this.changeHandlers.set(`${delegate.id}|${comp.key}|rh`, (val: CharacteristicValue): void => {
				this.handleNumericChange(
					comp.key,
					'rh',
					relativeHumidity.id,
					val,
					(n) => this.handleChange(relativeHumidity, n, false),
					{ clamp: { min: 0, max: 100 } },
				);
			});
		}

		for (const comp of delegate.temps.values()) {
			const temperature = await this.channelsService.findOneBy<ShellyNgChannelEntity>(
				'identifier',
				`temperature:${comp.id}`,
				device.id,
				DEVICES_SHELLY_NG_TYPE,
			);

			if (temperature === null) {
				throw new DevicesShellyNgNotFoundException('Failed to load temperature channel');
			}

			const relativeTemperature = await this.channelsPropertiesService.findOneBy<ShellyNgChannelPropertyEntity>(
				'identifier',
				'tC',
				temperature.id,
			);

			if (relativeTemperature === null) {
				throw new DevicesShellyNgNotFoundException('Failed to load temperature channel property');
			}

			await this.setDefaultPropertyValue(device.id, relativeTemperature, comp.tC);

			this.changeHandlers.set(`${delegate.id}|${comp.key}|tC`, (val: CharacteristicValue): void => {
				this.handleNumericChange(comp.key, 'tC', relativeTemperature.id, val, (n) =>
					this.handleChange(relativeTemperature, n, false),
				);
			});
		}

		for (const comp of delegate.devPwr.values()) {
			const devicePower = await this.channelsService.findOneBy<ShellyNgChannelEntity>(
				'identifier',
				`devicePower:${comp.id}`,
				device.id,
				DEVICES_SHELLY_NG_TYPE,
			);

			if (devicePower === null) {
				throw new DevicesShellyNgNotFoundException('Failed to load device power channel');
			}

			if (comp.battery) {
				const battery = await this.channelsPropertiesService.findOneBy<ShellyNgChannelPropertyEntity>(
					'identifier',
					'battery',
					devicePower.id,
				);

				if (battery === null) {
					throw new DevicesShellyNgNotFoundException('Failed to load device power battery channel property');
				}

				await this.setDefaultPropertyValue(device.id, battery, clampNumber(comp.battery.percent, 0, 100));

				this.changeHandlers.set(`${delegate.id}|${comp.key}|battery.percent`, (val: CharacteristicValue): void => {
					this.handleNumericChange(
						comp.key,
						'battery.percent',
						battery.id,
						val,
						(n) => this.handleChange(battery, n, false),
						{ clamp: { min: 0, max: 100 } },
					);
				});
			}
		}

		for (const comp of delegate.powerMeter.values()) {
			const electricalPower = await this.channelsService.findOneBy<ShellyNgChannelEntity>(
				'identifier',
				`power:${comp.id}`,
				device.id,
				DEVICES_SHELLY_NG_TYPE,
			);

			if (electricalPower === null) {
				throw new DevicesShellyNgNotFoundException('Failed to load electrical power channel');
			}

			const power = await this.channelsPropertiesService.findOneBy<ShellyNgChannelPropertyEntity>(
				'identifier',
				'apower',
				electricalPower.id,
			);

			if (power === null) {
				throw new DevicesShellyNgNotFoundException('Failed to load electrical power channel property');
			}

			await this.setDefaultPropertyValue(device.id, power, comp.apower);

			this.changeHandlers.set(`${delegate.id}|${comp.key}|apower`, (val: CharacteristicValue): void => {
				this.handleNumericChange(comp.key, 'apower', power.id, val, (n) => this.handleChange(power, n, false));
			});

			if (typeof comp.voltage !== 'undefined') {
				const voltage = await this.channelsPropertiesService.findOneBy<ShellyNgChannelPropertyEntity>(
					'identifier',
					'voltage',
					electricalPower.id,
				);

				if (voltage === null) {
					throw new DevicesShellyNgNotFoundException('Failed to load electrical power voltage channel property');
				}

				await this.setDefaultPropertyValue(device.id, voltage, comp.voltage);

				this.changeHandlers.set(`${delegate.id}|${comp.key}|voltage`, (val: CharacteristicValue): void => {
					this.handleNumericChange(comp.key, 'voltage', voltage.id, val, (n) => this.handleChange(voltage, n, false));
				});
			}

			if (typeof comp.current !== 'undefined') {
				const current = await this.channelsPropertiesService.findOneBy<ShellyNgChannelPropertyEntity>(
					'identifier',
					'current',
					electricalPower.id,
				);

				if (current === null) {
					throw new DevicesShellyNgNotFoundException('Failed to load electrical power current channel property');
				}

				await this.setDefaultPropertyValue(device.id, current, comp.current);

				this.changeHandlers.set(`${delegate.id}|${comp.key}|current`, (val: CharacteristicValue): void => {
					this.handleNumericChange(comp.key, 'current', current.id, val, (n) => this.handleChange(current, n, false));
				});
			}

			if (typeof comp.aenergy !== 'undefined') {
				const electricalEnergy = await this.channelsService.findOneBy<ShellyNgChannelEntity>(
					'identifier',
					`energy:${comp.id}`,
					device.id,
					DEVICES_SHELLY_NG_TYPE,
				);

				if (electricalEnergy === null) {
					throw new DevicesShellyNgNotFoundException('Failed to load energy channel');
				}

				const consumption = await this.channelsPropertiesService.findOneBy<ShellyNgChannelPropertyEntity>(
					'identifier',
					'aenergy',
					electricalEnergy.id,
				);

				if (consumption === null) {
					throw new DevicesShellyNgNotFoundException('Failed to load energy consumption channel property');
				}

				await this.setDefaultPropertyValue(device.id, consumption, toEnergy(comp.aenergy));

				this.changeHandlers.set(`${delegate.id}|${comp.key}|aenergy`, (val: CharacteristicValue): void => {
					this.handleNumericChange(comp.key, 'aenergy', consumption.id, val, (n) =>
						this.handleChange(consumption, toEnergy(n), false),
					);
				});
			}
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

		const connectionHandler = (state: boolean | null): void => {
			this.handleChange(
				connectionState,
				state === null ? ConnectionState.UNKNOWN : state ? ConnectionState.CONNECTED : ConnectionState.DISCONNECTED,
			)
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

		connectionHandler(true);

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
			connectionHandler(null);

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

	private async setDefaultPropertyValue(
		deviceId: string,
		property: ShellyNgChannelPropertyEntity,
		value: string | number | boolean | null,
	): Promise<void> {
		await this.writeValueToProperty(property, value);

		let set = this.propertiesMap.get(deviceId);

		if (!set) {
			this.propertiesMap.set(deviceId, (set = new Set()));
		}

		set.add(property.id);
	}

	private determineCategory(delegate: ShellyDeviceDelegate): DeviceCategory {
		if (delegate.covers.size > 0) {
			return DeviceCategory.WINDOW_COVERING;
		} else if (delegate.lights.size > 0) {
			return DeviceCategory.LIGHTING;
		} else if (delegate.switches.size > 0) {
			return DeviceCategory.SWITCHER;
		} else if (
			delegate.inputs.size > 0 ||
			delegate.temps.size > 0 ||
			delegate.hums.size > 0 ||
			delegate.powerMeter.size > 0
		) {
			return DeviceCategory.SENSOR;
		}

		return DeviceCategory.GENERIC;
	}

	private handleNumericChange(
		compKey: string,
		attr: string,
		propertyId: string,
		val: unknown,
		write: (n: number) => Promise<void>,
		opts?: CoerceNumberOpts,
	): void {
		const n = coerceNumberSafe(val, opts);

		if (n === null || Number.isNaN(n)) {
			this.logger.warn(
				`[SHELLY NG][DELEGATES MANAGER] Dropping invalid numeric update for ${compKey}.${attr} -> ${safeToString(val)} (property=${propertyId})`,
			);

			return;
		}

		void write(n).catch((err: Error) => {
			this.logger.error(
				`[SHELLY NG][DELEGATES MANAGER] Failed to set value for component=${compKey} attribute=${attr} property=${propertyId}`,
				{ message: err.message, stack: err.stack },
			);
		});
	}

	private scheduleWrite(property: ShellyNgChannelPropertyEntity, value: string | number | boolean): void {
		const existing = this.pendingWrites.get(property.id);

		if (existing) {
			clearTimeout(existing);
		}

		const t = setTimeout(() => {
			const current = this.pendingWrites.get(property.id);

			if (current) {
				clearTimeout(current);

				this.pendingWrites.delete(property.id);
			}

			this.writeValueToProperty(property, value).catch((err: Error) => {
				this.logger.error(
					`[SHELLY NG][DELEGATES MANAGER] Failed to process scheduled write of value=${value} to property=${property.id}`,
					{ message: err.message, stack: err.stack },
				);
			});
		}, 250);

		this.pendingWrites.set(property.id, t);
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

		for (const pendingWrite of this.pendingWrites.values()) {
			clearTimeout(pendingWrite);
		}
	}

	destroy(): void {
		this.detach();
	}
}
