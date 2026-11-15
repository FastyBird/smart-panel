import { PROTECT_ID_PATTERN } from '../client/protect-endpoints';
import {
	PROTECT_EVENT_SAFETY_TIMEOUT_MS,
	PROTECT_MAX_OPEN_EVENTS,
	PROTECT_MAX_SEEN_EVENTS,
} from '../devices-unifi-protect.constants';

import { ProtectFrame } from './protect-frame-merge';

export interface ProtectTargetWrite {
	channelIdentifier: string;
	mappingName: string;
	value: string | boolean;
}

export type ProtectEventEffect =
	| { kind: 'write'; protectDeviceId: string; writes: ProtectTargetWrite[] }
	| { kind: 'ring'; protectDeviceId: string; eventId: string; startedAt: number | null };

export type ProtectEventIgnore =
	| 'unknown_type'
	| 'unknown_detection_type'
	| 'unmapped_type'
	| 'covered_type'
	| 'duplicate'
	| 'unknown_event'
	| 'invalid';

export interface ProtectEventOutcome {
	effects: ProtectEventEffect[];
	ignored: { reason: ProtectEventIgnore; name: string | null }[];
}

export type ProtectEventKind = 'duration' | 'instant' | 'latch' | 'ring' | 'covered' | 'unmapped';

/** `key` is the channel identifier; a target is on while any open event of the device holds its key. */
export interface ProtectEventTarget {
	key: string;
	start: ProtectTargetWrite[];
	end: ProtectTargetWrite[];
}

const SAFE_NAME = /^[A-Za-z0-9_]{1,64}$/;

const OBJECT_TYPES: Readonly<Record<string, string>> = Object.freeze({
	person: 'person',
	vehicle: 'vehicle',
	animal: 'animal',
	package: 'package',
	licensePlate: 'license_plate',
	face: 'face',
});

const AUDIO_TYPES: Readonly<Record<string, { channel: string; mapping: string }>> = Object.freeze({
	alrmSmoke: { channel: 'smoke', mapping: 'smoke_alarm_sound_detected' },
	alrmCmonx: { channel: 'carbon_monoxide', mapping: 'co_alarm_sound_detected' },
	alrmGlassBreak: { channel: 'sound_detection.glass_break', mapping: 'sound_detected' },
	alrmBurglar: { channel: 'sound_detection.burglar_alarm', mapping: 'sound_detected' },
	alrmSiren: { channel: 'sound_detection.siren', mapping: 'sound_detected' },
	alrmBabyCry: { channel: 'sound_detection.baby_cry', mapping: 'sound_detected' },
	alrmSpeak: { channel: 'sound_detection.speech', mapping: 'sound_detected' },
	alrmBark: { channel: 'sound_detection.dog_bark', mapping: 'sound_detected' },
	alrmCarHorn: { channel: 'sound_detection.car_horn', mapping: 'sound_detected' },
});

const write = (channelIdentifier: string, mappingName: string, value: string | boolean): ProtectTargetWrite => ({
	channelIdentifier,
	mappingName,
	value,
});

const toggle = (channel: string, mapping: string): ProtectEventTarget => ({
	key: channel,
	start: [write(channel, mapping, true)],
	end: [write(channel, mapping, false)],
});

const SMART_OBJECT_TYPES: ReadonlySet<string> = new Set([
	'smartDetectZone',
	'smartDetectLine',
	'smartDetectLoiterZone',
]);

const FIXED: Readonly<Record<string, { kind: ProtectEventKind; targets: readonly ProtectEventTarget[] }>> =
	Object.freeze({
		motion: { kind: 'duration', targets: [toggle('motion', 'camera_motion_detected')] },
		sensorMotion: { kind: 'duration', targets: [toggle('motion', 'sensor_motion_detected')] },
		sensorAlarm: { kind: 'duration', targets: [toggle('smoke', 'sensor_smoke_detected')] },
		sensorWaterLeak: {
			kind: 'duration',
			targets: [
				{
					key: 'leak',
					start: [write('leak', 'leak_detected', true), write('leak', 'leak_level', 'high')],
					end: [write('leak', 'leak_detected', false), write('leak', 'leak_level', 'low')],
				},
			],
		},
		sensorOpened: {
			kind: 'instant',
			targets: [{ key: 'contact', start: [write('contact', 'contact_detected', true)], end: [] }],
		},
		sensorClosed: {
			kind: 'instant',
			targets: [{ key: 'contact', start: [write('contact', 'contact_detected', false)], end: [] }],
		},
		sensorTamper: {
			kind: 'latch',
			targets: [
				{
					key: 'tamper',
					start: [write('contact', 'contact_tampered', true), write('motion', 'sensor_motion_tampered', true)],
					end: [],
				},
			],
		},
		ring: { kind: 'ring', targets: [] },
		sensorBatteryLow: { kind: 'covered', targets: [] },
		lightMotion: { kind: 'unmapped', targets: [] },
	});

