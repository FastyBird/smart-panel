import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { nextSampleIngress } from '../../../modules/devices/services/property-sample-ingress';
import { ZigbeeSourceIdentity, zigbeeSourceIdentity } from '../contracts/sample-source.contract';
import {
	COMMAND_ECHO_WINDOW_MS,
	DEFAULT_MQTT_BASE_TOPIC,
	DEVICES_ZIGBEE2MQTT_PLUGIN_NAME,
	STARTUP_REPLAY_WINDOW_MAX_MS,
	STARTUP_REPLAY_WINDOW_MS,
	Z2M_IGNORED_DEVICE_TYPES,
} from '../devices-zigbee2mqtt.constants';
import {
	Z2mAdapterCallbacks,
	Z2mBridgeEvent,
	Z2mBridgeSettings,
	Z2mBridgeState,
	Z2mDevice,
	Z2mDeviceAvailability,
	Z2mDeviceStateMetadata,
	Z2mMqttConfig,
	Z2mRegisteredDevice,
	Z2mSetPayload,
	Z2mWsConfig,
} from '../interfaces/zigbee2mqtt.interface';

import { parseSourceTimestamp } from './source-timestamp';

/**
 * Abstract base class for Zigbee2MQTT client adapters.
 *
 * Contains shared device registry, state cache, message routing,
 * and callback management logic. Transport-specific subclasses
 * implement connect, disconnect, publishCommand, and requestState.
 */
export abstract class Z2mBaseClientAdapter {
	protected readonly logger: ExtensionLoggerService;

	private sourceGeneration = 0;
	/**
	 * Commands whose acknowledgement may still arrive, per device. Zigbee2MQTT publishes the commanded
	 * state once the device accepted the command, in the same form as a report, so while a window is open
	 * every state message of the device is treated as a possible acknowledgement (`commandEcho`). A window
	 * closes after {@link COMMAND_ECHO_WINDOW_MS}, or earlier when a message carries every commanded value
	 * and the command changed all of them: only then can that message be told apart from a merged report
	 * that already carried the same values.
	 */
	private readonly commandEchoWindows = new Map<string, CommandEchoWindow[]>();
	private readonly nativeEpochs = new Map<string, object>();
	/** Native capability/availability changes expire only this unit, without invalidating unrelated measurements. */
	getNativeClimateGuard(friendlyName: string): () => boolean {
		let token = this.nativeEpochs.get(friendlyName);
		if (!token) {
			token = Object.freeze({});
			this.nativeEpochs.set(friendlyName, token);
		}
		return () => this.nativeEpochs.get(friendlyName) === token;
	}
	private expireNativeClimate(friendlyName: string): void {
		this.nativeEpochs.set(friendlyName, Object.freeze({}));
		this.nativeSamples.delete(friendlyName);
	}
	private readonly nativeSamples = new Map<
		string,
		{ state: Readonly<Record<string, unknown>>; metadata: Z2mDeviceStateMetadata }
	>();

	/** Original packet fields only; never a merged gateway/backend cache. */
	getNativeClimateSample(friendlyName: string) {
		return this.nativeSamples.get(friendlyName) ?? null;
	}

	private cacheState: boolean | null = null;
	/**
	 * Monotonic instant (performance.now()) before which device state messages may be Zigbee2MQTT's
	 * startup/connect cache replay. Monotonic, so wall-clock corrections (NTP sync right after a
	 * Raspberry Pi boots) cannot shorten or stretch the window.
	 */
	private liveReportsNotBefore = 0;
	/** Monotonic instant past which message traffic no longer extends the replay window. */
	private replayWindowLimit = 0;
	/**
	 * Wall-clock instant the current replay window opened. A message whose `last_seen` is later
	 * than this was sent by the device after we connected, so it is a fresh report, not a replay.
	 */
	private replayWindowOpenedAt = 0;
	/** The device (IEEE address) whose state the cache holds for each friendly name. */
	private readonly cacheOwners = new Map<string, string>();
	/**
	 * Per-field evidence for the merged state cache, decided when the field's packet was received:
	 * the packet's accepted source time (null when absent or rejected) and the device that sent it.
	 * Replays reuse these decisions instead of re-deriving them at replay time.
	 */
	private readonly cachedFieldEvidence = new Map<string, Map<string, CachedFieldEvidence>>();
	private lastSeenWarningLogged = false;
	/** Freshness-related bridge settings from the last `bridge/info` of the connected bridge. */
	private bridgeSettings: Z2mBridgeSettings | null = null;
	private readonly sourceIdentities = new Map<string, ZigbeeSourceIdentity>();
	private connectedState = false;
	private bridgeOnlineState = false;
	protected get connected(): boolean {
		return this.connectedState;
	}
	protected set connected(value: boolean) {
		if (value !== this.connectedState) {
			this.sourceGeneration++;
			this.setCacheState(null);
			if (value) this.openStartupReplayWindow();
		}
		this.connectedState = value;
		if (!value) {
			this.sourceIdentities.clear();
			// A reconnect may reach a different bridge: its settings arrive with its own bridge/info.
			this.bridgeSettings = null;
			this.callbacks.onSourceRegistryUnavailable?.();
		}
	}
	protected get bridgeOnline(): boolean {
		return this.bridgeOnlineState;
	}
	protected set bridgeOnline(value: boolean) {
		if (value !== this.bridgeOnlineState) {
			this.sourceGeneration++;
			if (value) this.openStartupReplayWindow();
		}
		if (!value) this.setCacheState(null);
		this.bridgeOnlineState = value;
	}
	protected reconnectTimer: NodeJS.Timeout | null = null;
	protected configBaseTopic: string = DEFAULT_MQTT_BASE_TOPIC;

