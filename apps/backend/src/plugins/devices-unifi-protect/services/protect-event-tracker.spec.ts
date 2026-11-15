import { readFileSync } from 'fs';
import { join } from 'path';

import { ProtectEventEffect, ProtectEventTracker, ProtectTargetWrite } from './protect-event-tracker';
import { ProtectFrame, parseProtectFrame } from './protect-frame-merge';

const CAMERA = '600cefafd5f365d6f83c4ef3';
const SENSOR = '5f0000000000000000000b01';
const DOORBELL = '5f0000000000000000000a01';

const loadFrames = (): ProtectFrame[] =>
	readFileSync(join(__dirname, '..', '__fixtures__', 'ws-events.jsonl'), 'utf8')
		.split('\n')
		.filter((line) => line.trim() !== '')
		.map((line) => {
			const parsed = parseProtectFrame(line);

			if (!('frame' in parsed)) {
				throw new Error('fixture frame rejected');
			}

			return parsed.frame;
		});

const FRAMES = loadFrames();
const pair = (suffix: string): ProtectFrame[] => FRAMES.filter((frame) => frame.id.endsWith(suffix));
const eid = (n: number): string => `5f00000000000000000e${String(n).padStart(4, '0')}`;

const frame = (action: 'add' | 'update' | 'remove', item: Record<string, unknown>): ProtectFrame => ({
	action,
	id: item.id as string,
	modelKey: 'event',
	item: { modelKey: 'event', ...item },
});

const add = (n: number, type: string, extra: Record<string, unknown> = {}, device = CAMERA): ProtectFrame =>
	frame('add', { id: eid(n), type, device, start: 1000, end: null, ...extra });

const finish = (n: number, extra: Record<string, unknown> = {}): ProtectFrame =>
	frame('update', { id: eid(n), end: 2000, ...extra });

const writesOf = (effects: ProtectEventEffect[]): ProtectTargetWrite[] =>
	effects.flatMap((effect) => (effect.kind === 'write' ? effect.writes : []));

const summary = (writes: ProtectTargetWrite[]): string[] =>
	writes.map((write) => `${write.channelIdentifier}/${write.mappingName}=${String(write.value)}`);