/** The R3 table. `unknownTypes` lists smartDetectTypes entries without a target; null means an unknown event type. */
export function resolveProtectEventTargets(
	type: string,
	smartDetectTypes: readonly string[],
): { kind: ProtectEventKind; targets: ProtectEventTarget[]; unknownTypes: string[] } | null {
	const isObject = SMART_OBJECT_TYPES.has(type);

	if (isObject || type === 'smartAudioDetect') {
		const targets = new Map<string, ProtectEventTarget>();
		const unknownTypes: string[] = [];

		for (const entry of smartDetectTypes) {
			let target: ProtectEventTarget | null = null;

			if (typeof entry === 'string' && isObject && Object.hasOwn(OBJECT_TYPES, entry)) {
				target = toggle(`object_detection.${OBJECT_TYPES[entry]}`, 'object_detected');
			} else if (typeof entry === 'string' && !isObject && Object.hasOwn(AUDIO_TYPES, entry)) {
				target = toggle(AUDIO_TYPES[entry].channel, AUDIO_TYPES[entry].mapping);
			}

			if (target === null) {
				unknownTypes.push(entry);
			} else if (!targets.has(target.key)) {
				targets.set(target.key, target);
			}
		}

		return { kind: 'duration', targets: [...targets.values()], unknownTypes };
	}

	if (!Object.hasOwn(FIXED, type)) {
		return null;
	}

	const entry = FIXED[type];

	return { kind: entry.kind, targets: [...entry.targets], unknownTypes: [] };
}

interface OpenEvent {
	protectDeviceId: string;
	type: string;
	kind: ProtectEventKind;
	targets: Map<string, ProtectEventTarget>;
	deadline: number;
}

const safeName = (value: unknown): string | null => (typeof value === 'string' && SAFE_NAME.test(value) ? value : null);

const detectionTypes = (item: Readonly<Record<string, unknown>>): string[] =>
	Array.isArray(item.smartDetectTypes) ? (item.smartDetectTypes as string[]) : [];

const isClosed = (end: unknown): boolean => end !== undefined && end !== null;

export class ProtectEventTracker {
	private readonly open = new Map<string, OpenEvent>();
	private readonly seen = new Map<string, true>();
	private readonly safetyTimeoutMs: number;
	private readonly maxSeen: number;
	private readonly maxOpen: number;

	constructor(options: { safetyTimeoutMs?: number; maxSeen?: number; maxOpen?: number } = {}) {
		this.safetyTimeoutMs = options.safetyTimeoutMs ?? PROTECT_EVENT_SAFETY_TIMEOUT_MS;
		this.maxSeen = options.maxSeen ?? PROTECT_MAX_SEEN_EVENTS;
		this.maxOpen = options.maxOpen ?? PROTECT_MAX_OPEN_EVENTS;
	}

	apply(frame: ProtectFrame, now: number): ProtectEventOutcome {
		if (frame.modelKey !== 'event') {
			return { effects: [], ignored: [{ reason: 'invalid', name: null }] };
		}

		return frame.action === 'add' ? this.applyAdd(frame, now) : this.applyChange(frame, now);
	}

	expire(now: number): ProtectEventEffect[] {
		const effects: ProtectEventEffect[] = [];

		for (const [id, event] of [...this.open]) {
			if (event.deadline <= now) {
				effects.push(...this.close(id, event));
			}
		}

		return effects;
	}

	nextDeadline(): number | null {
		let next: number | null = null;

		for (const event of this.open.values()) {
			if (next === null || event.deadline < next) {
				next = event.deadline;
			}
		}

		return next;
	}

	openTargets(protectDeviceId: string): ReadonlySet<string> {
		const keys = new Set<string>();

		for (const event of this.open.values()) {
			if (event.protectDeviceId === protectDeviceId) {
				for (const key of event.targets.keys()) {
					keys.add(key);
				}
			}
		}

		return keys;
	}

	clear(): void {
		this.open.clear();
		this.seen.clear();
	}