	// Internal device registry (keyed by friendly_name)
	protected readonly deviceRegistry = new Map<string, Z2mRegisteredDevice>();

	// Global state cache - stores ALL state messages by friendly_name
	// This is independent of deviceRegistry and is always populated when state messages arrive
	// Used as the source of truth for current device values during adoption and preview
	protected readonly stateCache = new Map<string, Record<string, unknown>>();

	// Callbacks for adapter events (set by the service)
	protected callbacks: Z2mAdapterCallbacks = {};

	constructor(adapterName: string) {
		this.logger = createExtensionLogger(DEVICES_ZIGBEE2MQTT_PLUGIN_NAME, adapterName);
	}

	/**
	 * Set callbacks for adapter events
	 */
	setCallbacks(callbacks: Z2mAdapterCallbacks): void {
		this.sourceGeneration++;
		this.callbacks = callbacks;
	}

	/**
	 * Get the base topic
	 */
	get baseTopic(): string {
		return this.configBaseTopic;
	}

	/**
	 * Check if connected
	 */
	isConnected(): boolean {
		return this.connected;
	}

	/**
	 * Check if Zigbee2MQTT bridge is online
	 */
	isBridgeOnline(): boolean {
		return this.bridgeOnline;
	}

	/** Freshness-related settings of the connected bridge, or null before its `bridge/info` arrives. */
	getBridgeSettings(): Z2mBridgeSettings | null {
		return this.connected ? this.bridgeSettings : null;
	}

	getMeasurementReadiness(): { requiredProof: string; reasons: readonly string[] } {
		return {
			requiredProof: 'live_device_report_after_startup_replay_window',
			reasons: !this.connected || !this.bridgeOnline ? ['zigbee_source_disconnected'] : [],
		};
	}

	getSourceIdentity(friendlyName: string): ZigbeeSourceIdentity | null {
		return this.sourceIdentities.get(friendlyName) ?? null;
	}
	getSourceIdentityGuard(friendlyName: string): () => boolean {
		const identity = this.sourceIdentities.get(friendlyName);
		const generation = this.sourceGeneration;
		return () =>
			Boolean(
				identity &&
				this.connected &&
				generation === this.sourceGeneration &&
				this.sourceIdentities.get(friendlyName) === identity,
			);
	}

	private setCacheState(value: boolean | null): void {
		this.cacheState = value;
	}

	/** Opened on connect and when the bridge comes online; protected so fixtures can control it. */
	protected openStartupReplayWindow(durationMs = STARTUP_REPLAY_WINDOW_MS): void {
		const now = performance.now();
		this.liveReportsNotBefore = now + durationMs;
		this.replayWindowLimit = now + Math.max(durationMs, STARTUP_REPLAY_WINDOW_MAX_MS);
		this.replayWindowOpenedAt = Date.now();
	}

	/**
	 * Keep an open replay window open while Zigbee2MQTT is still publishing: it starts extensions and
	 * then publishes cached states one by one after `online`, with no fixed bound. Live reports that
	 * arrive meanwhile also extend it, which only delays freshness (the safe direction).
	 */
	private extendStartupReplayWindow(): void {
		const now = performance.now();
		if (now >= this.liveReportsNotBefore) return;
		this.liveReportsNotBefore = Math.max(
			this.liveReportsNotBefore,
			Math.min(this.replayWindowLimit, now + STARTUP_REPLAY_WINDOW_MS),
		);
	}

	private liveReportReason(
		online: boolean,
		sourceTime: Date | null,
		isRetained: boolean,
		isCached: boolean,
		afterReplayWindow: boolean,
	): string {
		if (!online) return 'zigbee_source_disconnected';
		const replay = isRetained || isCached || !afterReplayWindow;
		if (sourceTime) return replay ? 'zigbee_replay_timed_by_last_seen' : 'zigbee_device_report_timed_by_last_seen';
		if (isRetained) return 'zigbee_retained_state_without_last_seen';
		if (isCached) return 'zigbee_cached_replay_without_last_seen';
		if (!afterReplayWindow) return 'zigbee_startup_replay_window';
		// With cache_state enabled the payload merges cached fields; the report still proves the
		// device is alive, so those fields are treated as confirmed unchanged.
		return this.cacheState === false ? 'zigbee_live_device_report' : 'zigbee_live_device_report_merged_state';
	}

