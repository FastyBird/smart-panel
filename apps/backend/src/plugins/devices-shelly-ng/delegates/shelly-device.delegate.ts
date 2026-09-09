import {
	Cct,
	CharacteristicValue,
	Cover,
	Device,
	DevicePower,
	Em,
	Em1,
	Em1Data,
	EmData,
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
	DeviceDescriptor,
	DeviceProfile,
} from '../devices-shelly-ng.constants';
import { DevicesShellyNgException } from '../devices-shelly-ng.exceptions';
import { emitFlattenedValue } from '../utils/transform.utils';

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
	| Pm1
	| Em
	| EmData
	| Em1
	| Em1Data;

export type ShellyValueOrigin = 'notify' | 'poll';

export class ShellyDeviceDelegate extends EventEmitter2 {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_SHELLY_NG_PLUGIN_NAME,
		'ShellyDeviceDelegate',
	);

	public connected: boolean = false;
	public disconnectedAt: number | null = null;

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

	public em: Map<number, Em> = new Map();

	public emData: Map<number, EmData> = new Map();

	public em1: Map<number, Em1> = new Map();

	public em1Data: Map<number, Em1Data> = new Map();

	/**
	 * The descriptor that matched this device's model. Stored on construction so callers
	 * (e.g. `DelegatesManagerService.determineCategory`) can read the canonical category
	 * list directly instead of inferring from which component maps the lib happened to
	 * populate — for sensor-only devices like the PM Mini Gen3, the lib may not expose a
	 * component the heuristic checks against, falling through to `GENERIC`.
	 */
	public readonly descriptor: DeviceDescriptor | null;

	private changeHandlers: Map<string, (char: string, val: CharacteristicValue) => void> = new Map();

	/**
	 * Native status notifications and an HTTP poll both update components synchronously.  Keep
	 * the origin in this tiny synchronous window; it must never span the RPC await.
	 */
	private applyingPollComponent: string | null = null;

	/**
	 * A notification revision is captured before an HTTP poll starts.  A component which
	 * receives a notification while that request is in flight must not be overwritten by the
	 * older poll response.
	 */
	private readonly notificationRevisions: Map<string, number> = new Map();

	constructor(private shelly: Device) {
		super();

		let isKnown = false;
		let matchedDescriptor: DeviceDescriptor | null = null;

		Object.values(DESCRIPTORS).forEach((DESCRIPTOR): void => {
			if (DESCRIPTOR.models.includes(this.shelly.model.toUpperCase())) {
				isKnown = true;
				matchedDescriptor = DESCRIPTOR;

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
						} else if (componentSpec.type === ComponentType.EM) {
							this.em.set(id, component as unknown as Em);
						} else if (componentSpec.type === ComponentType.EM_DATA) {
							this.emData.set(id, component as unknown as EmData);
						} else if (componentSpec.type === ComponentType.EM1) {
							this.em1.set(id, component as unknown as Em1);
						} else if (componentSpec.type === ComponentType.EM1_DATA) {
							this.em1Data.set(id, component as unknown as Em1Data);
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

		this.descriptor = matchedDescriptor;
	}

	public get id(): string {
		return this.shelly.id;
	}

	/**
	 * Returns whether the underlying WebSocket reports itself as connected.
	 */
	public get rpcConnected(): boolean {
		return this.shelly.rpcHandler.connected;
	}

	/**
	 * Sends a lightweight RPC request (Shelly.GetDeviceInfo) to verify the device
	 * is actually responsive. Resolves to true if the device responds, false otherwise.
	 */
	async ping(timeoutMs: number = 5_000): Promise<boolean> {
		return (await this.rpcWithTimeout(() => this.shelly.rpcHandler.request('Shelly.GetDeviceInfo'), timeoutMs)).ok;
	}

	/**
	 * Polls the device with the public Shelly.GetStatus API.  The library's loadStatus()
	 * cannot distinguish a poll update from a concurrent WebSocket notification, so apply the
	 * response ourselves in a synchronous poll-only context after the bounded RPC completes.
	 */
	async pollStatus(timeoutMs: number = 10_000, isCurrent: () => boolean = () => true): Promise<boolean> {
		if (!this.shelly.rpcHandler.connected) {
			return false;
		}

		const revisionsAtStart = new Map(this.notificationRevisions);
		const result = await this.rpcWithTimeout(() => this.shelly.shelly.getStatus(), timeoutMs);

		if (!result.ok || !isCurrent()) {
			return false;
		}

		for (const [componentKey, values] of Object.entries(result.value)) {
			if (!isCurrent() || typeof values !== 'object' || values === null) {
				continue;
			}

			const componentValues = values as unknown as Record<string, unknown>;

			// A newer notification is authoritative for the whole component.  Do not mutate
			// the cached component and merely suppress its event afterwards: that would leave
			// the next notification comparing against stale state.
			if ((this.notificationRevisions.get(componentKey) ?? 0) !== (revisionsAtStart.get(componentKey) ?? 0)) {
				continue;
			}

			const component = this.shelly.getComponent(componentKey);

			if (!component) {
				continue;
			}

			this.applyingPollComponent = componentKey;

			try {
				component.update(componentValues);
			} finally {
				this.applyingPollComponent = null;
			}
		}

		return true;
	}

	/**
	 * Runs a lazily-created promise with a timeout guard. The factory is only
	 * called after the connected check, avoiding orphaned in-flight promises.
	 */
	private async rpcWithTimeout<T>(
		factory: () => PromiseLike<T>,
		timeoutMs: number,
	): Promise<{ ok: true; value: T } | { ok: false }> {
		if (!this.shelly.rpcHandler.connected) {
			return { ok: false };
		}

		let timer: NodeJS.Timeout | undefined;

		try {
			const value = await Promise.race([
				factory(),
				new Promise<never>((_, reject) => {
					timer = setTimeout(() => reject(new Error('RPC timeout')), timeoutMs);
				}),
			]);

			return { ok: true, value };
		} catch {
			return { ok: false };
		} finally {
			if (timer) {
				clearTimeout(timer);
			}
		}
	}

	/**
	 * Triggers an immediate reconnection attempt via the library's public API.
	 * Resets backoff and terminates the current socket.
	 */
	forceReconnect(): void {
		this.logger.warn(`Forcing reconnection for device=${this.shelly.id}`, { resource: this.shelly.id });

		const handler = this.shelly.rpcHandler as unknown as { reconnect?: () => void };

		if (handler.reconnect) {
			handler.reconnect();
		}
	}

	private handleConnect = (): void => {
		this.logger.log(`Device=${this.shelly.id} connected`, { resource: this.shelly.id });

		this.connected = true;
		this.disconnectedAt = null;

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
		this.disconnectedAt = Date.now();

		this.emit('connected', false);
	};

	private handleRequest = (_method: string): void => {
		// Intentionally empty
	};

	private handleChange = (compKey: string, char: string, val: CharacteristicValue): void => {
		const origin: ShellyValueOrigin = this.applyingPollComponent === compKey ? 'poll' : 'notify';

		if (origin === 'notify') {
			this.notificationRevisions.set(compKey, (this.notificationRevisions.get(compKey) ?? 0) + 1);
		}

		// Flatten object characteristics (e.g. `aenergy: { total, ... }`, `battery: { percent, ... }`)
		// so handlers keyed on a leaf attribute (e.g. `aenergy.total`, `battery.percent`) receive the
		// unwrapped scalar, matching the shape ShellyWsServerService emits for sleeping devices.
		emitFlattenedValue(
			(event: string, ...args: unknown[]): boolean => this.emit(event, ...args, origin),
			compKey,
			char,
			val,
		);
	};

	/**
	 * Applies a raw NotifyStatus frame which did not pass through a library component.  It
	 * still advances the component revision so a concurrent poll cannot overwrite it.
	 */
	emitNotificationValue(compKey: string, char: string, val: unknown): void {
		this.notificationRevisions.set(compKey, (this.notificationRevisions.get(compKey) ?? 0) + 1);

		emitFlattenedValue(
			(event: string, ...args: unknown[]): boolean => this.emit(event, ...args, 'notify'),
			compKey,
			char,
			val,
		);
	}

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
