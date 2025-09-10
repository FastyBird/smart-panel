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
	ShellyGen32Pm,
	ShellyPlus1,
	ShellyPlus1Pm,
	ShellyPlus1PmUl,
	ShellyPlus1Ul,
	ShellyPlus2Pm,
	ShellyPlus2PmRev1,
	ShellyPlusPlugEu,
	ShellyPlusPlugIt,
	ShellyPlusPlugUk,
	ShellyPlusPlugUs,
	ShellyPlusPmMini,
	ShellyPlusPmMiniV3,
	ShellyPro1,
	ShellyPro1Pm,
	ShellyPro1PmRev1,
	ShellyPro1PmRev2,
	ShellyPro1Rev1,
	ShellyPro1Rev2,
	ShellyPro2,
	ShellyPro2Pm,
	ShellyPro2PmRev1,
	ShellyPro2PmRev2,
	ShellyPro2Rev1,
	ShellyPro2Rev2,
	ShellyPro3,
	ShellyPro4Pm,
	ShellyPro4PmV2,
	Switch,
	Temperature,
} from 'shellies-ds9';
import { ShellyPlusDimmer } from 'shellies-ds9/dist/devices/shelly-plus-dimmer';
import { ShellyPlusPMDimmer } from 'shellies-ds9/dist/devices/shelly-plus-dimmer-pm';
import {
	ShellyDimmer,
	ShellyProDimmer1Pm,
	ShellyProDimmer1Pm2,
} from 'shellies-ds9/dist/devices/shelly-pro-dimmer-1-pm';
import { ShellyProDimmer2Pm } from 'shellies-ds9/dist/devices/shelly-pro-dimmer-2-pm';
import { ShellyProDualCoverPm } from 'shellies-ds9/dist/devices/shelly-pro-dual-cover-pm';

import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

type SupportedComponent = Switch | Light | Cover | Input | DevicePower | Humidity | Temperature | Pm1;

type Ctor<T> = abstract new (...args: any[]) => T;

export type ComponentSpec =
	| { type: 'switch'; cls: Ctor<Switch>; ids: number[] }
	| { type: 'light'; cls: Ctor<Light>; ids: number[] }
	| { type: 'cover'; cls: Ctor<Cover>; ids: number[] }
	| { type: 'input'; cls: Ctor<Input>; ids: number[] }
	| { type: 'devicePower'; cls: Ctor<DevicePower>; ids: number[] }
	| { type: 'humidity'; cls: Ctor<Humidity>; ids: number[] }
	| { type: 'temperature'; cls: Ctor<Temperature>; ids: number[] }
	| { type: 'pm'; cls: Ctor<Pm1>; ids: number[] };

export interface DeviceDescriptor {
	models: string[];
	components: ComponentSpec[];
}

