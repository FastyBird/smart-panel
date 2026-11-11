import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../devices/devices.constants';
import { AutomationActionCommand } from '../graph/node-type';

import {
	ActionSafetyPolicy,
	SAFETY_UNREADABLE_SCENE_ACTION_REASON,
	SafetySceneAction,
	describeSceneSafetyRefusal,
} from './action-safety-policy';
import { SafetyWriteTarget } from './safety-rules';

const LOCK = 'lock-status';
const ALARM = 'alarm-state';
const DOOR = 'door-position';
const LIGHT = 'light-on';
const SCENE = 'scene-1';

const TARGETS: Record<string, SafetyWriteTarget> = {
	[LOCK]: {
		deviceCategory: DeviceCategory.LOCK,
		channelCategory: ChannelCategory.LOCK,
		propertyCategory: PropertyCategory.STATUS,
	},
	[ALARM]: {
		deviceCategory: DeviceCategory.ALARM,
		channelCategory: ChannelCategory.ALARM,
		propertyCategory: PropertyCategory.STATE,
	},
	[DOOR]: {
		deviceCategory: DeviceCategory.DOOR,
		channelCategory: ChannelCategory.DOOR,
		propertyCategory: PropertyCategory.POSITION,
	},
	[LIGHT]: {
		deviceCategory: DeviceCategory.LIGHTING,
		channelCategory: ChannelCategory.LIGHT,
		propertyCategory: PropertyCategory.ON,
	},
};

const write = (propertyId: string, value: unknown, field?: string): AutomationActionCommand => ({
	kind: 'property_write',
	propertyId,
	value,
	...(field !== undefined ? { field } : {}),
});

describe('ActionSafetyPolicy', () => {
	let findTarget: jest.Mock;
	let listSceneActions: jest.Mock;
	let scene: SafetySceneAction[] | null;
	let policy: ActionSafetyPolicy;

	beforeEach(() => {
		scene = [];
		findTarget = jest.fn((propertyId: string) => Promise.resolve(TARGETS[propertyId] ?? null));
		listSceneActions = jest.fn(() => Promise.resolve(scene));
		policy = new ActionSafetyPolicy({ findTarget, listSceneActions });
	});

	describe('writes', () => {
		it('finds a write that reduces safety and names its field', async () => {
			expect(
				await policy.inspect([write(LIGHT, true, 'writes.0.value'), write(LOCK, 'unlocked', 'writes.1.value')]),
			).toEqual([
				{ kind: 'unlock', via: 'write', reason: 'An automation can not unlock a lock.', field: 'writes.1.value' },
			]);
		});

		it('finds every one of them', async () => {
			const findings = await policy.inspect([write(LOCK, 'unlocked'), write(ALARM, 'disarmed'), write(DOOR, 'open')]);

			expect(findings.map((finding) => finding.kind)).toEqual(['unlock', 'disarm', 'open']);
			expect(findings.every((finding) => finding.via === 'write' && finding.field === undefined)).toBe(true);
		});

		it('lets locking, arming and closing through', async () => {
			expect(await policy.inspect([write(LOCK, 'locked'), write(ALARM, 'armed_away'), write(DOOR, 'close')])).toEqual(
				[],
			);
		});

		it('has nothing to say about a property that does not exist', async () => {
			expect(await policy.inspect([write('gone', 'unlocked')])).toEqual([]);
		});

		it('looks a property up once however often it is written', async () => {
			await policy.inspect([write(LOCK, 'locked'), write(LOCK, 'unlocked')]);

			expect(findTarget).toHaveBeenCalledTimes(1);
		});

		it('rejects when a property could not be looked up', async () => {
			findTarget.mockRejectedValue(new Error('database is locked'));

			await expect(policy.inspect([write(LOCK, 'locked')])).rejects.toThrow('database is locked');
		});

		it('has nothing to say about an action that does nothing to the home', async () => {
			expect(await policy.inspect([])).toEqual([]);
			expect(findTarget).not.toHaveBeenCalled();
			expect(listSceneActions).not.toHaveBeenCalled();
		});
	});

	describe('scenes', () => {
		const run: AutomationActionCommand = { kind: 'scene_run', sceneId: SCENE, field: 'scene_id' };

		it('opens the scene and finds what one of its actions would do', async () => {
			scene = [
				{ propertyId: LIGHT, value: false },
				{ propertyId: LOCK, value: 'unlocked' },
			];

			expect(await policy.inspect([run])).toEqual([
				{ kind: 'unlock', via: 'scene', reason: describeSceneSafetyRefusal('unlock a lock'), field: 'scene_id' },
			]);
			expect(listSceneActions).toHaveBeenCalledWith(SCENE);
		});

		it('reads the scene every time it is asked, so an edited scene is judged as it is now', async () => {
			scene = [{ propertyId: LIGHT, value: true }];

			expect(await policy.inspect([run])).toEqual([]);

			scene = [
				{ propertyId: LIGHT, value: true },
				{ propertyId: ALARM, value: 'disarmed' },
			];

			expect((await policy.inspect([run])).map((finding) => finding.kind)).toEqual(['disarm']);
			expect(listSceneActions).toHaveBeenCalledTimes(2);
		});

		it('reports each kind once', async () => {
			scene = [
				{ propertyId: DOOR, value: 'open' },
				{ propertyId: DOOR, value: 60 },
				{ propertyId: LOCK, value: 'unlocked' },
			];

			expect((await policy.inspect([run])).map((finding) => finding.kind)).toEqual(['open', 'unlock']);
		});

		it('lets a scene that locks, arms and closes through', async () => {
			scene = [
				{ propertyId: LOCK, value: 'locked' },
				{ propertyId: ALARM, value: 'armed_night' },
				{ propertyId: DOOR, value: 'close' },
				{ propertyId: LIGHT, value: false },
			];

			expect(await policy.inspect([run])).toEqual([]);
		});

		it('does not let an action it can not read through', async () => {
			scene = [
				{ propertyId: LIGHT, value: true },
				{ propertyId: null, value: undefined },
			];

			expect(await policy.inspect([run])).toEqual([
				{ kind: 'unreadable', via: 'scene', reason: SAFETY_UNREADABLE_SCENE_ACTION_REASON, field: 'scene_id' },
			]);
		});

		it('has nothing to say about a scene that does not exist or is empty', async () => {
			scene = null;

			expect(await policy.inspect([run])).toEqual([]);

			scene = [];

			expect(await policy.inspect([run])).toEqual([]);
		});

		it('rejects when the scene could not be read', async () => {
			listSceneActions.mockRejectedValue(new Error('no connection'));

			await expect(policy.inspect([run])).rejects.toThrow('no connection');
		});

		it('judges a list of scene actions it is handed', async () => {
			expect(
				await policy.inspectSceneActions([
					{ propertyId: LIGHT, value: true },
					{ propertyId: ALARM, value: 'disarmed' },
				]),
			).toEqual([{ kind: 'disarm', via: 'scene', reason: describeSceneSafetyRefusal('disarm the alarm') }]);
			expect(await policy.inspectSceneActions([{ propertyId: ALARM, value: 'armed_home' }])).toEqual([]);
			expect(listSceneActions).not.toHaveBeenCalled();
		});
	});
});
