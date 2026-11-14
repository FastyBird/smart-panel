import { describe, expect, it } from 'vitest';

import { SPACE_AUTOMATION_NODE_TYPES } from './space-automations.constants';
import { type ISpaceAutomationSummaryContext, summarizeSpaceNode } from './space-automations.summaries';

// Shows the key and its parameters, so a test reads what the summary is made of
const t = (key: string, params?: Record<string, unknown>): string => {
	const name = key.replace('spacesHomeControlPlugin.automations.', '').replace('spacesHomeControlPlugin.', '').replace('automations.editor.', '');

	return params
		? `${name}(${Object.entries(params)
				.map(([param, value]) => `${param}=${String(value)}`)
				.join(', ')})`
		: name;
};

const context: ISpaceAutomationSummaryContext = {
	t,
	spaceName: (id) => (id === 's-living' ? 'Living room' : null),
};

const summary = (type: string, config: Record<string, unknown>): string | null => summarizeSpaceNode(type, config, context);

const living = { space_id: 's-living' };

describe('space card summaries', (): void => {
	it('read the occupancy cards', (): void => {
		expect(summary('space.occupancy.changed', living)).toBe('summaries.occupancyChanged.any(space=Living room)');
		expect(summary('space.occupancy.changed', { ...living, to: 'vacant' })).toBe('summaries.occupancyChanged.vacant(space=Living room)');
		expect(summary('space.occupancy.is', { ...living, state: 'occupied' })).toBe('summaries.occupancyIs.occupied(space=Living room)');
	});

	it('read the activity mode cards', (): void => {
		expect(summary('space.mode.changed', { ...living, to: 'sleep' })).toBe(
			'summaries.change.to(subject=summaries.modeOf(space=Living room), to=activityModes.modes.sleep)'
		);
		expect(summary('space.mode.is', { ...living, modes: ['away', 'sleep'] })).toBe(
			'summaries.modeIs(space=Living room, modes=summaries.alternatives(first=activityModes.modes.sleep, last=activityModes.modes.away))'
		);
		expect(summary('space.mode.set', { ...living, mode: 'relax' })).toBe('summaries.modeSet(space=Living room, mode=activityModes.modes.relax)');
	});

	it('read the lighting intents', (): void => {
		expect(summary('space.lighting.intent', { ...living, intent: 'off' })).toContain('summaries.lighting.off(space=Living room');
		expect(summary('space.lighting.intent', { ...living, intent: 'set_mode', mode: 'night' })).toContain('mode=activityModes.lightingModes.night');
		expect(summary('space.lighting.intent', { ...living, intent: 'role_brightness', role: 'ambient', brightness: 30 })).toBe(
			'summaries.lighting.role_brightness(space=Living room, mode=, role=lightingRoles.ambient, brightness=30)'
		);
	});

	it('say a card is not configured while it is not configured far enough', (): void => {
		for (const type of SPACE_AUTOMATION_NODE_TYPES) {
			expect(summary(type, {}), type).toBe('texts.notConfigured');
		}

		expect(summary('space.occupancy.is', living)).toBe('texts.notConfigured');
		expect(summary('space.mode.is', { ...living, modes: [] })).toBe('texts.notConfigured');
		expect(summary('space.lighting.intent', { ...living, intent: 'set_mode' })).toBe('texts.notConfigured');
		expect(summary('space.lighting.intent', { ...living, intent: 'role_brightness', role: 'main' })).toBe('texts.notConfigured');
	});

	it('say "unknown" for a space that is not known', (): void => {
		expect(summary('space.occupancy.changed', { space_id: 's-gone' })).toBe('summaries.occupancyChanged.any(space=summaries.unknownSpace)');
	});

	it('leave a card the plugin does not provide alone', (): void => {
		expect(summary('scene.run', living)).toBeNull();
		expect(summary('toString', living)).toBeNull();
	});
});