	/**
	 * Device-level sample evidence for a state payload.
	 *
	 * A device report is live when it arrives while connected and the bridge is online. Without a
	 * source time, replays (retained messages, our own cached replay, the startup replay window) are
	 * not live, since their age is unknown. With Zigbee2MQTT's optional `last_seen`, the message
	 * carries the moment the device last spoke, so replays are live samples timed by it and their
	 * age decides freshness.
	 */
	private buildStateMetadata(
		friendlyName: string,
		state: Record<string, unknown>,
		observedAt: Date,
		isRetained: boolean,
		options?: StatePacketOptions,
		decidedSourceTime?: Date | null,
	): Z2mDeviceStateMetadata {
		const generation = this.sourceGeneration;
		const identity = this.sourceIdentities.get(friendlyName);
		const online = this.connected && this.bridgeOnline;
		const isCached = options?.isCached === true;
		const sourceTime =
			decidedSourceTime !== undefined ? decidedSourceTime : parseSourceTimestamp(state.last_seen, observedAt);
		// Inside the window a message is a replay, unless its source time shows the device sent it
		// after the window opened (a fresh report, such as a real button press). A source time that had
		// to be capped at receipt (gateway clock ahead of ours) cannot place the report after anything.
		const afterReplayWindow =
			performance.now() >= this.liveReportsNotBefore ||
			(!isCached &&
				decidedSourceTime === undefined &&
				sourceTime !== null &&
				sourceTime.getTime() > this.replayWindowOpenedAt &&
				new Date(state.last_seen as string | number).getTime() <= observedAt.getTime());
		const isReplay = isRetained || isCached || !afterReplayWindow;
		const isLive = online && (sourceTime !== null || !isReplay);

		return {
			observedAt,
			isRetained,
			isCached: options?.isCached,
			isReplay,
			...(sourceTime ? { sampledAt: sourceTime } : {}),
			measurementFieldsAreLive: isLive,
			reportScope:
				online && this.cacheState === false && !isReplay && !options?.isDup && !options?.mayIncludeConnectSnapshot
					? 'property'
					: 'device',
			sourceIdentity: identity ?? null,
			qualificationReason: this.liveReportReason(online, sourceTime, isRetained, isCached, afterReplayWindow),
			isCurrent: () =>
				generation === this.sourceGeneration &&
				this.sourceIdentities.get(friendlyName) === identity &&
				(options?.isCurrent?.() ?? true),
			...(isLive
				? {
						sourceIsCurrent: () =>
							generation === this.sourceGeneration &&
							this.connected &&
							this.bridgeOnline &&
							this.sourceIdentities.get(friendlyName) === identity &&
							(options?.isCurrent?.() ?? true),
					}
				: {}),
			isDup: options?.isDup,
			packetId: options?.packetId,
		};
	}

	/**
	 * The merged state cached for a device, replayed with the evidence decided when each field was
	 * received. Used to process states that arrived before the device mapping was ready.
	 *
	 * Fields are grouped by the source time of the packet that supplied them, so each value keeps its
	 * own age. A field from a different physical device (a reused friendly name) is not replayed. A
	 * field whose sender could not be identified is replayed for display only, without a source time.
	 */
	getCachedStateReplays(friendlyName: string): { state: Record<string, unknown>; metadata: Z2mDeviceStateMetadata }[] {
		const cached = this.stateCache.get(friendlyName);
		if (!cached) return [];
		const evidence = this.cachedFieldEvidence.get(friendlyName);
		const currentIeee = this.sourceIdentities.get(friendlyName)?.ieeeAddress ?? null;
		const groups = new Map<
			string,
			{ time: number | null; state: Record<string, unknown>; receivedAt: number; commandEcho: boolean }
		>();
		for (const [field, value] of Object.entries(cached)) {
			const fieldEvidence = evidence?.get(field);
			const sender = fieldEvidence?.ieeeAddress ?? null;
			if (sender !== null && sender !== currentIeee) continue;
			const sourceTime = sender !== null ? (fieldEvidence?.sourceTime ?? null) : null;
			const time = sourceTime ? sourceTime.getTime() : null;
			// Grouped by original receipt too: source-binding cutoffs judge when we actually observed
			// each field, so fields received at different times never share one receipt time.
			const receivedAt = fieldEvidence?.receivedAt.getTime() ?? Date.now();
			// A field cached from a possible command acknowledgement is replayed as one, never as a report.
			const commandEcho = fieldEvidence?.commandEcho === true;
			const key = `${time}|${receivedAt}|${commandEcho}`;
			const group = groups.get(key) ?? { time, state: {}, receivedAt, commandEcho };
			group.state[field] = value;
			groups.set(key, group);
		}
		return [...groups.values()]
			.sort((a, b) => (a.time ?? -Infinity) - (b.time ?? -Infinity) || a.receivedAt - b.receivedAt)
			.map(({ time, commandEcho, ...group }) => {
				const metadata = this.buildStateMetadata(
					friendlyName,
					group.state,
					new Date(group.receivedAt),
					false,
					{ isCached: true },
					time === null ? null : new Date(time),
				);
				return { state: group.state, metadata: commandEcho ? { ...metadata, commandEcho: true } : metadata };
			});
	}

