import { describe, expect, it, vi } from 'vitest';

import { AUTOMATIONS_MODULE_NAME } from '../../../modules/automations/automations.constants';
import AutomationNodeGenericForm from '../../../modules/automations/components/canvas/automation-node-generic-form.vue';
import { useAutomationNodePlugins } from '../../../modules/automations/composables/useAutomationNodePlugins';
import { AUTOMATION_BUILT_IN_NODE_ELEMENTS, AUTOMATION_GENERIC_FORM_NODE_TYPES } from '../../../modules/automations/nodes/nodes.elements';
import SpaceAutomationNodeSummary from '../components/automations/space-automation-node-summary.vue';
import { SPACES_HOME_CONTROL_PLUGIN_NAME } from '../spaces-home-control.constants';

import { SPACE_AUTOMATION_NODE_TYPES } from './space-automations.constants';
import { SPACE_AUTOMATION_NODE_ELEMENTS } from './space-automations.elements';

/*
 * Every card the backend catalogue lists - the cards of the automations module and the space cards of this
 * plugin - listed by hand on purpose. Each has to resolve to a form of its own, or to the generic form only
 * where the automations module says so, so no card falls back to the generic form by accident.
 */
const BACKEND_CATALOGUE: string[] = [
	'device.property.changed',
	'device.button.pressed',
	'device.connection.changed',
	'time.of-day',
	'sun.event',
	'scene.was-run',
	'house-mode.changed',
	'security.state.changed',
	'manual.start',
	'device.property.compare',
	'time.window',
	'sun.daylight',
	'house-mode.is',
	'security.armed.is',
	'device.property.set',
	'scene.run',
	'notification.send',
	'house-mode.set',
	'security.arm',
	'automation.enable',
	'automation.disable',
	'automation.run',
	'flow.delay',
	'flow.wait-until',
	'flow.any',
	'flow.all',
	// spaces-home-control
	'space.occupancy.changed',
	'space.occupancy.is',
	'space.mode.changed',
	'space.mode.is',
	'space.mode.set',
	'space.lighting.intent',
];

const BACKEND_SPACE_CARDS = BACKEND_CATALOGUE.filter((type) => type.startsWith('space.'));

const mocks = vi.hoisted(() => ({ plugins: [] as unknown[], modules: [] as unknown[] }));

vi.mock('../../../common', () => ({
	injectPluginsManager: () => ({ getPlugins: () => mocks.plugins }),
	injectModulesManager: () => ({ getModules: () => mocks.modules }),
}));

mocks.plugins = [
	{
		type: SPACES_HOME_CONTROL_PLUGIN_NAME,
		source: 'source',
		name: 'Home Control Spaces',
		description: '',
		links: { documentation: '', devDocumentation: '', bugsTracking: '' },
		elements: SPACE_AUTOMATION_NODE_ELEMENTS,
		modules: ['spaces-module', AUTOMATIONS_MODULE_NAME],
		isCore: true,
	},
];

mocks.modules = [{ type: AUTOMATIONS_MODULE_NAME, name: 'Automations', elements: AUTOMATION_BUILT_IN_NODE_ELEMENTS, isCore: true }];

describe('automation card catalogue', (): void => {
	it('brings an element for every space card the backend provides, and no other', (): void => {
		expect([...SPACE_AUTOMATION_NODE_TYPES].sort()).toEqual([...BACKEND_SPACE_CARDS].sort());
		expect(SPACE_AUTOMATION_NODE_ELEMENTS.map((element) => element.type).sort()).toEqual([...BACKEND_SPACE_CARDS].sort());
	});

	it.each(BACKEND_CATALOGUE)('%s resolves to its form, its summary and its schema', (type): void => {
		const { getFormComponent, getCardComponent, getConfigSchema } = useAutomationNodePlugins();

		const form = getFormComponent(type);

		expect(form).not.toBeNull();
		expect(getCardComponent(type)).not.toBeNull();
		expect(getConfigSchema(type)).not.toBeNull();

		// The generic form only where the automations module serves a card with it on purpose
		expect(form === AutomationNodeGenericForm).toBe((AUTOMATION_GENERIC_FORM_NODE_TYPES as string[]).includes(type));
	});

	it('shows the space cards with the summary of the plugin', (): void => {
		const { getCardComponent } = useAutomationNodePlugins();

		for (const type of BACKEND_SPACE_CARDS) {
			expect(getCardComponent(type), type).toBe(SpaceAutomationNodeSummary);
		}
	});
});
