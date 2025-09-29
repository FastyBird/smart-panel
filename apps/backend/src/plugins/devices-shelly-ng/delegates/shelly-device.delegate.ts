import {
	CharacteristicValue,
	Cover,
	Device,
	DevicePower,
	Humidity,
	Input,
	Light,
	MultiProfileDevice,
	Pm1,
	Switch,
	Temperature,
} from 'shellies-ds9';

import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { ComponentType, DESCRIPTORS, DeviceProfile } from '../devices-shelly-ng.constants';
import { DevicesShellyNgException } from '../devices-shelly-ng.exceptions';

type SupportedComponent = Switch | Light | Cover | Input | DevicePower | Humidity | Temperature | Pm1;

export class ShellyDeviceDelegate extends EventEmitter2 {
	private readonly logger = new Logger(ShellyDeviceDelegate.name);

	public connected: boolean = false;

	public components: Map<string, SupportedComponent> = new Map();

	public switches: Map<number, Switch> = new Map();

	public lights: Map<number, Light> = new Map();

	public covers: Map<number, Cover> = new Map();

	public inputs: Map<number, Input> = new Map();

	public devPwr: Map<number, DevicePower> = new Map();

	public hums: Map<number, Humidity> = new Map();

	public temps: Map<number, Temperature> = new Map();

	public powerMeter: Map<number, Pm1> = new Map();

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

						if (this.shelly.hasComponent(componentKey)) {
							const component = this.shelly.getComponent(componentKey);

							if (typeof component === 'undefined') {
								throw new Error(`Missing component ${componentKey}`);
							}

							if (!(component instanceof componentSpec.cls)) {
								this.logger.warn(
									`[SHELLY NG][DEVICE DELEGATE] Component key=${componentKey} for device=${this.shelly.id} is not instance of expected class`,
								);

								continue;
							}

							if (componentSpec.type === ComponentType.SWITCH) {
								if (this.shelly instanceof MultiProfileDevice && this.shelly.profile === String(DeviceProfile.COVER)) {
									continue;
								}

								this.switches.set(id, component as unknown as Switch);
							} else if (componentSpec.type === ComponentType.LIGHT) {
								this.lights.set(id, component as unknown as Light);
							} else if (componentSpec.type === ComponentType.COVER) {
								if (this.shelly instanceof MultiProfileDevice && this.shelly.profile !== String(DeviceProfile.COVER)) {
									continue;
								}

								this.covers.set(id, component as unknown as Cover);
							} else if (componentSpec.type === ComponentType.PM) {
								this.powerMeter.set(id, component as unknown as Pm1);
							} else if (componentSpec.type === ComponentType.INPUT) {
								this.inputs.set(id, component as unknown as Input);
							} else if (componentSpec.type === ComponentType.DEVICE_POWER) {
								this.devPwr.set(id, component as unknown as DevicePower);
							} else if (componentSpec.type === ComponentType.HUMIDITY) {
								this.hums.set(id, component as unknown as Humidity);
							} else if (componentSpec.type === ComponentType.TEMPERATURE) {
								this.temps.set(id, component as unknown as Temperature);
							}

							this.components.set(componentKey, component);

							const handler = (char: string, val: CharacteristicValue): void =>
								this.handleChange(componentKey, char, val);

							this.changeHandlers.set(componentKey, handler);

							component.on('change', handler);

							this.components.set(componentKey, component);
						}
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
		this.logger.log(`[SHELLY NG][DEVICE DELEGATE] Device=${this.shelly.id} connected`);

		this.connected = true;

		this.emit('connected', true);
	};

	private handleDisconnect = (code: number, reason: string, reconnectIn: number | null): void => {
		const details = reason.length > 0 ? 'reason: ' + reason : 'code: ' + code;

		if (this.connected) {
			this.logger.warn(`[SHELLY NG][DEVICE DELEGATE] Device=${this.shelly.id} disconnected, ${details}`);
		} else {
			this.logger.warn(`[SHELLY NG][DEVICE DELEGATE] Connection with device=${this.shelly.id} failed, ${details}`);
		}

		if (reconnectIn !== null) {
			let msg = `[SHELLY NG][DEVICE DELEGATE] Reconnecting with device=${this.shelly.id} in `;

			if (reconnectIn < 60 * 1000) {
				msg += Math.floor(reconnectIn / 1000) + ' second(s)';
			} else if (reconnectIn < 60 * 60 * 1000) {
				msg += Math.floor(reconnectIn / (60 * 1000)) + ' minute(s)';
			} else {
				msg += Math.floor(reconnectIn / (60 * 60 * 1000)) + ' hour(s)';
			}

			this.logger.log(msg);
		}

		this.connected = false;

		this.emit('connected', false);
	};

	private handleRequest = (method: string): void => {
		this.logger.debug('[SHELLY NG][DEVICE DELEGATE] Received device event:', method);
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
