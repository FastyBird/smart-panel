import WebSocket from 'ws';

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { DEFAULT_COMMAND_DEBOUNCE_MS, DEFAULT_CONNECTION_TIMEOUT_MS } from '../devices-wled.constants';
import { WledConnectionException } from '../devices-wled.exceptions';
import {
	RegisteredWledDevice,
	WledAdapterEventType,
	WledDeviceContext,
	WledInfo,
	WledNightlightUpdate,
	WledSegment,
	WledState,
	WledStateUpdate,
	WledStateUpdateExtended,
	WledUdpSyncUpdate,
} from '../interfaces/wled.interface';

/**
 * Raw WLED API response for state
 */
interface WledApiState {
	on: boolean;
	bri: number;
	transition: number;
	ps: number;
	pl: number;
	nl: {
		on: boolean;
		dur: number;
		mode: number;
		tbri: number;
		rem: number;
	};
	udpn: {
		send: boolean;
		recv: boolean;
	};
	lor: number;
	mainseg: number;
	seg: WledApiSegment[];
}

/**
 * Raw WLED API response for segment
 */
interface WledApiSegment {
	id: number;
	start: number;
	stop: number;
	len: number;
	grp: number;
	spc: number;
	of: number;
	col: number[][];
	fx: number;
	sx: number;
	ix: number;
	pal: number;
	sel: boolean;
	rev: boolean;
	on: boolean;
	bri: number;
	mi: boolean;
}

/**
 * Raw WLED API response for info
 */
interface WledApiInfo {
	ver: string;
	vid: number;
	leds: {
		count: number;
		fps: number;
		pwr: number;
		maxpwr: number;
		maxseg: number;
	};
	name: string;
	udpport: number;
	live: boolean;
	lm: string;
	lip: string;
	ws: number;
	wifi: {
		bssid: string;
		rssi: number;
		channel: number;
	};
	fs: {
		u: number;
		t: number;
		pmt: number;
	};
	fxcount: number;
	palcount: number;
	uptime: number;
	arch: string;
	core: string;
	freeheap: number;
	brand: string;
	product: string;
	mac: string;
	ip: string;
}

/**
 * WLED Client Adapter Service
 *
 * Wraps communication with WLED devices via the HTTP JSON API.
 * Provides methods for reading state, setting state, and managing connections.
 */
@Injectable()
export class WledClientAdapterService {
	private readonly logger = new Logger(WledClientAdapterService.name);

	private readonly devices = new Map<string, RegisteredWledDevice>();
	private readonly debounceTimers = new Map<string, NodeJS.Timeout>();
	private readonly debounceResolvers = new Map<string, Array<(result: boolean) => void>>();
	private readonly debounceUpdates = new Map<string, WledStateUpdate>();
	private readonly websockets = new Map<string, WebSocket>();
	private readonly wsReconnectTimers = new Map<string, NodeJS.Timeout>();
	private wsReconnectInterval = 5000;
	private wsEnabled = false;

	constructor(private readonly eventEmitter: EventEmitter2) {}

	/**
	 * Configure WebSocket settings
	 */
	configureWebSocket(enabled: boolean, reconnectInterval: number = 5000): void {
		this.wsEnabled = enabled;
		this.wsReconnectInterval = reconnectInterval;
	}

	/**
	 * Connect to a WLED device and fetch its initial state
	 */
	async connect(host: string, identifier: string, timeout: number = DEFAULT_CONNECTION_TIMEOUT_MS): Promise<void> {
		this.logger.log(`[WLED][ADAPTER] Connecting to WLED device at ${host}`);

		try {
			// Fetch device context
			const context = await this.fetchDeviceContext(host, timeout);

			// Register the device
			const device: RegisteredWledDevice = {
				host,
				identifier,
				connected: true,
				enabled: true,
				context,
				lastSeen: new Date(),
			};

			this.devices.set(host, device);

			this.logger.log(`[WLED][ADAPTER] Successfully connected to WLED device at ${host} (${context.info.name})`);

			// Emit connected event
			this.eventEmitter.emit(WledAdapterEventType.DEVICE_CONNECTED, {
				host,
				info: context.info,
			});

			// Connect WebSocket if enabled
			if (this.wsEnabled) {
				this.connectWebSocket(host);
			}
		} catch (error) {
			this.logger.error(`[WLED][ADAPTER] Failed to connect to WLED device at ${host}`, {
				message: error instanceof Error ? error.message : String(error),
			});

			throw new WledConnectionException(host, error instanceof Error ? error.message : String(error));
		}
	}

