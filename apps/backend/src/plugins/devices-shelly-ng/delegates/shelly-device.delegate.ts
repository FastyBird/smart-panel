import {
	Cct,
	CharacteristicValue,
	Cover,
	Device,
	DevicePower,
	Humidity,
	Input,
	Light,
	MultiProfileDevice,
	Pm1,
	Rgb,
	Rgbw,
	Switch,
	Temperature,
} from 'shellies-ds9';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import {
	ComponentType,
	DESCRIPTORS,
	DEVICES_SHELLY_NG_PLUGIN_NAME,
	DeviceProfile,
} from '../devices-shelly-ng.constants';
import { DevicesShellyNgException } from '../devices-shelly-ng.exceptions';

type SupportedComponent =
	| Switch
	| Light
	| Rgb
	| Rgbw
	| Cct
	| Cover
	| Input
	| DevicePower
	| Humidity
	| Temperature
	| Pm1;

export class ShellyDeviceDelegate extends EventEmitter2 {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_SHELLY_NG_PLUGIN_NAME,
		'ShellyDeviceDelegate',
	);

	public connected: boolean = false;

	public components: Map<string, SupportedComponent> = new Map();

	public switches: Map<number, Switch> = new Map();

	public lights: Map<number, Light> = new Map();

	public rgb: Map<number, Rgb> = new Map();

	public rgbw: Map<number, Rgbw> = new Map();

	public cct: Map<number, Cct> = new Map();

	public covers: Map<number, Cover> = new Map();

	public inputs: Map<number, Input> = new Map();

	public devPwr: Map<number, DevicePower> = new Map();

	public humidity: Map<number, Humidity> = new Map();

	public temperature: Map<number, Temperature> = new Map();

	public pm1: Map<number, Pm1> = new Map();

	private changeHandlers: Map<string, (char: string, val: CharacteristicValue) => void> = new Map();

	constructor(private shelly: Device) {
		super();

		let isKnown = false;

		Object.values(DESCRIPTORS).forEach((DESCRIPTOR): void => {
			if (DESCRIPTOR.models.includes(this.shelly.model.toUpperCase())) {
				isKnown = true;

				this.connected = this.shelly.rpcHandler.connected;

				this.shelly.rpcHandler
					.on('connect', this.handleConnect)
					.on('disconnect', this.handleDisconnect)
					.on('request', this.handleRequest);

				DESCRIPTOR.components.forEach((componentSpec): void => {
					for (const id of componentSpec.ids) {
						const componentKey = `${componentSpec.type}:${id}`;

						if (!this.shelly.hasComponent(componentKey)) {
							continue;
						}

						const component = this.shelly.getComponent(componentKey);

						if (typeof component === 'undefined') {
							throw new Error(`Missing component ${componentKey}`);
						}

						if (!(component instanceof componentSpec.cls)) {
							this.logger.warn(
								`Component key=${componentKey} for device=${this.shelly.id} is not instance of expected class`,
							);

							continue;
						}

						if (componentSpec.type === ComponentType.SWITCH) {
							if (this.shelly instanceof MultiProfileDevice && this.shelly.profile !== String(DeviceProfile.SWITCH)) {
								continue;
							}

							this.switches.set(id, component as unknown as Switch);
						} else if (componentSpec.type === ComponentType.COVER) {
							if (this.shelly instanceof MultiProfileDevice && this.shelly.profile !== String(DeviceProfile.COVER)) {
								continue;
							}

							this.covers.set(id, component as unknown as Cover);
						} else if (componentSpec.type === ComponentType.LIGHT) {
							if (
								this.shelly instanceof MultiProfileDevice &&
								this.shelly.profile !== String(DeviceProfile.LIGHT) &&
								this.shelly.profile !== String(DeviceProfile.RGB_X2_LIGHT)
							) {
								continue;
							}

							this.lights.set(id, component as unknown as Light);
						} else if (componentSpec.type === ComponentType.RGB) {
							if (
								this.shelly instanceof MultiProfileDevice &&
								this.shelly.profile !== String(DeviceProfile.RGB) &&
								this.shelly.profile !== String(DeviceProfile.RGB_CCT) &&
								this.shelly.profile !== String(DeviceProfile.RGB_X2_LIGHT)
							) {
								continue;
							}

							this.rgb.set(id, component as unknown as Rgb);
						} else if (componentSpec.type === ComponentType.RGBW) {
							if (this.shelly instanceof MultiProfileDevice && this.shelly.profile !== String(DeviceProfile.RGBW)) {
								continue;
							}

							this.rgbw.set(id, component as unknown as Rgbw);
						} else if (componentSpec.type === ComponentType.CCT) {
							if (
								this.shelly instanceof MultiProfileDevice &&
								this.shelly.profile !== String(DeviceProfile.RGB_CCT) &&
								this.shelly.profile !== String(DeviceProfile.CCT_X2)
							) {
								continue;
							}

							this.cct.set(id, component as unknown as Cct);
						} else if (componentSpec.type === ComponentType.PM1) {
							this.pm1.set(id, component as unknown as Pm1);
						} else if (componentSpec.type === ComponentType.INPUT) {
							this.inputs.set(id, component as unknown as Input);
						} else if (componentSpec.type === ComponentType.DEVICE_POWER) {
							this.devPwr.set(id, component as unknown as DevicePower);
						} else if (componentSpec.type === ComponentType.HUMIDITY) {
							this.humidity.set(id, component as unknown as Humidity);
						} else if (componentSpec.type === ComponentType.TEMPERATURE) {
							this.temperature.set(id, component as unknown as Temperature);
						}

						this.components.set(componentKey, component);

						const handler = (char: string, val: CharacteristicValue): void =>
							this.handleChange(componentKey, char, val);

						this.changeHandlers.set(componentKey, handler);

						component.on('change', handler);

						this.components.set(componentKey, component);
					}
				});

				return;
			}
		});

		if (!isKnown) {
			throw new DevicesShellyNgException('Device is not supported.');
		}
	}

	public get id(): string {
		return this.shelly.id;
	}

	private handleConnect = (): void => {
		this.logger.log(`Device=${this.shelly.id} connected`, { resource: this.shelly.id });

		this.connected = true;

		this.emit('connected', true);
	};

	private handleDisconnect = (code: number, reason: string, reconnectIn: number | null): void => {
		const details = reason.length > 0 ? 'reason: ' + reason : 'code: ' + code;

		if (this.connected) {
			this.logger.warn(`Device=${this.shelly.id} disconnected, ${details}`, { resource: this.shelly.id });
		} else {
			this.logger.warn(`Connection with device=${this.shelly.id} failed, ${details}`, { resource: this.shelly.id });
		}

		if (reconnectIn !== null) {
			let msg = `Reconnecting with device=${this.shelly.id} in `;

			if (reconnectIn < 60 * 1000) {
				msg += Math.floor(reconnectIn / 1000) + ' second(s)';
			} else if (reconnectIn < 60 * 60 * 1000) {
				msg += Math.floor(reconnectIn / (60 * 1000)) + ' minute(s)';
			} else {
				msg += Math.floor(reconnectIn / (60 * 60 * 1000)) + ' hour(s)';
			}

			this.logger.log(msg, { resource: this.shelly.id });
		}

		this.connected = false;

		this.emit('connected', false);
	};

	private handleRequest = (_method: string): void => {
		// Intentionally empty
	};

	private handleChange = (compKey: string, char: string, val: CharacteristicValue): void => {
		this.emit('value', compKey, char, val);
	};

	detach(): void {
		this.shelly.rpcHandler
			.off('connect', this.handleConnect)
			.off('disconnect', this.handleDisconnect)
			.off('request', this.handleRequest);

		for (const [componentKey, component] of this.components.entries()) {
			const handler = this.changeHandlers.get(componentKey);

			if (handler) {
				component.off('change', handler);
			}
		}

		this.changeHandlers.clear();
	}

	destroy(): void {
		this.detach();
	}
}