	private recordCachedFieldEvidence(
		friendlyName: string,
		state: Record<string, unknown>,
		metadata: Z2mDeviceStateMetadata,
	): void {
		const evidence = this.cachedFieldEvidence.get(friendlyName) ?? new Map<string, CachedFieldEvidence>();
		const entry: CachedFieldEvidence = {
			sourceTime: metadata.sampledAt ?? null,
			ieeeAddress: metadata.sourceIdentity?.ieeeAddress ?? null,
			receivedAt: metadata.observedAt ?? new Date(),
			...(metadata.commandEcho === true ? { commandEcho: true } : {}),
		};
		for (const field of Object.keys(state)) evidence.set(field, entry);
		this.cachedFieldEvidence.set(friendlyName, evidence);
	}

	/**
	 * Get all registered devices
	 */
	getRegisteredDevices(): Z2mRegisteredDevice[] {
		return Array.from(this.deviceRegistry.values());
	}

	/**
	 * Get a device by friendly name
	 */
	getDevice(friendlyName: string): Z2mRegisteredDevice | undefined {
		return this.deviceRegistry.get(friendlyName);
	}

	/**
	 * Get a device by IEEE address
	 */
	getDeviceByIeeeAddress(ieeeAddress: string): Z2mRegisteredDevice | undefined {
		for (const device of this.deviceRegistry.values()) {
			if (device.ieeeAddress === ieeeAddress) {
				return device;
			}
		}
		return undefined;
	}

	/**
	 * Get cached state for a device by friendly name
	 * This returns state from the global cache, which is always populated
	 * regardless of whether the device is in the registry or adopted
	 */
	getCachedState(friendlyName: string): Record<string, unknown> {
		return this.stateCache.get(friendlyName) ?? {};
	}

	/**
	 * Connect to the Zigbee2MQTT instance
	 */
	abstract connect(config: Z2mMqttConfig | Z2mWsConfig): Promise<void>;

	/**
	 * Disconnect from the Zigbee2MQTT instance
	 */
	abstract disconnect(): Promise<void>;

	/**
	 * Publish a command to a device
	 */
	async publishCommand(
		friendlyName: string,
		payload: Z2mSetPayload,
		isCurrent: () => boolean = () => true,
	): Promise<boolean> {
		// Opened before sending: the acknowledgement may arrive before the publish callback.
		const window = this.openCommandEchoWindow(friendlyName, payload);
		let sent = false;
		try {
			sent = await this.sendCommand(friendlyName, payload, isCurrent);
		} finally {
			if (!sent) window.close();
		}
		return sent;
	}

	/** Whether a command sent to the device can still be acknowledged. */
	hasPendingCommands(friendlyName: string): boolean {
		return (this.commandEchoWindows.get(friendlyName)?.length ?? 0) > 0;
	}

	/**
	 * Wait until no command sent to the device can still be acknowledged, so that every later state
	 * message of the device is a report. Resolves at once when nothing is pending.
	 */
	async whenCommandsAcknowledged(friendlyName: string): Promise<void> {
		// Commands sent while waiting open new windows: wait until none is left.
		for (
			let windows = this.commandEchoWindows.get(friendlyName);
			windows && windows.length > 0;
			windows = this.commandEchoWindows.get(friendlyName)
		)
			await Promise.all(windows.map((window) => window.closed));
	}

	/**
	 * Send a `/set` command to the device. Zigbee2MQTT publishes the commanded state once the device
	 * accepts it; that publication is marked as a command echo (see {@link publishCommand}).
	 */
	protected abstract sendCommand(
		friendlyName: string,
		payload: Z2mSetPayload,
		isCurrent: () => boolean,
	): Promise<boolean>;

	/**
	 * Request current state from a device
	 */
	abstract requestState(friendlyName: string, properties?: string[]): Promise<boolean>;

	/**
	 * Toggle the bridge's permit_join state for a bounded number of seconds.
	 * Returns true on successful publish/send, false otherwise.
	 * Pass 0 to disable pairing immediately.
	 */
	abstract setPermitJoin(seconds: number): Promise<boolean>;