	/**
	 * Disconnect from a WLED device
	 */
	disconnect(host: string): void {
		const device = this.devices.get(host);

		if (device) {
			device.connected = false;

			// Capture identifier before deletion for the event
			const { identifier } = device;

			// Clear any pending debounce timers and resolve pending promises
			const timer = this.debounceTimers.get(host);

			if (timer) {
				clearTimeout(timer);
				this.debounceTimers.delete(host);
				this.debounceUpdates.delete(host);

				// Resolve any pending debounce promises with false
				const pendingResolvers = this.debounceResolvers.get(host) ?? [];
				this.debounceResolvers.delete(host);

				for (const resolve of pendingResolvers) {
					resolve(false);
				}
			}

			// Close WebSocket connection
			this.disconnectWebSocket(host);

			this.devices.delete(host);

			this.logger.log(`[WLED][ADAPTER] Disconnected from WLED device at ${host}`);

			// Emit disconnected event
			this.eventEmitter.emit(WledAdapterEventType.DEVICE_DISCONNECTED, {
				host,
				identifier,
				reason: 'manual disconnect',
			});
		}
	}

	/**
	 * Disconnect all devices
	 */
	disconnectAll(): void {
		const hosts = Array.from(this.devices.keys());

		for (const host of hosts) {
			this.disconnect(host);
		}
	}

	/**
	 * Get a registered device by host
	 */
	getDevice(host: string): RegisteredWledDevice | undefined {
		return this.devices.get(host);
	}

	/**
	 * Get a registered device by identifier
	 */
	getDeviceByIdentifier(identifier: string): RegisteredWledDevice | undefined {
		for (const device of this.devices.values()) {
			if (device.identifier === identifier) {
				return device;
			}
		}

		return undefined;
	}

	/**
	 * Get all registered devices
	 */
	getRegisteredDevices(): RegisteredWledDevice[] {
		return Array.from(this.devices.values());
	}

	/**
	 * Check if a device is connected
	 */
	isConnected(host: string): boolean {
		const device = this.devices.get(host);

		return device?.connected ?? false;
	}

	/**
	 * Refresh the state of a connected device
	 */
	async refreshState(host: string, timeout: number = DEFAULT_CONNECTION_TIMEOUT_MS): Promise<WledState | null> {
		const device = this.devices.get(host);

		if (!device) {
			this.logger.warn(`[WLED][ADAPTER] Cannot refresh state: device ${host} not registered`);

			return null;
		}

		try {
			const state = await this.fetchState(host, timeout);
			const previousState = device.context?.state;

			if (device.context) {
				device.context.state = state;
			}

			device.lastSeen = new Date();
			device.connected = true;

			// Emit state changed event
			this.eventEmitter.emit(WledAdapterEventType.DEVICE_STATE_CHANGED, {
				host,
				state,
				previousState,
			});

			return state;
		} catch (error) {
			this.logger.error(`[WLED][ADAPTER] Failed to refresh state for device ${host}`, {
				message: error instanceof Error ? error.message : String(error),
			});

			device.connected = false;

			// Emit error event
			this.eventEmitter.emit(WledAdapterEventType.DEVICE_ERROR, {
				host,
				error: error instanceof Error ? error : new Error(String(error)),
			});

			return null;
		}
	}