	private applyAdd(frame: ProtectFrame, now: number): ProtectEventOutcome {
		const { item, id } = frame;
		const { type, device, start } = item;
		const ignored: ProtectEventOutcome['ignored'] = [];

		if (
			typeof type !== 'string' ||
			typeof device !== 'string' ||
			!PROTECT_ID_PATTERN.test(device) ||
			(start !== undefined && start !== null && !(typeof start === 'number' && Number.isFinite(start)))
		) {
			return { effects: [], ignored: [{ reason: 'invalid', name: safeName(type) }] };
		}

		if (this.seen.has(id) || this.open.has(id)) {
			this.remember(id);

			return { effects: [], ignored: [{ reason: 'duplicate', name: safeName(type) }] };
		}

		this.remember(id);

		const resolved = resolveProtectEventTargets(type, detectionTypes(item));

		if (resolved === null) {
			return { effects: [], ignored: [{ reason: 'unknown_type', name: safeName(type) }] };
		}

		if (resolved.kind === 'covered' || resolved.kind === 'unmapped') {
			return {
				effects: [],
				ignored: [{ reason: resolved.kind === 'covered' ? 'covered_type' : 'unmapped_type', name: safeName(type) }],
			};
		}

		if (resolved.kind === 'ring') {
			return {
				effects: [
					{
						kind: 'ring',
						protectDeviceId: device,
						eventId: id,
						startedAt: typeof start === 'number' ? start : null,
					},
				],
				ignored,
			};
		}

		for (const unknown of resolved.unknownTypes) {
			ignored.push({ reason: 'unknown_detection_type', name: safeName(unknown) });
		}

		if (resolved.targets.length === 0) {
			if (ignored.length === 0) {
				ignored.push({ reason: 'unknown_detection_type', name: null });
			}

			return { effects: [], ignored };
		}

		const effects: ProtectEventEffect[] = [];

		if (resolved.kind === 'instant' || resolved.kind === 'latch') {
			effects.push({ kind: 'write', protectDeviceId: device, writes: resolved.targets.flatMap((t) => t.start) });

			return { effects, ignored };
		}

		const event: OpenEvent = {
			protectDeviceId: device,
			type,
			kind: resolved.kind,
			targets: new Map(),
			deadline: now + this.safetyTimeoutMs,
		};

		if (isClosed(item.end)) {
			this.pushWrite(effects, device, this.startWrites(event, resolved.targets));
			this.open.set(id, event);
			effects.push(...this.close(id, event));

			return { effects, ignored };
		}

		while (this.open.size >= this.maxOpen) {
			const [oldestId, oldest] = this.open.entries().next().value as [string, OpenEvent];

			effects.push(...this.close(oldestId, oldest));
		}

		this.pushWrite(effects, device, this.startWrites(event, resolved.targets));
		this.open.set(id, event);

		return { effects, ignored };
	}

	private applyChange(frame: ProtectFrame, now: number): ProtectEventOutcome {
		const event = this.open.get(frame.id);

		if (event === undefined) {
			// An event that is known but not open (ended, instant, ring, latch) has nothing left to change.
			return this.seen.has(frame.id)
				? { effects: [], ignored: [] }
				: { effects: [], ignored: [{ reason: 'unknown_event', name: null }] };
		}

		if (frame.action === 'remove') {
			return { effects: this.close(frame.id, event), ignored: [] };
		}

		const effects: ProtectEventEffect[] = [];
		const ignored: ProtectEventOutcome['ignored'] = [];

		if (Array.isArray(frame.item.smartDetectTypes)) {
			const resolved = resolveProtectEventTargets(event.type, detectionTypes(frame.item));

			if (resolved !== null) {
				for (const unknown of resolved.unknownTypes) {
					ignored.push({ reason: 'unknown_detection_type', name: safeName(unknown) });
				}

				this.pushWrite(
					effects,
					event.protectDeviceId,
					this.startWrites(
						event,
						resolved.targets.filter((target) => !event.targets.has(target.key)),
					),
				);
			}
		}

		if (isClosed(frame.item.end)) {
			effects.push(...this.close(frame.id, event));
		} else {
			event.deadline = now + this.safetyTimeoutMs;
		}

		return { effects, ignored };
	}

	/** Registers the targets on the event and returns the start writes of those that were off. */
	private startWrites(event: OpenEvent, targets: readonly ProtectEventTarget[]): ProtectTargetWrite[] {
		const writes: ProtectTargetWrite[] = [];

		for (const target of targets) {
			if (event.targets.has(target.key)) {
				continue;
			}

			const alreadyOn = this.holds(event.protectDeviceId, target.key);

			event.targets.set(target.key, target);

			if (!alreadyOn) {
				writes.push(...target.start);
			}
		}

		return writes;
	}

	private close(id: string, event: OpenEvent): ProtectEventEffect[] {
		this.open.delete(id);

		const writes: ProtectTargetWrite[] = [];

		for (const target of event.targets.values()) {
			if (!this.holds(event.protectDeviceId, target.key)) {
				writes.push(...target.end);
			}
		}

		const effects: ProtectEventEffect[] = [];

		this.pushWrite(effects, event.protectDeviceId, writes);

		return effects;
	}

	private holds(protectDeviceId: string, key: string): boolean {
		for (const event of this.open.values()) {
			if (event.protectDeviceId === protectDeviceId && event.targets.has(key)) {
				return true;
			}
		}

		return false;
	}

	private pushWrite(effects: ProtectEventEffect[], protectDeviceId: string, writes: ProtectTargetWrite[]): void {
		if (writes.length > 0) {
			effects.push({ kind: 'write', protectDeviceId, writes });
		}
	}

	private remember(id: string): void {
		this.seen.delete(id);
		this.seen.set(id, true);

		while (this.seen.size > this.maxSeen) {
			this.seen.delete(this.seen.keys().next().value as string);
		}
	}
}
