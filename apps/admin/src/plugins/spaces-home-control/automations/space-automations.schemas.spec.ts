import { describe, expect, it } from 'vitest';

import { checkNodeConfig } from '../../../modules/automations/nodes/nodes.schemas';

import { SPACE_AUTOMATION_NODE_TYPES } from './space-automations.constants';
import {
	SPACE_AUTOMATION_CONFIG_SCHEMAS,
	SpaceLightingIntentConfigSchema,
	SpaceModeChangedConfigSchema,
	SpaceModeIsConfigSchema,
	SpaceModeSetConfigSchema,
	SpaceOccupancyChangedConfigSchema,
	SpaceOccupancyIsConfigSchema,
} from './space-automations.schemas';

const SPACE = '6f1a0e1c-7d4b-4c55-9f3e-3b6c2c1b0a07';

const key = (name: string): string => `spacesHomeControlPlugin.automations.validation.${name}`;

describe('space card schemas', (): void => {
	it('has a schema for every space card', (): void => {
		expect(Object.keys(SPACE_AUTOMATION_CONFIG_SCHEMAS).sort()).toEqual([...SPACE_AUTOMATION_NODE_TYPES].sort());
	});

	it('every space card needs a room or a zone', (): void => {
		for (const schema of Object.values(SPACE_AUTOMATION_CONFIG_SCHEMAS)) {
			expect(checkNodeConfig(schema, { space_id: 'kitchen' })).toEqual({ space_id: [key('space')] });
		}
	});

	it('occupancy is occupied or vacant, and the trigger goes either way unless told', (): void => {
		expect(SpaceOccupancyChangedConfigSchema.safeParse({ space_id: SPACE }).success).toBe(true);
		expect(SpaceOccupancyChangedConfigSchema.safeParse({ space_id: SPACE, to: 'vacant' }).success).toBe(true);
		expect(checkNodeConfig(SpaceOccupancyChangedConfigSchema, { space_id: SPACE, to: 'unknown' })).toEqual({ to: [key('occupancy')] });
		expect(SpaceOccupancyIsConfigSchema.safeParse({ space_id: SPACE, state: 'occupied' }).success).toBe(true);
		expect(SpaceOccupancyIsConfigSchema.safeParse({ space_id: SPACE }).success).toBe(false);
	});

	it('a mode changes to another mode, never to the same', (): void => {
		expect(SpaceModeChangedConfigSchema.safeParse({ space_id: SPACE, from: 'relax', to: 'sleep' }).success).toBe(true);
		expect(checkNodeConfig(SpaceModeChangedConfigSchema, { space_id: SPACE, from: 'away', to: 'away' })).toEqual({ to: [key('sameState')] });
		expect(checkNodeConfig(SpaceModeChangedConfigSchema, { space_id: SPACE, to: 'party' })).toEqual({ to: [key('activityMode')] });
	});

	it('mode is takes different modes, at least one', (): void => {
		expect(SpaceModeIsConfigSchema.safeParse({ space_id: SPACE, modes: ['sleep', 'away'] }).success).toBe(true);
		expect(checkNodeConfig(SpaceModeIsConfigSchema, { space_id: SPACE, modes: [] })).toEqual({ modes: [key('activityModes')] });
		expect(checkNodeConfig(SpaceModeIsConfigSchema, { space_id: SPACE, modes: ['sleep', 'sleep'] })).toEqual({
			modes: ['automations.editor.validation.listTwice'],
		});
	});

	it('set mode takes one mode', (): void => {
		expect(SpaceModeSetConfigSchema.safeParse({ space_id: SPACE, mode: 'work' }).success).toBe(true);
		expect(checkNodeConfig(SpaceModeSetConfigSchema, { space_id: SPACE, mode: 'party' })).toEqual({ mode: [key('activityMode')] });
	});

	describe('space lighting', (): void => {
		it.each([
			['on', {}],
			['off', {}],
			['set_mode', { mode: 'relax' }],
			['role_on', { role: 'ambient' }],
			['role_off', { role: 'night' }],
			['role_brightness', { role: 'main', brightness: 40 }],
		])('takes %s with its own fields', (intent, fields): void => {
			expect(SpaceLightingIntentConfigSchema.safeParse({ space_id: SPACE, intent, ...fields }).success).toBe(true);
		});

		it('refuses a field the intent chosen does not use, as the backend does', (): void => {
			expect(checkNodeConfig(SpaceLightingIntentConfigSchema, { space_id: SPACE, intent: 'on', mode: 'relax' })).toEqual({
				mode: [key('notUsedByIntent')],
			});
			expect(checkNodeConfig(SpaceLightingIntentConfigSchema, { space_id: SPACE, intent: 'role_on', role: 'main', brightness: 10 })).toEqual({
				brightness: [key('notUsedByIntent')],
			});
		});

		it.each([
			['set_mode', ['mode']],
			['role_on', ['role']],
			['role_off', ['role']],
			['role_brightness', ['role', 'brightness']],
		])('needs the fields %s uses, while keeping them quiet until they are entered', (intent, fields): void => {
			expect(SpaceLightingIntentConfigSchema.safeParse({ space_id: SPACE, intent }).success).toBe(false);
			expect(checkNodeConfig(SpaceLightingIntentConfigSchema, { space_id: SPACE, intent })).toEqual({});

			const issues = SpaceLightingIntentConfigSchema.safeParse({ space_id: SPACE, intent }).error?.issues ?? [];

			expect(issues.map((issue) => issue.path.join('.')).sort()).toEqual([...fields].sort());
			expect(issues.every((issue) => issue.message === key('required'))).toBe(true);
		});

		it('refuses the hidden role and a brightness out of range', (): void => {
			expect(checkNodeConfig(SpaceLightingIntentConfigSchema, { space_id: SPACE, intent: 'role_on', role: 'hidden' })).toEqual({
				role: [key('lightingRole')],
			});
			expect(checkNodeConfig(SpaceLightingIntentConfigSchema, { space_id: SPACE, intent: 'role_brightness', role: 'main', brightness: 101 })).toEqual(
				{
					brightness: [key('brightness')],
				}
			);
			expect(checkNodeConfig(SpaceLightingIntentConfigSchema, { space_id: SPACE, intent: 'role_brightness', role: 'main', brightness: 5.5 })).toEqual(
				{
					brightness: [key('brightness')],
				}
			);
		});
	});
});