	/**
	 * Update the state of a WLED device
	 * Supports debouncing for rapid updates
	 */
	async updateState(
		host: string,
		update: WledStateUpdate,
		debounceMs: number = DEFAULT_COMMAND_DEBOUNCE_MS,
	): Promise<boolean> {
		const device = this.devices.get(host);

		if (!device) {
			this.logger.warn(`[WLED][ADAPTER] Cannot update state: device ${host} not registered`);

			return false;
		}

		// If debounce is 0, execute immediately
		if (debounceMs <= 0) {
			return this.executeStateUpdate(host, update);
		}

		// Clear existing debounce timer (but keep pending resolvers)
		const existingTimer = this.debounceTimers.get(host);

		if (existingTimer) {
			clearTimeout(existingTimer);
		}

		// Debounce the update - collect all pending resolvers and merge updates
		return new Promise((resolve) => {
			// Add this caller's resolve to the pending list
			const resolvers = this.debounceResolvers.get(host) ?? [];
			resolvers.push(resolve);
			this.debounceResolvers.set(host, resolvers);

			// Merge this update with any pending updates
			const existingUpdate = this.debounceUpdates.get(host) ?? {};
			const mergedUpdate: WledStateUpdate = { ...existingUpdate, ...update };
			this.debounceUpdates.set(host, mergedUpdate);

			const timer = setTimeout(() => {
				this.debounceTimers.delete(host);

				// Get all pending resolvers and the merged update, then clear them
				const pendingResolvers = this.debounceResolvers.get(host) ?? [];
				const finalUpdate = this.debounceUpdates.get(host) ?? update;
				this.debounceResolvers.delete(host);
				this.debounceUpdates.delete(host);

				// Execute the merged update and resolve all pending promises
				void this.executeStateUpdate(host, finalUpdate).then((result) => {
					for (const pendingResolve of pendingResolvers) {
						pendingResolve(result);
					}
				});
			}, debounceMs);

			this.debounceTimers.set(host, timer);
		});
	}

	/**
	 * Execute a state update immediately
	 */
	private async executeStateUpdate(host: string, update: WledStateUpdate): Promise<boolean> {
		try {
			const apiPayload = this.convertStateUpdateToApi(update);

			this.logger.debug(`[WLED][ADAPTER] Sending state update to ${host}: ${JSON.stringify(apiPayload)}`);

			const response = await this.post<WledApiState>(`http://${host}/json/state`, apiPayload);

			// Update local state with the response
			const device = this.devices.get(host);

			if (device?.context) {
				const newState = this.convertApiStateToState(response);

				device.context.state = newState;
				device.lastSeen = new Date();

				// Emit state changed event
				this.eventEmitter.emit(WledAdapterEventType.DEVICE_STATE_CHANGED, {
					host,
					state: newState,
				});
			}

			return true;
		} catch (error) {
			this.logger.error(`[WLED][ADAPTER] Failed to update state for device ${host}`, {
				message: error instanceof Error ? error.message : String(error),
			});

			// Emit error event
			this.eventEmitter.emit(WledAdapterEventType.DEVICE_ERROR, {
				host,
				error: error instanceof Error ? error : new Error(String(error)),
			});

			return false;
		}
	}

	/**
	 * Turn the device on
	 */
	async turnOn(host: string): Promise<boolean> {
		return this.updateState(host, { on: true }, 0);
	}

	/**
	 * Turn the device off
	 */
	async turnOff(host: string): Promise<boolean> {
		return this.updateState(host, { on: false }, 0);
	}

	/**
	 * Set brightness (0-255)
	 */
	async setBrightness(host: string, brightness: number): Promise<boolean> {
		return this.updateState(host, { brightness: Math.max(0, Math.min(255, brightness)) }, 0);
	}

