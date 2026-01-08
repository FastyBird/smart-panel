import { instanceToPlain } from 'class-transformer';
import { CharacteristicValue, Device, Ethernet, WiFi } from 'shellies-ds9';

import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
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
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { ComponentType, DEVICES_SHELLY_NG_PLUGIN_NAME, DEVICES_SHELLY_NG_TYPE } from '../devices-shelly-ng.constants';
import {
	DevicesShellyNgException,
	DevicesShellyNgNotFoundException,
	DevicesShellyNgNotImplementedException,
} from '../devices-shelly-ng.exceptions';
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

type BatchUpdate = {
	property: ShellyNgChannelPropertyEntity;
	val: string | number | boolean;
};

@Injectable()
export class DelegatesManagerService {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_SHELLY_NG_PLUGIN_NAME,
		'DelegatesManagerService',
	);

	private readonly delegates: Map<Device['id'], ShellyDeviceDelegate> = new Map();

	private readonly delegateValueHandlers: Map<
		string,
		(compKey: string, attr: string, val: CharacteristicValue) => void
	> = new Map();

	private readonly delegateConnectionHandlers: Map<string, (state: boolean) => void> = new Map();

	private readonly changeHandlers: Map<string, (val: CharacteristicValue) => void> = new Map();

	private readonly setChannelsHandlers: Map<string, (updates: BatchUpdate[]) => Promise<boolean>> = new Map();

	private readonly setPropertiesHandlers: Map<string, (val: string | number | boolean) => Promise<boolean>> = new Map();

	private readonly pendingWrites: Map<string, NodeJS.Timeout> = new Map();

	private readonly propertiesMap: Map<string, Set<string>> = new Map();

	constructor(
		private readonly devicesService: DevicesService,
		private readonly channelsService: ChannelsService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly deviceConnectivityService: DeviceConnectivityService,
	) {}

	get(id: Device['id']): ShellyDeviceDelegate | undefined {
		return this.delegates.get(id);
	}

	async insert(shelly: Device & MaybeNet, force: boolean = false): Promise<ShellyDeviceDelegate> {
		if (this.delegates.has(shelly.id)) {
			if (force) {
				this.remove(shelly.id);
			} else {
				return this.delegates.get(shelly.id);
			}
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

		await this.channelsPropertiesService.findOneBy<ShellyNgChannelPropertyEntity>(
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
							`Dropping invalid numeric update for link quality -> ${safeToString(val)} (property=${linkQuality.id})`,
						);

						return;
					}

					this.handleChange(linkQuality, clampNumber(rssiToQuality(n), 0, 100)).catch((err: Error): void => {
						this.logger.error(
							`Failed to set value for component=${deviceInformation.identifier} attribute=rssi and property=${linkQuality.id}`,
							{
								resource: device.id,
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
						`Failed to set value for component=${comp.key} attribute=output and property=${switcherOn.id}`,
						{
							resource: device.id,
							message: err.message,
							stack: err.stack,
						},
					);
				});
			});

			this.setPropertiesHandlers.set(
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
						`Failed to set value for component=${comp.key} attribute=state and property=${coverState.id}`,
						{
							resource: device.id,
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

			this.setPropertiesHandlers.set(
				`${delegate.id}|${coverPosition.id}`,
				async (val: string | number | boolean): Promise<boolean> => {
					const n = coerceNumberSafe(val);

					if (n === null || Number.isNaN(n)) {
						this.logger.warn(
							`Dropping invalid numeric update for ${comp.key}.current_pos -> ${String(val)} (property=${coverPosition.id})`,
						);

						return;
					}

					await comp.goToPosition(Math.round(clampNumber(n, 0, 100)));

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

			this.setPropertiesHandlers.set(
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
						`Failed to set value for component=${comp.key} attribute=output and property=${lightOn.id}`,
						{
							resource: device.id,
							message: err.message,
							stack: err.stack,
						},
					);
				});
			});

			this.setPropertiesHandlers.set(
				`${delegate.id}|${lightOn.id}`,
				async (val: string | number | boolean): Promise<boolean> => {
					if (typeof val !== 'boolean') {
						return false;
					}

					await comp.set(val);

					return true;
				},
			);

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

				this.setPropertiesHandlers.set(
					`${delegate.id}|${brightness.id}`,
					async (val: string | number | boolean): Promise<boolean> => {
						const n = coerceNumberSafe(val);

						if (n === null || Number.isNaN(n)) {
							this.logger.warn(
								`Dropping invalid numeric update for ${comp.key}.brightness -> ${String(val)} (property=${brightness.id})`,
							);

							return;
						}

						await comp.set(true, Math.round(clampNumber(n, 0, 100)));

						return true;
					},
				);
			}
		}

		for (const comp of delegate.rgb.values()) {
			const rgb = await this.channelsService.findOneBy<ShellyNgChannelEntity>(
				'identifier',
				`rgb:${comp.id}`,
				device.id,
				DEVICES_SHELLY_NG_TYPE,
			);

			if (rgb === null) {
				throw new DevicesShellyNgNotFoundException('Failed to load rgb channel');
			}

			const rgbOn = await this.channelsPropertiesService.findOneBy<ShellyNgChannelPropertyEntity>(
				'identifier',
				'output',
				rgb.id,
			);

			if (rgbOn === null) {
				throw new DevicesShellyNgNotFoundException('Failed to load rgb on channel property');
			}

			await this.setDefaultPropertyValue(device.id, rgbOn, comp.output);

			this.changeHandlers.set(`${delegate.id}|${comp.key}|output`, (val: CharacteristicValue): void => {
				this.handleChange(rgbOn, coerceBooleanSafe(val)).catch((err: Error): void => {
					this.logger.error(`Failed to set value for component=${comp.key} attribute=output and property=${rgbOn.id}`, {
						resource: device.id,
						message: err.message,
						stack: err.stack,
					});
				});
			});

			this.setPropertiesHandlers.set(
				`${delegate.id}|${rgbOn.id}`,
				async (val: string | number | boolean): Promise<boolean> => {
					if (typeof val !== 'boolean') {
						return false;
					}

					await comp.set(val);

					return true;
				},
			);

			if (typeof comp.brightness !== 'undefined') {
				const brightness = await this.channelsPropertiesService.findOneBy<ShellyNgChannelPropertyEntity>(
					'identifier',
					'brightness',
					rgb.id,
				);

				if (brightness === null) {
					throw new DevicesShellyNgNotFoundException('Failed to load rgb brightness channel property');
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

				this.setPropertiesHandlers.set(
					`${delegate.id}|${brightness.id}`,
					async (val: string | number | boolean): Promise<boolean> => {
						const n = coerceNumberSafe(val);

						if (n === null || Number.isNaN(n)) {
							this.logger.warn(
								`Dropping invalid numeric update for ${comp.key}.brightness -> ${String(val)} (property=${brightness.id})`,
							);

							return;
						}

						await comp.set(true, Math.round(clampNumber(n, 0, 100)));

						return true;
					},
				);
			}

			if (typeof comp.rgb !== 'undefined') {
				const colorRed = await this.channelsPropertiesService.findOneBy<ShellyNgChannelPropertyEntity>(
					'identifier',
					'rgb:red',
					rgb.id,
				);
				const colorGreen = await this.channelsPropertiesService.findOneBy<ShellyNgChannelPropertyEntity>(
					'identifier',
					'rgb:green',
					rgb.id,
				);
				const colorBlue = await this.channelsPropertiesService.findOneBy<ShellyNgChannelPropertyEntity>(
					'identifier',
					'rgb:blue',
					rgb.id,
				);

				if (colorRed === null || colorGreen === null || colorBlue === null) {
					throw new DevicesShellyNgNotFoundException('Failed to load rgb color channels properties');
				}

				await this.setDefaultPropertyValue(device.id, colorRed, clampNumber(comp.rgb[0], 0, 255));
				await this.setDefaultPropertyValue(device.id, colorGreen, clampNumber(comp.rgb[1], 0, 255));
				await this.setDefaultPropertyValue(device.id, colorBlue, clampNumber(comp.rgb[2], 0, 255));

				this.changeHandlers.set(`${delegate.id}|${comp.key}|rgb`, (val: CharacteristicValue): void => {
					this.handleNumericChange(
						comp.key,
						'rgb:red',
						colorRed.id,
						val[0],
						(n) => this.handleChange(colorRed, n, false),
						{ clamp: { min: 0, max: 255 } },
					);
					this.handleNumericChange(
						comp.key,
						'rgb:green',
						colorGreen.id,
						val[1],
						(n) => this.handleChange(colorGreen, n, false),
						{ clamp: { min: 0, max: 255 } },
					);
					this.handleNumericChange(
						comp.key,
						'rgb:blue',
						colorBlue.id,
						val[2],
						(n) => this.handleChange(colorBlue, n, false),
						{ clamp: { min: 0, max: 255 } },
					);
				});

				this.setPropertiesHandlers.set(
					`${delegate.id}|${colorRed.id}`,
					async (val: string | number | boolean): Promise<boolean> => {
						const n = coerceNumberSafe(val);

						if (n === null || Number.isNaN(n)) {
							this.logger.warn(
								`Dropping invalid numeric update for ${comp.key}.rgb:red -> ${String(val)} (property=${colorRed.id})`,
							);

							return;
						}

						await comp.set(true, comp.brightness, [Math.round(clampNumber(n, 0, 255)), comp.rgb[1], comp.rgb[2]]);

						return true;
					},
				);

				this.setPropertiesHandlers.set(
					`${delegate.id}|${colorGreen.id}`,
					async (val: string | number | boolean): Promise<boolean> => {
						const n = coerceNumberSafe(val);

						if (n === null || Number.isNaN(n)) {
							this.logger.warn(
								`Dropping invalid numeric update for ${comp.key}.rgb:green -> ${String(val)} (property=${colorGreen.id})`,
							);

							return;
						}

						await comp.set(true, comp.brightness, [comp.rgb[0], Math.round(clampNumber(n, 0, 255)), comp.rgb[2]]);

						return true;
					},
				);

				this.setPropertiesHandlers.set(
					`${delegate.id}|${colorBlue.id}`,
					async (val: string | number | boolean): Promise<boolean> => {
						const n = coerceNumberSafe(val);

						if (n === null || Number.isNaN(n)) {
							this.logger.warn(
								`Dropping invalid numeric update for ${comp.key}.rgb:blue -> ${String(val)} (property=${colorBlue.id})`,
							);

							return;
						}

						await comp.set(true, comp.brightness, [comp.rgb[0], comp.rgb[1], Math.round(clampNumber(n, 0, 255))]);

						return true;
					},
				);
			}

			this.setChannelsHandlers.set(`${delegate.id}|${rgb.id}`, async (updates: BatchUpdate[]): Promise<boolean> => {
				const outputUpdate = updates.find((u) => u.property.identifier === 'output');
				const brightnessUpdate = updates.find((u) => u.property.identifier === 'brightness');
				const colorRedUpdate = updates.find((u) => u.property.identifier === 'rgb:red');
				const colorGreenUpdate = updates.find((u) => u.property.identifier === 'rgb:green');
				const colorBlueUpdate = updates.find((u) => u.property.identifier === 'rgb:blue');

				// If brightness or color is being set, default to turning on unless explicitly set to false
				const hasBrightnessOrColorUpdate = brightnessUpdate || colorRedUpdate || colorGreenUpdate || colorBlueUpdate;
				const outputValue = outputUpdate
					? coerceBooleanSafe(outputUpdate.val)
					: hasBrightnessOrColorUpdate
						? true
						: coerceBooleanSafe(comp.output);
				const brightnessValue = brightnessUpdate
					? coerceNumberSafe(brightnessUpdate.val)
					: coerceNumberSafe(comp.brightness);
				const colorRedValue = colorRedUpdate ? coerceNumberSafe(colorRedUpdate.val) : coerceNumberSafe(comp.rgb[0]);
				const colorGreenValue = colorGreenUpdate
					? coerceNumberSafe(colorGreenUpdate.val)
					: coerceNumberSafe(comp.rgb[1]);
				const colorBlueValue = colorBlueUpdate ? coerceNumberSafe(colorBlueUpdate.val) : coerceNumberSafe(comp.rgb[2]);

				if (
					outputValue === null ||
					typeof outputValue !== 'boolean' ||
					brightnessValue === null ||
					Number.isNaN(brightnessValue) ||
					colorRedValue === null ||
					Number.isNaN(colorRedValue) ||
					colorGreenValue === null ||
					Number.isNaN(colorGreenValue) ||
					colorBlueValue === null ||
					Number.isNaN(colorBlueValue)
				) {
					this.logger.warn(`Dropping invalid batch update for ${comp.key} (channel=${rgb.id})`);

					return;
				}

				await comp.set(outputValue, Math.round(clampNumber(brightnessValue, 0, 100)), [
					Math.round(clampNumber(colorRedValue, 0, 255)),
					Math.round(clampNumber(colorGreenValue, 0, 255)),
					Math.round(clampNumber(colorBlueValue, 0, 255)),
				]);

				return true;
			});
		}

		for (const comp of delegate.rgbw.values()) {
			const rgbw = await this.channelsService.findOneBy<ShellyNgChannelEntity>(
				'identifier',
				`rgbw:${comp.id}`,
				device.id,
				DEVICES_SHELLY_NG_TYPE,
			);

			if (rgbw === null) {
				throw new DevicesShellyNgNotFoundException('Failed to load rgbw channel');
			}

			const rgbwOn = await this.channelsPropertiesService.findOneBy<ShellyNgChannelPropertyEntity>(
				'identifier',
				'output',
				rgbw.id,
			);

			if (rgbwOn === null) {
				throw new DevicesShellyNgNotFoundException('Failed to load rgbw on channel property');
			}

			await this.setDefaultPropertyValue(device.id, rgbwOn, comp.output);

			this.changeHandlers.set(`${delegate.id}|${comp.key}|output`, (val: CharacteristicValue): void => {
				this.handleChange(rgbwOn, coerceBooleanSafe(val)).catch((err: Error): void => {
					this.logger.error(
						`Failed to set value for component=${comp.key} attribute=output and property=${rgbwOn.id}`,
						{
							resource: device.id,
							message: err.message,
							stack: err.stack,
						},
					);
				});
			});

			this.setPropertiesHandlers.set(
				`${delegate.id}|${rgbwOn.id}`,
				async (val: string | number | boolean): Promise<boolean> => {
					if (typeof val !== 'boolean') {
						return false;
					}

					await comp.set(val);

					return true;
				},
			);

			if (typeof comp.brightness !== 'undefined') {
				const brightness = await this.channelsPropertiesService.findOneBy<ShellyNgChannelPropertyEntity>(
					'identifier',
					'brightness',
					rgbw.id,
				);

				if (brightness === null) {
					throw new DevicesShellyNgNotFoundException('Failed to load rgbw brightness channel property');
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

				this.setPropertiesHandlers.set(
					`${delegate.id}|${brightness.id}`,
					async (val: string | number | boolean): Promise<boolean> => {
						const n = coerceNumberSafe(val);

						if (n === null || Number.isNaN(n)) {
							this.logger.warn(
								`Dropping invalid numeric update for ${comp.key}.brightness -> ${String(val)} (property=${brightness.id})`,
							);

							return;
						}

						await comp.set(true, Math.round(clampNumber(n, 0, 100)));

						return true;
					},
				);
			}

			if (typeof comp.rgb !== 'undefined') {
				const colorRed = await this.channelsPropertiesService.findOneBy<ShellyNgChannelPropertyEntity>(
					'identifier',
					'rgb:red',
					rgbw.id,
				);
				const colorGreen = await this.channelsPropertiesService.findOneBy<ShellyNgChannelPropertyEntity>(
					'identifier',
					'rgb:green',
					rgbw.id,
				);
				const colorBlue = await this.channelsPropertiesService.findOneBy<ShellyNgChannelPropertyEntity>(
					'identifier',
					'rgb:blue',
					rgbw.id,
				);

				if (colorRed === null || colorGreen === null || colorBlue === null) {
					throw new DevicesShellyNgNotFoundException('Failed to load rgbw color channels properties');
				}

				await this.setDefaultPropertyValue(device.id, colorRed, clampNumber(comp.rgb[0], 0, 255));
				await this.setDefaultPropertyValue(device.id, colorGreen, clampNumber(comp.rgb[1], 0, 255));
				await this.setDefaultPropertyValue(device.id, colorBlue, clampNumber(comp.rgb[2], 0, 255));

				this.changeHandlers.set(`${delegate.id}|${comp.key}|rgb`, (val: CharacteristicValue): void => {
					this.handleNumericChange(
						comp.key,
						'rgb:red',
						colorRed.id,
						val[0],
						(n) => this.handleChange(colorRed, n, false),
						{ clamp: { min: 0, max: 255 } },
					);
					this.handleNumericChange(
						comp.key,
						'rgb:green',
						colorGreen.id,
						val[1],
						(n) => this.handleChange(colorGreen, n, false),
						{ clamp: { min: 0, max: 255 } },
					);
					this.handleNumericChange(
						comp.key,
						'rgb:blue',
						colorBlue.id,
						val[2],
						(n) => this.handleChange(colorBlue, n, false),
						{ clamp: { min: 0, max: 255 } },
					);
				});

				this.setPropertiesHandlers.set(
					`${delegate.id}|${colorRed.id}`,
					async (val: string | number | boolean): Promise<boolean> => {
						const n = coerceNumberSafe(val);

						if (n === null || Number.isNaN(n)) {
							this.logger.warn(
								`Dropping invalid numeric update for ${comp.key}.rgb:red -> ${String(val)} (property=${colorRed.id})`,
							);

							return;
						}

						await comp.set(true, comp.brightness, [Math.round(clampNumber(n, 0, 255)), comp.rgb[1], comp.rgb[2]]);

						return true;
					},
				);

				this.setPropertiesHandlers.set(
					`${delegate.id}|${colorGreen.id}`,
					async (val: string | number | boolean): Promise<boolean> => {
						const n = coerceNumberSafe(val);

						if (n === null || Number.isNaN(n)) {
							this.logger.warn(
								`Dropping invalid numeric update for ${comp.key}.rgb:green -> ${String(val)} (property=${colorGreen.id})`,
							);

							return;
						}

						await comp.set(true, comp.brightness, [comp.rgb[0], Math.round(clampNumber(n, 0, 255)), comp.rgb[2]]);

						return true;
					},
				);

				this.setPropertiesHandlers.set(
					`${delegate.id}|${colorBlue.id}`,
					async (val: string | number | boolean): Promise<boolean> => {
						const n = coerceNumberSafe(val);

						if (n === null || Number.isNaN(n)) {
							this.logger.warn(
								`Dropping invalid numeric update for ${comp.key}.rgb:blue -> ${String(val)} (property=${colorBlue.id})`,
							);

							return;
						}

						await comp.set(true, comp.brightness, [comp.rgb[0], comp.rgb[1], Math.round(clampNumber(n, 0, 255))]);

						return true;
					},
				);
			}

			if (typeof comp.white !== 'undefined') {
				const white = await this.channelsPropertiesService.findOneBy<ShellyNgChannelPropertyEntity>(
					'identifier',
					'white',
					rgbw.id,
				);

				if (white === null) {
					throw new DevicesShellyNgNotFoundException('Failed to load rgbw white channel property');
				}

				await this.setDefaultPropertyValue(device.id, white, clampNumber(comp.white, 0, 255));

				this.changeHandlers.set(`${delegate.id}|${comp.key}|white`, (val: CharacteristicValue): void => {
					this.handleNumericChange(comp.key, 'white', white.id, val, (n) => this.handleChange(white, n, false), {
						clamp: { min: 0, max: 255 },
					});
				});

				this.setPropertiesHandlers.set(
					`${delegate.id}|${white.id}`,
					async (val: string | number | boolean): Promise<boolean> => {
						const n = coerceNumberSafe(val);

						if (n === null || Number.isNaN(n)) {
							this.logger.warn(
								`Dropping invalid numeric update for ${comp.key}.white -> ${String(val)} (property=${white.id})`,
							);

							return;
						}

						await comp.set(true, Math.round(clampNumber(n, 0, 255)));

						return true;
					},
				);
			}

			this.setChannelsHandlers.set(`${delegate.id}|${rgbw.id}`, async (updates: BatchUpdate[]): Promise<boolean> => {
				const outputUpdate = updates.find((u) => u.property.identifier === 'output');
				const brightnessUpdate = updates.find((u) => u.property.identifier === 'brightness');
				const colorRedUpdate = updates.find((u) => u.property.identifier === 'rgb:red');
				const colorGreenUpdate = updates.find((u) => u.property.identifier === 'rgb:green');
				const colorBlueUpdate = updates.find((u) => u.property.identifier === 'rgb:blue');
				const whiteUpdate = updates.find((u) => u.property.identifier === 'white');

				// If brightness, color, or white is being set, default to turning on unless explicitly set to false
				const hasBrightnessOrColorUpdate =
					brightnessUpdate || colorRedUpdate || colorGreenUpdate || colorBlueUpdate || whiteUpdate;
				const outputValue = outputUpdate
					? coerceBooleanSafe(outputUpdate.val)
					: hasBrightnessOrColorUpdate
						? true
						: coerceBooleanSafe(comp.output);
				const brightnessValue = brightnessUpdate
					? coerceNumberSafe(brightnessUpdate.val)
					: coerceNumberSafe(comp.brightness);
				const colorRedValue = colorRedUpdate ? coerceNumberSafe(colorRedUpdate.val) : coerceNumberSafe(comp.rgb[0]);
				const colorGreenValue = colorGreenUpdate
					? coerceNumberSafe(colorGreenUpdate.val)
					: coerceNumberSafe(comp.rgb[1]);
				const colorBlueValue = colorBlueUpdate ? coerceNumberSafe(colorBlueUpdate.val) : coerceNumberSafe(comp.rgb[2]);
				const whiteValue = whiteUpdate ? coerceNumberSafe(whiteUpdate.val) : coerceNumberSafe(comp.white);

				if (
					outputValue === null ||
					typeof outputValue !== 'boolean' ||
					brightnessValue === null ||
					Number.isNaN(brightnessValue) ||
					colorRedValue === null ||
					Number.isNaN(colorRedValue) ||
					colorGreenValue === null ||
					Number.isNaN(colorGreenValue) ||
					colorBlueValue === null ||
					Number.isNaN(colorBlueValue) ||
					whiteValue === null ||
					Number.isNaN(whiteValue)
				) {
					this.logger.warn(`Dropping invalid batch update for ${comp.key} (channel=${rgbw.id})`);

					return;
				}

				await comp.set(
					outputValue,
					Math.round(clampNumber(brightnessValue, 0, 100)),
					[
						Math.round(clampNumber(colorRedValue, 0, 255)),
						Math.round(clampNumber(colorGreenValue, 0, 255)),
						Math.round(clampNumber(colorBlueValue, 0, 255)),
					],
					Math.round(clampNumber(whiteValue, 0, 255)),
				);

				return true;
			});
		}

		for (const comp of delegate.cct.values()) {
			const cct = await this.channelsService.findOneBy<ShellyNgChannelEntity>(
				'identifier',
				`cct:${comp.id}`,
				device.id,
				DEVICES_SHELLY_NG_TYPE,
			);

			if (cct === null) {
				throw new DevicesShellyNgNotFoundException('Failed to load cct channel');
			}

			const cctOn = await this.channelsPropertiesService.findOneBy<ShellyNgChannelPropertyEntity>(
				'identifier',
				'output',
				cct.id,
			);

			if (cctOn === null) {
				throw new DevicesShellyNgNotFoundException('Failed to load cct on channel property');
			}

			await this.setDefaultPropertyValue(device.id, cctOn, comp.output);

			this.changeHandlers.set(`${delegate.id}|${comp.key}|output`, (val: CharacteristicValue): void => {
				this.handleChange(cctOn, coerceBooleanSafe(val)).catch((err: Error): void => {
					this.logger.error(`Failed to set value for component=${comp.key} attribute=output and property=${cctOn.id}`, {
						resource: device.id,
						message: err.message,
						stack: err.stack,
					});
				});
			});

			this.setPropertiesHandlers.set(
				`${delegate.id}|${cctOn.id}`,
				async (val: string | number | boolean): Promise<boolean> => {
					if (typeof val !== 'boolean') {
						return false;
					}

					await comp.set(val);

					return true;
				},
			);

			if (typeof comp.brightness !== 'undefined') {
				const brightness = await this.channelsPropertiesService.findOneBy<ShellyNgChannelPropertyEntity>(
					'identifier',
					'brightness',
					cct.id,
				);

				if (brightness === null) {
					throw new DevicesShellyNgNotFoundException('Failed to load cct brightness channel property');
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

				this.setPropertiesHandlers.set(
					`${delegate.id}|${brightness.id}`,
					async (val: string | number | boolean): Promise<boolean> => {
						const n = coerceNumberSafe(val);

						if (n === null || Number.isNaN(n)) {
							this.logger.warn(
								`Dropping invalid numeric update for ${comp.key}.brightness -> ${String(val)} (property=${brightness.id})`,
							);

							return;
						}

						await comp.set(true, Math.round(clampNumber(n, 0, 100)));

						return true;
					},
				);
			}

			if (typeof comp.ct !== 'undefined') {
				const ct = await this.channelsPropertiesService.findOneBy<ShellyNgChannelPropertyEntity>(
					'identifier',
					'temperature',
					cct.id,
				);

				if (ct === null) {
					throw new DevicesShellyNgNotFoundException('Failed to load cct ct channel property');
				}

				await this.setDefaultPropertyValue(device.id, ct, clampNumber(comp.ct, 2_700, 6_500));

				this.changeHandlers.set(`${delegate.id}|${comp.key}|ct`, (val: CharacteristicValue): void => {
					this.handleNumericChange(comp.key, 'ct', ct.id, val, (n) => this.handleChange(ct, n, false), {
						clamp: { min: 0, max: 100 },
					});
				});

				this.setPropertiesHandlers.set(
					`${delegate.id}|${ct.id}`,
					async (val: string | number | boolean): Promise<boolean> => {
						const n = coerceNumberSafe(val);

						if (n === null || Number.isNaN(n)) {
							this.logger.warn(
								`Dropping invalid numeric update for ${comp.key}.ct -> ${String(val)} (property=${ct.id})`,
							);

							return;
						}

						await comp.set(true, Math.round(clampNumber(n, 2_700, 6_500)));

						return true;
					},
				);
			}

			this.setChannelsHandlers.set(`${delegate.id}|${cct.id}`, async (updates: BatchUpdate[]): Promise<boolean> => {
				const outputUpdate = updates.find((u) => u.property.identifier === 'output');
				const brightnessUpdate = updates.find((u) => u.property.identifier === 'brightness');
				const ctUpdate = updates.find((u) => u.property.identifier === 'temperature');

				// If brightness or color temperature is being set, default to turning on unless explicitly set to false
				const hasBrightnessOrCtUpdate = brightnessUpdate || ctUpdate;
				const outputValue = outputUpdate
					? coerceBooleanSafe(outputUpdate.val)
					: hasBrightnessOrCtUpdate
						? true
						: comp.output;
				const brightnessValue = brightnessUpdate ? coerceNumberSafe(brightnessUpdate.val) : comp.brightness;
				const ctValue = ctUpdate ? coerceNumberSafe(ctUpdate.val) : comp.ct;

				if (
					outputValue === null ||
					typeof outputValue !== 'boolean' ||
					brightnessValue === null ||
					Number.isNaN(brightnessValue) ||
					ctValue === null ||
					Number.isNaN(ctValue)
				) {
					this.logger.warn(`Dropping invalid batch update for ${comp.key} (channel=${cct.id})`);

					return;
				}

				await comp.set(outputValue, Math.round(clampNumber(brightnessValue, 0, 100)), Math.round(clampNumber(ctValue, 2_700, 6_500)));

				return true;
			});
		}

		for (const comp of delegate.humidity.values()) {
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

		for (const comp of delegate.temperature.values()) {
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

		for (const comp of delegate.pm1.values()) {
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

				this.logger.error(`Shelly handler error for component=${compKey} attribute=${attr}`, {
					resource: device.id,
					message: err.message,
					stack: err.stack,
				});
			}
		};

		delegate.on('value', valueHandler);

		this.delegateValueHandlers.set(delegate.id, valueHandler);

		const connectionHandler = (state: boolean | null): void => {
			this.deviceConnectivityService
				.setConnectionState(device.id, {
					state:
						state === null ? ConnectionState.UNKNOWN : state ? ConnectionState.CONNECTED : ConnectionState.DISCONNECTED,
				})
				.then((): void => {
					if (state) {
						// Intentionally empty - device connected
					} else {
						// Intentionally empty - device disconnected
					}
				})
				.catch((err: Error) => {
					this.logger.error(
						`Failed to set state=${state ? ConnectionState.CONNECTED : ConnectionState.DISCONNECTED} for device=${delegate.id}`,
						{
							resource: device.id,
							message: err.message,
							stack: err.stack,
						},
					);
				});
		};

		delegate.on('connected', connectionHandler);

		this.delegateConnectionHandlers.set(delegate.id, connectionHandler);

		connectionHandler(true);

		this.logger.log(`Attached Shelly device=${delegate.id}`, { resource: device.id });

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

		for (const key of Array.from(this.setPropertiesHandlers.keys())) {
			if (key.startsWith(`${deviceId}|`)) {
				this.setPropertiesHandlers.delete(key);
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

		this.logger.log(`Detached Shelly device=${deviceId}`, { resource: deviceId });
	}

	async setChannelValue(
		device: ShellyNgDeviceEntity,
		channel: ShellyNgChannelEntity,
		updates: { property: ShellyNgChannelPropertyEntity; value: string | number | boolean }[],
	): Promise<boolean> {
		const handler = this.setChannelsHandlers.get(`${device.identifier}|${channel.id}`);

		if (!handler) {
			return Promise.reject(
				new DevicesShellyNgNotImplementedException('Multiple property writes are not supported by the component.'),
			);
		}

		return handler(updates.map((row): BatchUpdate => ({ property: row.property, val: row.value })));
	}

	async setPropertyValue(
		device: ShellyNgDeviceEntity,
		property: ShellyNgChannelPropertyEntity,
		value: string | number | boolean,
	): Promise<boolean> {
		const handler = this.setPropertiesHandlers.get(`${device.identifier}|${property.id}`);

		if (!handler) {
			this.logger.warn(
				`Trying to write to device=${device.identifier} to not writable property=${property.id} value=${value}`,
				{ resource: device.id },
			);

			return Promise.resolve(false);
		}

		return handler(value);
	}

	private async handleChange(
		property: ShellyNgChannelPropertyEntity,
		value: string | number | boolean,
		immediately = true,
	): Promise<void> {
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
		} else if (delegate.lights.size > 0 || delegate.rgb.size > 0 || delegate.rgbw.size > 0 || delegate.cct.size > 0) {
			return DeviceCategory.LIGHTING;
		} else if (delegate.switches.size > 0) {
			return DeviceCategory.SWITCHER;
		} else if (
			delegate.inputs.size > 0 ||
			delegate.temperature.size > 0 ||
			delegate.humidity.size > 0 ||
			delegate.pm1.size > 0
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
				`Dropping invalid numeric update for ${compKey}.${attr} -> ${safeToString(val)} (property=${propertyId})`,
			);

			return;
		}

		void write(n).catch((err: Error) => {
			// Note: We don't have direct device.id access here in this private helper method
			this.logger.error(`Failed to set value for component=${compKey} attribute=${attr} property=${propertyId}`, {
				message: err.message,
				stack: err.stack,
			});
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
					`Failed to process scheduled write of value=${safeToString(value)} to property=${property.id}`,
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
		this.setPropertiesHandlers.clear();
		this.propertiesMap.clear();

		for (const pendingWrite of this.pendingWrites.values()) {
			clearTimeout(pendingWrite);
		}

		this.pendingWrites.clear();
	}

	destroy(): void {
		this.detach();
	}
}