	// =========================================================================
	// Shared message handling logic
	// =========================================================================

	/**
	 * Handle an incoming message from zigbee2mqtt.
	 * Called by subclasses when a message is received (via MQTT or WebSocket).
	 *
	 * @param topic - The full topic string (e.g. "zigbee2mqtt/bridge/state")
	 *                or relative path (e.g. "bridge/state") depending on transport.
	 * @param message - The message payload as string.
	 * @param isRelative - If true, topic is already relative to baseTopic.
	 */
	protected handleMessage(
		topic: string,
		message: string,
		isRelative = false,
		isRetained = false,
		options?: StatePacketOptions,
	): void {
		try {
			const relativePath = isRelative ? topic : topic.replace(`${this.baseTopic}/`, '');

			if (!relativePath) {
				return;
			}

			this.extendStartupReplayWindow();

			const topicParts = relativePath.split('/');

			// IMPORTANT: Check device registry FIRST, before bridge routing
			// This handles devices with names starting with "bridge/" (e.g., "bridge/light1")
			if (this.deviceRegistry.has(relativePath)) {
				this.handleDeviceStateMessage(relativePath, message, isRetained, options);
				return;
			}

			// Now safe to check for bridge messages (no known device matches this path)
			if (topicParts[0] === 'bridge') {
				if (topicParts.length === 2)
					this.handleBridgeMessage(topicParts[1], message, isRetained || options?.isDup === true);
				return;
			}

			const lastPart = topicParts[topicParts.length - 1];
			const pathWithoutSuffix = topicParts.slice(0, -1).join('/');

			if (lastPart === 'availability' && pathWithoutSuffix) {
				this.handleDeviceAvailabilityMessage(pathWithoutSuffix, message);
				return;
			}

			if (lastPart === 'set' || lastPart === 'get') {
				// Command topics - skip
				return;
			}

			// Default: treat as state message for the full path
			this.handleDeviceStateMessage(relativePath, message, isRetained, options);
		} catch (error) {
			this.logger.warn(`Failed to handle message on topic ${topic}`, {
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}

	/**
	 * Handle bridge messages (state, devices, events)
	 */
	protected handleBridgeMessage(subtopic: string | undefined, message: string, isRetained = false): void {
		switch (subtopic) {
			case 'info': {
				// Only the literal whitelisted config field is retained. No credentials/config dump.
				// MQTT retained bridge info may outlive its gateway: require a current publish.
				// Frontend WS snapshots come from the running gateway's own retainedMessages map.
				// https://github.com/Koenkk/zigbee2mqtt/blob/master/lib/extension/frontend.ts
				// Bridge requestLookup has no read-only info request; never mutate options to elicit proof.
				let cacheState: boolean | null = null;
				try {
					const info = JSON.parse(message) as {
						config?: {
							advanced?: { cache_state?: unknown; cache_state_send_on_startup?: unknown; last_seen?: unknown };
							device_options?: { retain?: unknown };
							mqtt?: { force_disable_retain?: unknown };
						};
					};
					// A display hint for the admin, never qualification evidence: a retained copy is accepted.
					const config = info?.config;
					if (this.connected && config && typeof config === 'object') {
						const advanced = config.advanced ?? {};
						this.bridgeSettings = Object.freeze({
							lastSeen: typeof advanced.last_seen === 'string' ? advanced.last_seen : null,
							cacheState: typeof advanced.cache_state === 'boolean' ? advanced.cache_state : null,
							cacheStateSendOnStartup:
								typeof advanced.cache_state_send_on_startup === 'boolean' ? advanced.cache_state_send_on_startup : null,
							retain: config.mqtt?.force_disable_retain !== true && config.device_options?.retain === true,
							receivedAt: new Date().toISOString(),
						});
					}
					const value = info?.config?.advanced?.cache_state;
					if (this.connected && !isRetained && typeof value === 'boolean') cacheState = value;
					const lastSeen = info?.config?.advanced?.last_seen;
					if (lastSeen === 'disable' && !this.lastSeenWarningLogged) {
						this.lastSeenWarningLogged = true;
						this.logger.warn(
							'Zigbee2MQTT has advanced.last_seen disabled, so values carry no device timestamp. Startup ' +
								'replays are recognised only by a heuristic window (5 s quiet gap, 60 s limit): replayed ' +
								'values inside it stay non-fresh until the device reports again, and a cached state ' +
								'arriving after it counts as a new report. Set advanced.last_seen to ISO_8601 in ' +
								'Zigbee2MQTT to time values by the device itself.',
						);
					}
				} catch {
					/* malformed proof remains unqualified */
				}
				this.setCacheState(cacheState);
				break;
			}
			case 'state':
				this.handleBridgeStateMessage(message);
				break;
			case 'devices':
				this.handleBridgeDevicesMessage(message);
				break;
			case 'event':
				this.handleBridgeEventMessage(message);
				break;
			case 'groups':
				this.logger.debug('Received bridge/groups message (not implemented)');
				break;
		}
	}

	/**
	 * Handle bridge state message
	 */
	protected handleBridgeStateMessage(message: string): void {
		try {
			const state = JSON.parse(message) as Z2mBridgeState;
			const wasOnline = this.bridgeOnline;
			this.bridgeOnline = state.state === 'online';

			if (this.bridgeOnline && !wasOnline) {
				this.logger.log('Zigbee2MQTT bridge is online');
				void this.callbacks.onBridgeOnline?.();
			} else if (!this.bridgeOnline && wasOnline) {
				this.logger.warn('Zigbee2MQTT bridge is offline');
				void this.callbacks.onBridgeOffline?.();
			}
		} catch (error) {
			this.logger.warn('Failed to parse bridge/state message', {
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}

	/**
	 * Handle bridge devices message
	 */
	protected handleBridgeDevicesMessage(message: string): void {
		try {
			const devices = JSON.parse(message) as Z2mDevice[];
			if (!Array.isArray(devices) || new Set(devices.map((device) => device.friendly_name)).size !== devices.length)
				throw new Error('Invalid or ambiguous Zigbee device registry');
			const observedAt = new Date();
			const next = new Map<string, ZigbeeSourceIdentity>();
			for (const device of devices) {
				const identity = zigbeeSourceIdentity(device, observedAt);
				if (!identity) continue;
				const previous = this.sourceIdentities.get(identity.friendlyName);
				next.set(identity.friendlyName, previous?.fingerprint === identity.fingerprint ? previous : identity);
			}
			this.sourceIdentities.clear();
			for (const [name, identity] of next) {
				this.sourceIdentities.set(name, identity);
				// A friendly name now held by a different device: its cached state (including fields
				// whose sender could not be identified) belongs to the previous device.
				const owner = this.cacheOwners.get(name);
				if (owner !== undefined && owner !== identity.ieeeAddress) {
					this.stateCache.delete(name);
					this.cachedFieldEvidence.delete(name);
				}
				this.cacheOwners.set(name, identity.ieeeAddress);
			}
			void this.callbacks.onSourceRegistryReceived?.([...next.values()]);

			this.logger.log(`Received device registry with ${devices.length} devices`);

			for (const device of devices) {
				if (device.definition) {
					this.logger.debug(
						`Device ${device.friendly_name}: ${device.definition.exposes?.length ?? 0} exposes, ` +
							`types: ${device.definition.exposes?.map((e) => e.type).join(', ') ?? 'none'}`,
					);
				}
			}

			// Update internal registry
			for (const device of devices) {
				if (
					Z2M_IGNORED_DEVICE_TYPES.includes(device.type as (typeof Z2M_IGNORED_DEVICE_TYPES)[number]) ||
					!device.supported ||
					device.disabled
				) {
					continue;
				}

				const registered = this.deviceRegistry.get(device.friendly_name);
				// A friendly name now held by a different device: the previous device's state is not its own.
				const existing = registered?.ieeeAddress === device.ieee_address ? registered : undefined;
				if (registered && !existing) this.expireNativeClimate(device.friendly_name);
				if (
					existing &&
					(existing.softwareBuildId !== device.software_build_id ||
						existing.modelId !== device.model_id ||
						existing.definition?.model !== device.definition?.model ||
						existing.definition?.vendor !== device.definition?.vendor)
				)
					this.expireNativeClimate(device.friendly_name);
				const cachedState = this.stateCache.get(device.friendly_name) ?? {};

				const registeredDevice: Z2mRegisteredDevice = {
					ieeeAddress: device.ieee_address,
					friendlyName: device.friendly_name,
					description: device.description,
					type: device.type as 'Router' | 'EndDevice',
					supported: device.supported,
					disabled: device.disabled,
					definition: device.definition,
					powerSource: device.power_source,
					modelId: device.model_id,
					softwareBuildId: device.software_build_id,
					available: existing?.available ?? true,
					lastSeen: existing?.lastSeen,
					currentState: { ...(existing?.currentState ?? {}), ...cachedState },
				};

				this.deviceRegistry.set(device.friendly_name, registeredDevice);

				if (Object.keys(cachedState).length > 0) {
					this.logger.debug(
						`Applied cached state to "${device.friendly_name}": ${Object.keys(cachedState).join(', ')}`,
					);
				}
			}

			// Remove devices no longer in registry
			const currentFriendlyNames = new Set(devices.map((d) => d.friendly_name));
			for (const friendlyName of this.deviceRegistry.keys()) {
				if (!currentFriendlyNames.has(friendlyName)) {
					this.deviceRegistry.delete(friendlyName);
					this.nativeSamples.delete(friendlyName);
					this.nativeEpochs.delete(friendlyName);
				}
			}

			// Request state for devices that don't have currentState
			this.requestMissingStates();

			// Invoke callback with filtered devices
			const filteredDevices = devices.filter(
				(d) =>
					!Z2M_IGNORED_DEVICE_TYPES.includes(d.type as (typeof Z2M_IGNORED_DEVICE_TYPES)[number]) &&
					d.supported &&
					!d.disabled,
			);
			void this.callbacks.onDevicesReceived?.(filteredDevices);
		} catch (error) {
			this.sourceIdentities.clear();
			this.callbacks.onSourceRegistryUnavailable?.();
			this.logger.error('Failed to parse bridge/devices message', {
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}

	/**
	 * Request state for devices that don't have currentState populated
	 */
	protected requestMissingStates(): void {
		for (const [friendlyName, device] of this.deviceRegistry.entries()) {
			if (Object.keys(device.currentState).length === 0) {
				this.logger.debug(`Requesting state for device without current state: ${friendlyName}`);
				this.requestState(friendlyName).catch(() => {
					// Ignore errors - device might be offline
				});
			}
		}
	}

	/**
	 * Handle bridge event message
	 */
	protected handleBridgeEventMessage(message: string): void {
		try {
			const event = JSON.parse(message) as Z2mBridgeEvent;

			switch (event.type) {
				case 'device_joined':
				case 'device_announce':
					this.logger.log(`Device joined: ${event.data.friendly_name}`);
					void this.callbacks.onDeviceJoined?.(event.data.ieee_address ?? '', event.data.friendly_name ?? '');
					break;

				case 'device_leave':
					this.logger.log(`Device left: ${event.data.friendly_name}`);

					if (event.data.friendly_name) {
						this.deviceRegistry.delete(event.data.friendly_name);
						this.nativeSamples.delete(event.data.friendly_name);
						this.nativeEpochs.delete(event.data.friendly_name);
					}

					void this.callbacks.onDeviceLeft?.(event.data.ieee_address ?? '', event.data.friendly_name ?? '');
					break;

				case 'device_interview':
					this.logger.debug(`Device interview: ${event.data.friendly_name} - ${event.data.status}`);
					break;
			}
		} catch (error) {
			this.logger.warn('Failed to parse bridge/event message', {
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}

	/**
	 * Handle device state message
	 */
	protected handleDeviceStateMessage(
		friendlyName: string,
		message: string,
		isRetained = false,
		options?: StatePacketOptions,
	): void {
		const observedAt = new Date();
		try {
			const state = JSON.parse(message) as Record<string, unknown>;
			// Arrival order is fixed at receipt, before device lookups and mapping.
			const ingressSequence = nextSampleIngress();
			const built = this.buildStateMetadata(friendlyName, state, observedAt, isRetained, options);
			// A replay of our own cache or a retained message is not an acknowledgement of a new command.
			// A startup replay or a redelivered duplicate may still be an acknowledgement, but it cannot
			// acknowledge a command by itself: it never closes a window.
			const commandEcho =
				options?.isCached !== true &&
				!isRetained &&
				this.takeCommandEcho(friendlyName, state, !built.isReplay && options?.isDup !== true);
			const metadata: Z2mDeviceStateMetadata = {
				...built,
				ingressSequence,
				...(commandEcho ? { commandEcho: true } : {}),
			};

			this.logger.debug(`Received state for "${friendlyName}": ${Object.keys(state).join(', ')}`);

			// ALWAYS store state in the global cache
			const existingCachedState = this.stateCache.get(friendlyName) ?? {};
			this.stateCache.set(friendlyName, { ...existingCachedState, ...state });
			this.recordCachedFieldEvidence(friendlyName, state, metadata);

			// Also update internal registry if device exists there
			const device = this.deviceRegistry.get(friendlyName);
			if (device) {
				device.currentState = { ...device.currentState, ...state };
				device.lastSeen = new Date();
				this.logger.debug(`Updated registry and cache for "${friendlyName}"`);
			} else {
				this.logger.debug(`Updated cache for "${friendlyName}" (not yet in registry)`);
			}

			// A replay is never a current native observation: keep the last qualified one. A possible command
			// acknowledgement is not one either, and it may show values the device has not taken: drop the
			// last observation until the device reports again.
			if (
				!metadata.isReplay &&
				metadata.sourceIdentity &&
				Array.isArray(device?.definition?.exposes) &&
				device.definition.exposes.some((expose) => expose.type === 'climate')
			) {
				if (metadata.commandEcho === true) this.nativeSamples.delete(friendlyName);
				else this.nativeSamples.set(friendlyName, { state: Object.freeze({ ...state }), metadata });
			}
			void this.callbacks.onDeviceStateChanged?.(friendlyName, state, metadata);
		} catch (error) {
			this.logger.warn(`Failed to parse state for device ${friendlyName}`, {
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}

	/**
	 * Handle device availability message
	 */
	protected handleDeviceAvailabilityMessage(friendlyName: string, message: string): void {
		this.logger.debug(`Received availability for "${friendlyName}": ${message}`);

		try {
			let available: boolean;

			try {
				const availability = JSON.parse(message) as Z2mDeviceAvailability;
				available = availability.state === 'online';
			} catch {
				available = message === 'online';
			}

			const device = this.deviceRegistry.get(friendlyName);
			if (device) {
				if (device.available !== available) this.expireNativeClimate(friendlyName);
				device.available = available;
			}

			void this.callbacks.onDeviceAvailabilityChanged?.(friendlyName, available);
		} catch (error) {
			this.logger.warn(`Failed to parse availability for device ${friendlyName}`, {
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}

	/**
	 * Clear reconnection timer
	 */
	protected clearReconnectTimer(): void {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
	}

	/**
	 * Reset adapter state on disconnect
	 */
	protected resetState(): void {
		this.sourceGeneration++;
		this.setCacheState(null);
		this.bridgeSettings = null;
		this.connected = false;
		this.bridgeOnline = false;
		this.deviceRegistry.clear();
		this.stateCache.clear();
		this.cachedFieldEvidence.clear();
		this.cacheOwners.clear();
		this.nativeSamples.clear();
		this.nativeEpochs.clear();
		this.sourceIdentities.clear();
		// Acknowledgements of commands sent on a closed connection are replays of the next connection.
		for (const windows of [...this.commandEchoWindows.values()]) for (const window of windows) window.close();
	}

	private openCommandEchoWindow(friendlyName: string, payload: Z2mSetPayload): CommandEchoWindow {
		let release!: () => void;
		const closed = new Promise<void>((resolve) => {
			release = resolve;
		});
		const commanded = Object.freeze({ ...(payload as Record<string, unknown>) });
		const before = this.stateCache.get(friendlyName) ?? {};
		const window: CommandEchoWindow = {
			commanded,
			changesState: Object.entries(commanded).every(([key, value]) => !echoesCommandedValue(before[key], value)),
			closed,
			close: () => {
				clearTimeout(timer);
				const windows = this.commandEchoWindows.get(friendlyName);
				const remaining = windows?.filter((other) => other !== window) ?? [];
				if (remaining.length > 0) this.commandEchoWindows.set(friendlyName, remaining);
				else if (windows) this.commandEchoWindows.delete(friendlyName);
				release();
			},
		};
		const timer = setTimeout(() => window.close(), COMMAND_ECHO_WINDOW_MS);
		timer.unref?.();
		this.commandEchoWindows.set(friendlyName, [...(this.commandEchoWindows.get(friendlyName) ?? []), window]);
		return window;
	}

	/**
	 * Whether a state message may acknowledge a pending command. Every message received while a window is
	 * open counts. For a command that changed the state, a message carrying all commanded values is its
	 * acknowledgement and closes its window, oldest first and one window per message, so each of two equal
	 * commands waits for its own acknowledgement.
	 */
	private takeCommandEcho(friendlyName: string, state: Record<string, unknown>, mayAcknowledge: boolean): boolean {
		const windows = this.commandEchoWindows.get(friendlyName);
		if (!windows || windows.length === 0) return false;
		if (mayAcknowledge)
			windows
				.find(
					(window) =>
						window.changesState &&
						Object.entries(window.commanded).every(([key, value]) => echoesCommandedValue(state[key], value)),
				)
				?.close();
		return true;
	}
}

type StatePacketOptions = Pick<Z2mDeviceStateMetadata, 'isDup' | 'packetId' | 'isCached' | 'isCurrent'> & {
	mayIncludeConnectSnapshot?: boolean;
};

/** How a cached field was received; replays reuse it instead of re-deriving it. */
interface CachedFieldEvidence {
	sourceTime: Date | null;
	ieeeAddress: string | null;
	receivedAt: Date;
	/** The field came from a possible command acknowledgement. */
	commandEcho?: boolean;
}

interface CommandEchoWindow {
	readonly commanded: Readonly<Record<string, unknown>>;
	/** Every commanded value differed from the device's last known state when the command was sent. */
	readonly changesState: boolean;
	readonly closed: Promise<void>;
	close(): void;
}

function echoesCommandedValue(reported: unknown, commanded: unknown): boolean {
	if (typeof commanded === 'string' && typeof reported === 'string')
		return reported.toLowerCase() === commanded.toLowerCase();
	if (commanded !== null && typeof commanded === 'object' && reported !== null && typeof reported === 'object')
		return Object.entries(commanded as Record<string, unknown>).every(([key, value]) =>
			echoesCommandedValue((reported as Record<string, unknown>)[key], value),
		);
	return reported === commanded;
}