	/**
	 * Set color for the primary segment
	 */
	async setColor(host: string, red: number, green: number, blue: number, white?: number): Promise<boolean> {
		const color = white !== undefined ? [red, green, blue, white] : [red, green, blue];

		return this.updateState(
			host,
			{
				segment: {
					id: 0,
					colors: [color],
				},
			},
			0,
		);
	}

	/**
	 * Set effect for the primary segment
	 */
	async setEffect(host: string, effectId: number, speed?: number, intensity?: number): Promise<boolean> {
		const segmentUpdate: WledStateUpdate['segment'] = {
			id: 0,
			effect: effectId,
		};

		if (speed !== undefined) {
			(segmentUpdate as { effectSpeed?: number }).effectSpeed = speed;
		}

		if (intensity !== undefined) {
			(segmentUpdate as { effectIntensity?: number }).effectIntensity = intensity;
		}

		return this.updateState(host, { segment: segmentUpdate }, 0);
	}

	/**
	 * Set palette for the primary segment
	 */
	async setPalette(host: string, paletteId: number): Promise<boolean> {
		return this.updateState(
			host,
			{
				segment: {
					id: 0,
					palette: paletteId,
				},
			},
			0,
		);
	}

	/**
	 * Set active preset
	 */
	async setPreset(host: string, presetId: number): Promise<boolean> {
		return this.updateState(host, { preset: presetId }, 0);
	}

	/**
	 * Update nightlight settings
	 */
	async setNightlight(host: string, options: WledNightlightUpdate): Promise<boolean> {
		return this.updateStateExtended(host, { nightlight: options });
	}

	/**
	 * Update UDP sync settings
	 */
	async setUdpSync(host: string, options: WledUdpSyncUpdate): Promise<boolean> {
		return this.updateStateExtended(host, { udpSync: options });
	}

	/**
	 * Set live override mode
	 */
	async setLiveOverride(host: string, mode: number): Promise<boolean> {
		return this.updateStateExtended(host, { liveOverride: mode });
	}

	/**
	 * Update segment state
	 */
	async updateSegment(
		host: string,
		segmentId: number,
		update: Partial<{
			on: boolean;
			brightness: number;
			colors: number[][];
			effect: number;
			effectSpeed: number;
			effectIntensity: number;
			palette: number;
			reverse: boolean;
			mirror: boolean;
		}>,
	): Promise<boolean> {
		return this.updateState(
			host,
			{
				segment: {
					id: segmentId,
					...update,
				},
			},
			0,
		);
	}

	/**
	 * Update state with extended options (nightlight, sync, live override)
	 */
	async updateStateExtended(host: string, update: WledStateUpdateExtended): Promise<boolean> {
		const device = this.devices.get(host);

		if (!device) {
			this.logger.warn(`[WLED][ADAPTER] Cannot update state: device ${host} not registered`);
			return false;
		}

		try {
			const apiPayload = this.convertExtendedStateUpdateToApi(update);

			this.logger.debug(`[WLED][ADAPTER] Sending extended state update to ${host}: ${JSON.stringify(apiPayload)}`);

			const response = await this.post<WledApiState>(`http://${host}/json/state`, apiPayload);

			if (device.context) {
				const newState = this.convertApiStateToState(response);
				device.context.state = newState;
				device.lastSeen = new Date();

				this.eventEmitter.emit(WledAdapterEventType.DEVICE_STATE_CHANGED, {
					host,
					state: newState,
				});
			}

			return true;
		} catch (error) {
			this.logger.error(`[WLED][ADAPTER] Failed to update extended state for device ${host}`, {
				message: error instanceof Error ? error.message : String(error),
			});

			this.eventEmitter.emit(WledAdapterEventType.DEVICE_ERROR, {
				host,
				error: error instanceof Error ? error : new Error(String(error)),
			});

			return false;
		}
	}

