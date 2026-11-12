import type { Component } from 'vue';

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { AUTOMATIONS_MODULE_NAME } from '../automations.constants';
import { AUTOMATION_BUILT_IN_NODE_ELEMENTS } from '../nodes/nodes.elements';

import { useAutomationNodePlugins } from './useAutomationNodePlugins';

// Only told apart by identity here, never rendered
const SpaceForm: Component = { name: 'SpaceForm' };
const SpaceCard: Component = { name: 'SpaceCard' };
const BetterDelayForm: Component = { name: 'BetterDelayForm' };
const spaceSchema = z.object({ space_id: z.string() });

const links = { documentation: '', devDocumentation: '', bugsTracking: '' };

const mocks = vi.hoisted(() => ({ plugins: [] as unknown[], modules: [] as unknown[] }));

vi.mock('../../../common', () => ({
	injectPluginsManager: () => ({ getPlugins: () => mocks.plugins }),
	injectModulesManager: () => ({ getModules: () => mocks.modules }),
}));

mocks.plugins = [
	{
		type: 'spaces-home-control',
		source: 'source',
		name: 'Home control',
		description: '',
		links,
		elements: [
			{
				type: 'spaces.occupancy.changed',
				components: { automationNodeForm: SpaceForm, automationNodeCard: SpaceCard },
				schemas: { automationNodeConfigSchema: spaceSchema },
				modules: [AUTOMATIONS_MODULE_NAME],
			},
			// An element of the plugin for another module is not a card, even with a matching type
			{ type: 'spaces.mode.set', components: { automationNodeForm: SpaceForm }, modules: ['scenes-module'] },
			{ type: 'flow.delay', components: { automationNodeForm: BetterDelayForm }, modules: [AUTOMATIONS_MODULE_NAME] },
		],
		modules: [AUTOMATIONS_MODULE_NAME],
		isCore: false,
	},
	{
		type: 'unrelated',
		source: 'source',
		name: 'Unrelated',
		description: '',
		links,
		elements: [{ type: 'time.window', components: { automationNodeForm: SpaceForm }, modules: [AUTOMATIONS_MODULE_NAME] }],
		modules: ['devices-module'],
		isCore: false,
	},
];

mocks.modules = [{ type: AUTOMATIONS_MODULE_NAME, name: 'Automations', elements: AUTOMATION_BUILT_IN_NODE_ELEMENTS, isCore: true }];

describe('useAutomationNodePlugins', (): void => {
	it('finds the form, the summary and the schema a plugin brings for its card', (): void => {
		const { getFormComponent, getCardComponent, getConfigSchema } = useAutomationNodePlugins();

		expect(getFormComponent('spaces.occupancy.changed')).toBe(SpaceForm);
		expect(getCardComponent('spaces.occupancy.changed')).toBe(SpaceCard);
		expect(getConfigSchema('spaces.occupancy.changed')).toBe(spaceSchema);
	});

	it('finds the cards the automations module registers itself', (): void => {
		const { getFormComponent, getCardComponent, getConfigSchema } = useAutomationNodePlugins();

		for (const type of ['device.property.changed', 'device.property.set', 'time.of-day', 'scene.run', 'notification.send', 'manual.start']) {
			expect(getFormComponent(type), type).not.toBeNull();
			expect(getCardComponent(type), type).not.toBeNull();
			expect(getConfigSchema(type), type).not.toBeNull();
		}
	});

	it('asks the plugins first, so a plugin can bring a better form for a card of a module', (): void => {
		expect(useAutomationNodePlugins().getFormComponent('flow.delay')).toBe(BetterDelayForm);
	});

	it('leaves a card without an element of the automations module to the generic form', (): void => {
		const { getFormComponent, getCardComponent, getElement } = useAutomationNodePlugins();

		expect(getFormComponent('spaces.mode.set')).toBeNull();
		expect(getCardComponent('third-party.card')).toBeNull();
		expect(getElement('third-party.card')).toBeUndefined();
		// The plugin that is not for the automations module does not replace the module's own form
		expect(getFormComponent('time.window')).not.toBe(SpaceForm);
	});
});
