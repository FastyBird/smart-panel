import { defineComponent } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import { AutomationNodeKind } from '../../automations.constants';
import type { IAutomationNodeType } from '../../store/node-types.store.types';
import AutomationNodeCard from '../canvas/automation-node-card.vue';

import AutomationNodeSummary from './automation-node-summary.vue';

const mocks = vi.hoisted(() => ({ ensureDevices: vi.fn(), ensureScenes: vi.fn(), ensureAutomations: vi.fn() }));

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key),
	}),
}));

vi.mock('../../composables/useAutomationNodeLookups', () => ({
	useAutomationNodeLookups: () => ({
		device: () => null,
		channel: () => null,
		property: () => null,
		scene: (id: string) => (id === 's-evening' ? { name: 'Evening' } : null),
		automation: () => null,
		ensureDevices: mocks.ensureDevices,
		ensureScenes: mocks.ensureScenes,
		ensureAutomations: mocks.ensureAutomations,
	}),
}));

const nodeType = (type: string): IAutomationNodeType => ({
	type,
	kind: AutomationNodeKind.action,
	name: type,
	description: '',
	ports: { inputs: ['in'], outputs: ['done', 'error'] },
	configSchema: { type: 'object' },
});

describe('AutomationNodeSummary', (): void => {
	it('says what a built-in card does, with the names of what it points at', (): void => {
		const wrapper = mount(AutomationNodeSummary, { props: { nodeType: nodeType('scene.run'), config: { scene_id: 's-evening' } } });

		expect(wrapper.text()).toBe('automations.editor.summaries.sceneRun {"scene":"Evening"}');
		expect(mocks.ensureScenes).toHaveBeenCalled();
		expect(mocks.ensureDevices).not.toHaveBeenCalled();
	});

	it('reads the devices for a device card', (): void => {
		mount(AutomationNodeSummary, { props: { nodeType: nodeType('device.property.set'), config: {} } });

		expect(mocks.ensureDevices).toHaveBeenCalled();
	});

	it('reads the scenes for a scene trigger and the automations for an automation action', (): void => {
		vi.clearAllMocks();

		mount(AutomationNodeSummary, { props: { nodeType: nodeType('scene.was-run'), config: {} } });

		expect(mocks.ensureScenes).toHaveBeenCalled();
		expect(mocks.ensureAutomations).not.toHaveBeenCalled();

		mount(AutomationNodeSummary, { props: { nodeType: nodeType('automation.run'), config: {} } });

		expect(mocks.ensureAutomations).toHaveBeenCalled();
	});
});

describe('AutomationNodeCard', (): void => {
	const props = { kind: AutomationNodeKind.action, kindLabel: 'Then', icon: 'mdi:play', title: 'Run scene', summary: 'scene id: x' };

	it('shows the summary a card brings in place of the generic one', (): void => {
		const OwnSummary = defineComponent({
			name: 'OwnSummary',
			props: { nodeType: { type: Object, required: true }, config: { type: Object, required: true } },
			template: '<span>Own: {{ config.a }}</span>',
		});

		const wrapper = mount(AutomationNodeCard, {
			props: { ...props, summaryComponent: OwnSummary, summaryProps: { nodeType: nodeType('x.y'), config: { a: 1 } } },
			global: { stubs: { Icon: true } },
		});

		expect(wrapper.find('[data-test-id="node-summary"]').text()).toBe('Own: 1');
	});

	it('shows the generic summary without one', (): void => {
		const wrapper = mount(AutomationNodeCard, { props, global: { stubs: { Icon: true } } });

		expect(wrapper.find('[data-test-id="node-summary"]').text()).toBe('scene id: x');
	});
});