	/**
	 * Connect WebSocket for real-time updates
	 */
	private connectWebSocket(host: string): void {
		// Clear any existing reconnect timer
		const reconnectTimer = this.wsReconnectTimers.get(host);
		if (reconnectTimer) {
			clearTimeout(reconnectTimer);
			this.wsReconnectTimers.delete(host);
		}

		// Close existing WebSocket if any
		const existingWs = this.websockets.get(host);
		if (existingWs) {
			existingWs.close();
			this.websockets.delete(host);
		}

		const wsUrl = `ws://${host}/ws`;
		this.logger.debug(`[WLED][ADAPTER] Connecting WebSocket to ${wsUrl}`);

		try {
			const ws = new WebSocket(wsUrl);

			ws.on('open', () => {
				this.logger.log(`[WLED][ADAPTER] WebSocket connected to ${host}`);
				this.websockets.set(host, ws);

				const device = this.devices.get(host);
				if (device) {
					device.websocket = ws as unknown as globalThis.WebSocket;
				}
			});

			ws.on('message', (data: WebSocket.Data) => {
				try {
					let dataStr: string;

					if (Buffer.isBuffer(data)) {
						dataStr = data.toString('utf-8');
					} else if (data instanceof ArrayBuffer) {
						dataStr = Buffer.from(data).toString('utf-8');
					} else if (Array.isArray(data)) {
						dataStr = Buffer.concat(data).toString('utf-8');
					} else {
						dataStr = data;
					}

					const message = JSON.parse(dataStr) as { state?: WledApiState };

					// WLED sends state updates through WebSocket
					if (message.state) {
						const device = this.devices.get(host);
						if (device?.context) {
							const newState = this.convertApiStateToState(message.state);
							const previousState = device.context.state;
							device.context.state = newState;
							device.lastSeen = new Date();

							this.eventEmitter.emit(WledAdapterEventType.DEVICE_STATE_CHANGED, {
								host,
								state: newState,
								previousState,
							});
						}
					}
				} catch (error) {
					this.logger.warn(`[WLED][ADAPTER] Failed to parse WebSocket message from ${host}`, {
						message: error instanceof Error ? error.message : String(error),
					});
				}
			});

			ws.on('close', () => {
				this.logger.debug(`[WLED][ADAPTER] WebSocket disconnected from ${host}`);
				this.websockets.delete(host);

				const device = this.devices.get(host);
				if (device) {
					device.websocket = undefined;
				}

				// Schedule reconnection if device is still registered and enabled
				if (device?.enabled && this.wsEnabled) {
					this.scheduleWebSocketReconnect(host);
				}
			});

			ws.on('error', (error: Error) => {
				this.logger.warn(`[WLED][ADAPTER] WebSocket error for ${host}`, {
					message: error.message,
				});
			});
		} catch (error) {
			this.logger.error(`[WLED][ADAPTER] Failed to create WebSocket for ${host}`, {
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}

	/**
	 * Disconnect WebSocket
	 */
	private disconnectWebSocket(host: string): void {
		// Clear reconnect timer
		const reconnectTimer = this.wsReconnectTimers.get(host);
		if (reconnectTimer) {
			clearTimeout(reconnectTimer);
			this.wsReconnectTimers.delete(host);
		}

		// Close WebSocket
		const ws = this.websockets.get(host);
		if (ws) {
			ws.close();
			this.websockets.delete(host);
		}
	}

	/**
	 * Schedule WebSocket reconnection
	 */
	private scheduleWebSocketReconnect(host: string): void {
		const timer = setTimeout(() => {
			this.wsReconnectTimers.delete(host);

			const device = this.devices.get(host);
			if (device?.connected && this.wsEnabled) {
				this.connectWebSocket(host);
			}
		}, this.wsReconnectInterval);

		this.wsReconnectTimers.set(host, timer);
	}

	/**
	 * Fetch full device context (state, info, effects, palettes)
	 */
	private async fetchDeviceContext(host: string, timeout: number): Promise<WledDeviceContext> {
		// Fetch all data in parallel
		const [stateData, infoData, effectsData, palettesData] = await Promise.all([
			this.get<WledApiState>(`http://${host}/json/state`, timeout),
			this.get<WledApiInfo>(`http://${host}/json/info`, timeout),
			this.get<string[]>(`http://${host}/json/effects`, timeout),
			this.get<string[]>(`http://${host}/json/palettes`, timeout),
		]);

		return {
			state: this.convertApiStateToState(stateData),
			info: this.convertApiInfoToInfo(infoData),
			effects: effectsData.map((name, id) => ({ id, name })),
			palettes: palettesData.map((name, id) => ({ id, name })),
		};
	}

	/**
	 * Fetch current state
	 */
	private async fetchState(host: string, timeout: number): Promise<WledState> {
		const stateData = await this.get<WledApiState>(`http://${host}/json/state`, timeout);

		return this.convertApiStateToState(stateData);
	}

	/**
	 * Convert API state to internal state format
	 */
	private convertApiStateToState(apiState: WledApiState): WledState {
		return {
			on: apiState.on,
			brightness: apiState.bri,
			transition: apiState.transition,
			preset: apiState.ps,
			playlist: apiState.pl,
			nightlight: {
				on: apiState.nl.on,
				duration: apiState.nl.dur,
				mode: apiState.nl.mode,
				targetBrightness: apiState.nl.tbri,
				remaining: apiState.nl.rem,
			},
			udp: {
				send: apiState.udpn.send,
				receive: apiState.udpn.recv,
			},
			liveOverride: apiState.lor,
			mainSegment: apiState.mainseg,
			segments: apiState.seg.map((seg) => this.convertApiSegmentToSegment(seg)),
		};
	}

	/**
	 * Convert API segment to internal segment format
	 */
	private convertApiSegmentToSegment(apiSeg: WledApiSegment): WledSegment {
		return {
			id: apiSeg.id,
			start: apiSeg.start,
			stop: apiSeg.stop,
			length: apiSeg.len,
			grouping: apiSeg.grp,
			spacing: apiSeg.spc,
			offset: apiSeg.of,
			colors: apiSeg.col,
			effect: apiSeg.fx,
			effectSpeed: apiSeg.sx,
			effectIntensity: apiSeg.ix,
			palette: apiSeg.pal,
			selected: apiSeg.sel,
			reverse: apiSeg.rev,
			on: apiSeg.on,
			brightness: apiSeg.bri,
			mirror: apiSeg.mi,
		};
	}

	/**
	 * Convert API info to internal info format
	 */
	private convertApiInfoToInfo(apiInfo: WledApiInfo): WledInfo {
		return {
			version: apiInfo.ver,
			versionId: apiInfo.vid,
			ledInfo: {
				count: apiInfo.leds.count,
				fps: apiInfo.leds.fps,
				power: apiInfo.leds.pwr,
				maxPower: apiInfo.leds.maxpwr,
				maxSegments: apiInfo.leds.maxseg,
			},
			name: apiInfo.name,
			udpPort: apiInfo.udpport,
			isLive: apiInfo.live,
			liveModeSource: apiInfo.lm,
			lm: apiInfo.lm,
			sourceIp: apiInfo.lip,
			wifi: {
				bssid: apiInfo.wifi?.bssid ?? '',
				rssi: apiInfo.wifi?.rssi ?? 0,
				channel: apiInfo.wifi?.channel ?? 0,
			},
			fileSystem: {
				used: apiInfo.fs?.u ?? 0,
				total: apiInfo.fs?.t ?? 0,
				presetsJson: apiInfo.fs?.pmt ?? 0,
			},
			effectsCount: apiInfo.fxcount,
			palettesCount: apiInfo.palcount,
			uptime: apiInfo.uptime,
			architecture: apiInfo.arch,
			core: apiInfo.core,
			freeHeap: apiInfo.freeheap,
			brand: apiInfo.brand ?? 'WLED',
			product: apiInfo.product ?? 'WLED Controller',
			mac: apiInfo.mac,
			ip: apiInfo.ip,
		};
	}

	/**
	 * Convert state update to API format
	 */
	private convertStateUpdateToApi(update: WledStateUpdate): Record<string, unknown> {
		const apiPayload: Record<string, unknown> = {};

		if (update.on !== undefined) {
			apiPayload.on = update.on;
		}

		if (update.brightness !== undefined) {
			apiPayload.bri = update.brightness;
		}

		if (update.transition !== undefined) {
			apiPayload.transition = update.transition;
		}

		if (update.preset !== undefined) {
			apiPayload.ps = update.preset;
		}

		if (update.segment !== undefined) {
			const segments = Array.isArray(update.segment) ? update.segment : [update.segment];

			apiPayload.seg = segments.map((seg) => {
				const apiSeg: Record<string, unknown> = {};

				if (seg.id !== undefined) {
					apiSeg.id = seg.id;
				}

				if (seg.colors !== undefined) {
					apiSeg.col = seg.colors;
				}

				if (seg.effect !== undefined) {
					apiSeg.fx = seg.effect;
				}

				if (seg.effectSpeed !== undefined) {
					apiSeg.sx = seg.effectSpeed;
				}

				if (seg.effectIntensity !== undefined) {
					apiSeg.ix = seg.effectIntensity;
				}

				if (seg.palette !== undefined) {
					apiSeg.pal = seg.palette;
				}

				if (seg.on !== undefined) {
					apiSeg.on = seg.on;
				}

				if (seg.brightness !== undefined) {
					apiSeg.bri = seg.brightness;
				}

				return apiSeg;
			});
		}

		return apiPayload;
	}

	/**
	 * Convert extended state update to API format
	 */
	private convertExtendedStateUpdateToApi(update: WledStateUpdateExtended): Record<string, unknown> {
		// Start with base conversion
		const apiPayload = this.convertStateUpdateToApi(update);

		// Add nightlight settings
		if (update.nightlight) {
			const nl: Record<string, unknown> = {};

			if (update.nightlight.on !== undefined) {
				nl.on = update.nightlight.on;
			}
			if (update.nightlight.duration !== undefined) {
				nl.dur = update.nightlight.duration;
			}
			if (update.nightlight.mode !== undefined) {
				nl.mode = update.nightlight.mode;
			}
			if (update.nightlight.targetBrightness !== undefined) {
				nl.tbri = update.nightlight.targetBrightness;
			}

			apiPayload.nl = nl;
		}

		// Add UDP sync settings
		if (update.udpSync) {
			const udpn: Record<string, unknown> = {};

			if (update.udpSync.send !== undefined) {
				udpn.send = update.udpSync.send;
			}
			if (update.udpSync.receive !== undefined) {
				udpn.recv = update.udpSync.receive;
			}

			apiPayload.udpn = udpn;
		}

		// Add live override
		if (update.liveOverride !== undefined) {
			apiPayload.lor = update.liveOverride;
		}

		return apiPayload;
	}

	/**
	 * HTTP GET request
	 */
	private async get<T>(url: string, timeout: number = DEFAULT_CONNECTION_TIMEOUT_MS): Promise<T> {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);

		try {
			const response = await fetch(url, {
				method: 'GET',
				signal: controller.signal,
				headers: {
					Accept: 'application/json',
				},
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			return (await response.json()) as T;
		} finally {
			clearTimeout(timeoutId);
		}
	}

	/**
	 * HTTP POST request
	 */
	private async post<T>(
		url: string,
		body: Record<string, unknown>,
		timeout: number = DEFAULT_CONNECTION_TIMEOUT_MS,
	): Promise<T> {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);

		try {
			const response = await fetch(url, {
				method: 'POST',
				signal: controller.signal,
				headers: {
					'Content-Type': 'application/json',
					Accept: 'application/json',
				},
				body: JSON.stringify(body),
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			return (await response.json()) as T;
		} finally {
			clearTimeout(timeoutId);
		}
	}
}