export const DESCRIPTORS: Record<string, DeviceDescriptor> = {
	SHELLYPLUS1: {
		models: [ShellyPlus1.model.toUpperCase(), ShellyPlus1Ul.model.toUpperCase()],
		components: [{ type: 'switch', cls: Switch, ids: [0] }],
	},
	SHELLYPLUS1PM: {
		models: [ShellyPlus1Pm.model.toUpperCase(), ShellyPlus1PmUl.model.toUpperCase()],
		components: [{ type: 'switch', cls: Switch, ids: [0] }],
	},
	SHELLYPLUS2PM: {
		models: [ShellyPlus2Pm.model.toUpperCase(), ShellyPlus2PmRev1.model.toUpperCase()],
		components: [
			{ type: 'switch', cls: Switch, ids: [0, 1] },
			{ type: 'cover', cls: Cover, ids: [0] },
		],
	},
	SHELLYGEN32PM: {
		models: [ShellyGen32Pm.model.toUpperCase()],
		components: [
			{ type: 'switch', cls: Switch, ids: [0, 1] },
			{ type: 'cover', cls: Cover, ids: [0] },
		],
	},
	SHELLYPRO1: {
		models: [ShellyPro1.model.toUpperCase(), ShellyPro1Rev1.model.toUpperCase(), ShellyPro1Rev2.model.toUpperCase()],
		components: [{ type: 'switch', cls: Switch, ids: [0] }],
	},
	SHELLYPRO1PM: {
		models: [
			ShellyPro1Pm.model.toUpperCase(),
			ShellyPro1PmRev1.model.toUpperCase(),
			ShellyPro1PmRev2.model.toUpperCase(),
		],
		components: [{ type: 'switch', cls: Switch, ids: [0] }],
	},
	SHELLYPRO2: {
		models: [ShellyPro2.model.toUpperCase(), ShellyPro2Rev1.model.toUpperCase(), ShellyPro2Rev2.model.toUpperCase()],
		components: [{ type: 'switch', cls: Switch, ids: [0, 1] }],
	},
	SHELLYPRO2PM: {
		models: [
			ShellyPro2Pm.model.toUpperCase(),
			ShellyPro2PmRev1.model.toUpperCase(),
			ShellyPro2PmRev2.model.toUpperCase(),
		],
		components: [
			{ type: 'switch', cls: Switch, ids: [0, 1] },
			{ type: 'cover', cls: Cover, ids: [0] },
		],
	},
	SHELLYPRO3: {
		models: [ShellyPro3.model.toUpperCase()],
		components: [{ type: 'switch', cls: Switch, ids: [0, 1, 2] }],
	},
	SHELLYPRO4PM: {
		models: [ShellyPro4Pm.model.toUpperCase(), ShellyPro4PmV2.model.toUpperCase()],
		components: [{ type: 'switch', cls: Switch, ids: [0, 1, 2] }],
	},
	SHELLYPLUSPLUG: {
		models: [
			ShellyPlusPlugUs.model.toUpperCase(),
			ShellyPlusPlugEu.model.toUpperCase(),
			ShellyPlusPlugUk.model.toUpperCase(),
			ShellyPlusPlugIt.model.toUpperCase(),
		],
		components: [{ type: 'switch', cls: Switch, ids: [0, 1, 2] }],
	},
	SHELLYPLUSPM: {
		models: [ShellyPlusPmMini.model.toUpperCase(), ShellyPlusPmMiniV3.model.toUpperCase()],
		components: [{ type: 'pm', cls: Pm1, ids: [1] }],
	},
	SHELLYPRODUALCOVERPM: {
		models: [ShellyProDualCoverPm.model.toUpperCase()],
		components: [{ type: 'cover', cls: Cover, ids: [0, 1] }],
	},
	SHELLYPRODIMMER1PM: {
		models: [
			ShellyProDimmer1Pm.model.toUpperCase(),
			ShellyProDimmer1Pm2.model.toUpperCase(),
			ShellyDimmer.model.toUpperCase(),
		],
		components: [{ type: 'light', cls: Light, ids: [0] }],
	},
	SHELLYPRODIMMER2PM: {
		models: [ShellyProDimmer2Pm.model.toUpperCase()],
		components: [{ type: 'light', cls: Light, ids: [0, 1] }],
	},
	SHELLYPLUSDIMMER: {
		models: [ShellyPlusDimmer.model.toUpperCase()],
		components: [{ type: 'light', cls: Light, ids: [0] }],
	},
	SHELLYPLUSDIMMERPM: {
		models: [ShellyPlusPMDimmer.model.toUpperCase()],
		components: [{ type: 'light', cls: Light, ids: [0] }],
	},
};

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

		this.connected = this.shelly.rpcHandler.connected;

		this.shelly.rpcHandler
			.on('connect', this.handleConnect)
			.on('disconnect', this.handleDisconnect)
			.on('request', this.handleRequest);

		Object.values(DESCRIPTORS).forEach((DESCRIPTOR): void => {
			if (DESCRIPTOR.models.includes(this.shelly.model.toUpperCase())) {
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

							if (componentSpec.type === 'switch') {
								if (this.shelly instanceof MultiProfileDevice && this.shelly.profile === 'cover') {
									continue;
								}

								this.switches.set(id, component as unknown as Switch);
							} else if (componentSpec.type === 'light') {
								this.lights.set(id, component as unknown as Light);
							} else if (componentSpec.type === 'cover') {
								if (this.shelly instanceof MultiProfileDevice && this.shelly.profile !== 'cover') {
									continue;
								}

								this.covers.set(id, component as unknown as Cover);
							} else if (componentSpec.type === 'input') {
								this.inputs.set(id, component as unknown as Input);
							} else if (componentSpec.type === 'devicePower') {
								this.devPwr.set(id, component as unknown as DevicePower);
							} else if (componentSpec.type === 'humidity') {
								this.hums.set(id, component as unknown as Humidity);
							} else if (componentSpec.type === 'temperature') {
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
			}
		});
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
