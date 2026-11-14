import { describe, expect, it } from 'vitest';

import AutomationNodeGenericForm from '../components/canvas/automation-node-generic-form.vue';
import AutomationNodeSummary from '../components/nodes/automation-node-summary.vue';

import { AUTOMATION_BUILT_IN_NODE_TYPES } from './nodes.constants';
import { AUTOMATION_BUILT_IN_NODE_ELEMENTS, AUTOMATION_GENERIC_FORM_NODE_TYPES } from './nodes.elements';
import { checkNodeConfig } from './nodes.schemas';
import { summarizeBuiltInNode } from './nodes.summaries';

/*
 * Every card the backend registers itself (`modules/automations/nodes/built-in-node-types.service.ts`),
 * listed by hand on purpose: a card added there without a form here fails this test rather than falling
 * back to the generic form unnoticed. The cards of plugins are checked by their plugins.
 */
const BACKEND_BUILT_IN_NODE_TYPES: string[] = [
	// Triggers
	'device.property.changed',
	'device.button.pressed',
	'device.connection.changed',
	'time.of-day',
	'sun.event',
	'scene.was-run',
	'house-mode.changed',
	'security.state.changed',
	'manual.start',
	// Conditions
	'device.property.compare',
	'time.window',
	'sun.daylight',
	'house-mode.is',
	'security.armed.is',
	// Actions
	'device.property.set',
	'scene.run',
	'notification.send',
	'house-mode.set',
	'security.arm',
	'automation.enable',
	'automation.disable',
	'automation.run',
	// Flow
	'flow.delay',
	'flow.wait-until',
	'flow.any',
	'flow.all',
];

// The cards the generic form serves on purpose: they have nothing to configure
const DELIBERATELY_GENERIC: string[] = ['flow.any', 'flow.all'];

const t = (key: string): string => key;

const lookups = { device: () => null, channel: () => null, property: () => null, scene: () => null, automation: () => null };

describe('built-in card catalogue', (): void => {
	it('provides every card the backend provides, and no other', (): void => {
		expect([...AUTOMATION_BUILT_IN_NODE_TYPES].sort()).toEqual([...BACKEND_BUILT_IN_NODE_TYPES].sort());
		expect(AUTOMATION_BUILT_IN_NODE_ELEMENTS.map((element) => element.type).sort()).toEqual([...BACKEND_BUILT_IN_NODE_TYPES].sort());
	});

	it('names the cards it leaves to the generic form', (): void => {
		expect([...AUTOMATION_GENERIC_FORM_NODE_TYPES].sort()).toEqual([...DELIBERATELY_GENERIC].sort());
	});

	it.each(BACKEND_BUILT_IN_NODE_TYPES)('%s has a form, a summary and a schema', (type): void => {
		const element = AUTOMATION_BUILT_IN_NODE_ELEMENTS.find((item) => item.type === type);

		expect(element?.components?.automationNodeForm).toBeDefined();
		expect(element?.components?.automationNodeCard).toBe(AutomationNodeSummary);
		expect(element?.schemas?.automationNodeConfigSchema).toBeDefined();

		// The generic form only where it is meant to be
		expect(element?.components?.automationNodeForm === AutomationNodeGenericForm).toBe(DELIBERATELY_GENERIC.includes(type));

		// A card just dropped on the canvas is unfinished, not wrong, and its summary says so
		expect(checkNodeConfig(element!.schemas!.automationNodeConfigSchema!, {})).toEqual({});
		expect(summarizeBuiltInNode(type, {}, { t, lookups })).not.toBeNull();
	});

	it('leaves nothing to configure on the cards it serves with the generic form', (): void => {
		for (const type of DELIBERATELY_GENERIC) {
			const schema = AUTOMATION_BUILT_IN_NODE_ELEMENTS.find((item) => item.type === type)!.schemas!.automationNodeConfigSchema!;

			expect(schema.safeParse({}).success, type).toBe(true);
			expect(checkNodeConfig(schema, { anything: 1 }), type).toEqual({ anything: ['automations.editor.validation.unknownField'] });
		}
	});
});