describe('ProtectEventTracker', () => {
	it('maps every recorded event type to its channels', () => {
		const tracker = new ProtectEventTracker();
		const byEvent = new Map<string, string[]>();
		let now = 0;

		for (const entry of FRAMES) {
			const outcome = tracker.apply(entry, now++);

			byEvent.set(entry.id, [...(byEvent.get(entry.id) ?? []), ...summary(writesOf(outcome.effects))]);
		}

		expect(byEvent.get(eid(1))).toEqual(['motion/camera_motion_detected=true', 'motion/camera_motion_detected=false']);
		expect(byEvent.get(eid(2))).toEqual([
			'object_detection.person/object_detected=true',
			'object_detection.person/object_detected=false',
		]);
		expect(byEvent.get(eid(3))).toEqual([
			'object_detection.vehicle/object_detected=true',
			'object_detection.vehicle/object_detected=false',
		]);
		expect(byEvent.get(eid(4))).toEqual([
			'object_detection.person/object_detected=true',
			'object_detection.person/object_detected=false',
		]);
		expect(byEvent.get(eid(5))).toEqual([
			'smoke/smoke_alarm_sound_detected=true',
			'smoke/smoke_alarm_sound_detected=false',
		]);
		expect(byEvent.get(eid(6))).toEqual([
			'sound_detection.baby_cry/sound_detected=true',
			'sound_detection.baby_cry/sound_detected=false',
		]);
		expect(byEvent.get(eid(8))).toEqual(['contact/contact_detected=true']);
		expect(byEvent.get(eid(9))).toEqual(['contact/contact_detected=false']);
		expect(byEvent.get(eid(10))).toEqual(['motion/sensor_motion_detected=true', 'motion/sensor_motion_detected=false']);
		expect(byEvent.get(eid(11))).toEqual([
			'leak/leak_detected=true',
			'leak/leak_level=high',
			'leak/leak_detected=false',
			'leak/leak_level=low',
		]);
		expect(byEvent.get(eid(14))).toEqual([
			'object_detection.animal/object_detected=true',
			'object_detection.animal/object_detected=false',
		]);
		expect(byEvent.get(eid(15))).toEqual([
			'object_detection.person/object_detected=true',
			'object_detection.vehicle/object_detected=true',
			'object_detection.person/object_detected=false',
			'object_detection.vehicle/object_detected=false',
		]);
		expect(byEvent.get(eid(16))).toEqual([
			'carbon_monoxide/co_alarm_sound_detected=true',
			'carbon_monoxide/co_alarm_sound_detected=false',
		]);
		expect(byEvent.get(eid(17))).toEqual(['smoke/sensor_smoke_detected=true', 'smoke/sensor_smoke_detected=false']);
		expect(tracker.nextDeadline()).toBeNull();
	});

	it('publishes a ring once on add and nothing on its end', () => {
		const tracker = new ProtectEventTracker();
		const [start, end] = pair('e0007');

		expect(tracker.apply(start, 0).effects).toEqual([
			{ kind: 'ring', protectDeviceId: DOORBELL, eventId: eid(7), startedAt: 1794400007000 },
		]);

		const ended = tracker.apply(end, 1);

		expect(ended.effects).toEqual([]);
		expect(tracker.nextDeadline()).toBeNull();
	});

	it('latches tamper on both tampered properties and never times it out', () => {
		const tracker = new ProtectEventTracker();
		const [start, end] = pair('e0012');

		expect(summary(writesOf(tracker.apply(start, 0).effects))).toEqual([
			'contact/contact_tampered=true',
			'motion/sensor_motion_tampered=true',
		]);
		expect(tracker.apply(end, 1).effects).toEqual([]);
		expect(tracker.expire(1 + 10 * 60_000)).toEqual([]);
		expect(tracker.nextDeadline()).toBeNull();
	});

	it('ignores and names unknown, unmapped and covered types', () => {
		const tracker = new ProtectEventTracker();
		const first = (suffix: string): ProtectFrame => pair(suffix)[0];

		expect(tracker.apply(first('e0019'), 0)).toEqual({
			effects: [],
			ignored: [{ reason: 'unknown_type', name: 'sensorExtremeValues' }],
		});
		expect(tracker.apply(first('e0013'), 0).ignored).toEqual([{ reason: 'unmapped_type', name: 'lightMotion' }]);
		expect(tracker.apply(first('e0018'), 0).ignored).toEqual([{ reason: 'covered_type', name: 'sensorBatteryLow' }]);

		const pet = tracker.apply(first('e0020'), 0);

		expect(pet.effects).toEqual([]);
		expect(pet.ignored).toEqual([{ reason: 'unknown_detection_type', name: 'pet' }]);
	});

	it('keeps a target on until its last open event ends', () => {
		const tracker = new ProtectEventTracker();

		tracker.apply(add(1, 'motion'), 0);
		tracker.apply(add(2, 'motion'), 1);

		expect(tracker.openTargets(CAMERA)).toEqual(new Set(['motion']));
		expect(tracker.apply(finish(1), 2).effects).toEqual([]);
		expect(summary(writesOf(tracker.apply(finish(2), 3).effects))).toEqual(['motion/camera_motion_detected=false']);
		expect(tracker.openTargets(CAMERA).size).toBe(0);
	});

	it('opens a type added by an update', () => {
		const tracker = new ProtectEventTracker();

		tracker.apply(add(1, 'smartDetectZone', { smartDetectTypes: ['person'] }), 0);

		const grown = tracker.apply(frame('update', { id: eid(1), smartDetectTypes: ['person', 'vehicle'] }), 1);

		expect(summary(writesOf(grown.effects))).toEqual(['object_detection.vehicle/object_detected=true']);
		expect(tracker.openTargets(CAMERA)).toEqual(new Set(['object_detection.person', 'object_detection.vehicle']));
		expect(summary(writesOf(tracker.apply(finish(1), 2).effects)).sort()).toEqual([
			'object_detection.person/object_detected=false',
			'object_detection.vehicle/object_detected=false',
		]);
	});

	it('clears a detection 60 s after its last frame and re-arms on update', () => {
		const tracker = new ProtectEventTracker();

		tracker.apply(add(1, 'motion'), 0);
		expect(tracker.nextDeadline()).toBe(60_000);
		tracker.apply(frame('update', { id: eid(1), end: null }), 50_000);

		expect(tracker.expire(100_000)).toEqual([]);
		expect(tracker.nextDeadline()).toBe(110_000);
		expect(summary(writesOf(tracker.expire(110_000)))).toEqual(['motion/camera_motion_detected=false']);
		expect(tracker.nextDeadline()).toBeNull();
		expect(tracker.openTargets(CAMERA).size).toBe(0);
	});

	it('drops an add for an event id it has already seen', () => {
		const tracker = new ProtectEventTracker();

		tracker.apply(add(1, 'motion'), 0);
		tracker.apply(finish(1), 1);

		const again = tracker.apply(add(1, 'motion'), 2);

		expect(again.effects).toEqual([]);
		expect(again.ignored).toEqual([{ reason: 'duplicate', name: 'motion' }]);
		expect(tracker.nextDeadline()).toBeNull();

		const ring = add(2, 'ring', {}, DOORBELL);

		expect(tracker.apply(ring, 3).effects).toHaveLength(1);
		expect(tracker.apply(ring, 4).effects).toEqual([]);
	});

	it('ignores updates for events it never saw', () => {
		const tracker = new ProtectEventTracker();

		expect(tracker.apply(finish(9), 0)).toEqual({ effects: [], ignored: [{ reason: 'unknown_event', name: null }] });
		expect(tracker.apply(frame('remove', { id: eid(9) }), 0).ignored).toEqual([
			{ reason: 'unknown_event', name: null },
		]);
	});

	it('applies an add that already carries its end', () => {
		const tracker = new ProtectEventTracker();
		const outcome = tracker.apply(add(1, 'motion', { end: 1500 }), 0);

		expect(summary(writesOf(outcome.effects))).toEqual([
			'motion/camera_motion_detected=true',
			'motion/camera_motion_detected=false',
		]);
		expect(tracker.nextDeadline()).toBeNull();
	});

	it('closes an open event on remove', () => {
		const tracker = new ProtectEventTracker();

		tracker.apply(add(1, 'motion'), 0);

		expect(summary(writesOf(tracker.apply(frame('remove', { id: eid(1) }), 1).effects))).toEqual([
			'motion/camera_motion_detected=false',
		]);
	});

	it('bounds open and seen events', () => {
		const open = new ProtectEventTracker({ maxOpen: 2 });

		open.apply(add(1, 'motion'), 0);
		open.apply(add(2, 'sensorMotion', {}, SENSOR), 1);

		const third = open.apply(add(3, 'sensorWaterLeak', {}, SENSOR), 2);

		expect(summary(writesOf(third.effects))).toEqual([
			'motion/camera_motion_detected=false',
			'leak/leak_detected=true',
			'leak/leak_level=high',
		]);
		expect(open.openTargets(CAMERA).size).toBe(0);

		const seen = new ProtectEventTracker({ maxSeen: 3 });

		for (let n = 1; n <= 4; n++) {
			seen.apply(add(n, 'sensorOpened', {}, SENSOR), n);
		}

		expect(seen.apply(add(1, 'sensorOpened', {}, SENSOR), 5).ignored).toEqual([]);
		expect(seen.apply(add(4, 'sensorOpened', {}, SENSOR), 6).ignored).toEqual([
			{ reason: 'duplicate', name: 'sensorOpened' },
		]);
	});

	it('rejects malformed event adds', () => {
		const tracker = new ProtectEventTracker();

		for (const bad of [
			frame('add', { id: eid(1), type: 'motion', start: 1 }),
			add(2, 'motion', { device: '../x' }),
			add(3, 'motion', { type: 42 }),
			add(4, 'motion', { start: 'now' }),
		]) {
			const outcome = tracker.apply(bad, 0);

			expect(outcome.effects).toEqual([]);
			expect(outcome.ignored.map((entry) => entry.reason)).toEqual(['invalid']);
		}

		expect(tracker.nextDeadline()).toBeNull();
	});

	it('names an unsafe type as null', () => {
		const tracker = new ProtectEventTracker();

		expect(tracker.apply(add(1, 'a b'), 0).ignored).toEqual([{ reason: 'unknown_type', name: null }]);
	});

	it('forgets everything on clear', () => {
		const tracker = new ProtectEventTracker();

		tracker.apply(add(1, 'motion'), 0);
		tracker.clear();

		expect(tracker.nextDeadline()).toBeNull();
		expect(tracker.openTargets(CAMERA).size).toBe(0);
		expect(tracker.apply(add(1, 'motion'), 1).ignored).toEqual([]);
	});
});
