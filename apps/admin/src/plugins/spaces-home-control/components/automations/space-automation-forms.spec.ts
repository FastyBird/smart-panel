import { computed } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { type VueWrapper, flushPromises, mount } from '@vue/test-utils';

import { AutomationNodeKind } from '../../../../modules/automations/automations.constants';
import type { IAutomationNodeType } from '../../../../modules/automations/store/node-types.store.types';

import SpaceAutomationNodeSummary from './space-automation-node-summary.vue';
import SpaceLightingIntentForm from './space-lighting-intent-form.vue';
import SpaceModeForm from './space-mode-form.vue';
import SpaceOccupancyForm from './space-occupancy-form.vue';

const mocks = vi.hoisted(() => ({ fetchSpaces: vi.fn(async () => []) }));

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: (key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key),
		te: (key: string) => key.startsWith('spacesHomeControlPlugin.'),
	}),
}));

const SPACE = '6f1a0e1c-7d4b-4c55-9f3e-3b6c2c1b0a07';
const MASTER = '6f1a0e1c-7d4b-4c55-9f3e-3b6c2c1b0a08';

const SPACES = [
	{ id: SPACE, name: 'Living room', type: 'room' },
	{ id: MASTER, name: 'Master', type: 'master' },
];

vi.mock('../../../../modules/spaces/composables/useSpaces', () => ({
	useSpaces: () => ({
		spaces: computed(() => SPACES),
		roomSpaces: computed(() => SPACES.filter((space) => space.type === 'room')),
		zoneSpaces: computed(() => []),
		fetching: computed(() => false),
		firstLoadFinished: computed(() => false),
		fetchSpaces: mocks.fetchSpaces,
		findById: (id: string) => SPACES.find((space) => space.id === id) ?? null,
	}),
}));

const nodeType = (type: string, kind: AutomationNodeKind): IAutomationNodeType => ({
	type,
	kind,
	name: type,
	description: '',
	ports: { inputs: [], outputs: [] },
	configSchema: { type: 'object' },
});

describe('space card forms', (): void => {
	let wrapper: VueWrapper;

	const mountForm = async (component: unknown, props: Record<string, unknown>): Promise<void> => {
		wrapper = mount(component as Parameters<typeof mount>[0], { props, global: { stubs: { Icon: true } } });

		await flushPromises();
	};

	const lastConfig = (): Record<string, unknown> => {
		const events = wrapper.emitted('update:config') ?? [];

		return events[events.length - 1]?.[0] as Record<string, unknown>;
	};

	const select = (field: string) => wrapper.find(`[data-test-field="${field}"]`).findComponent({ name: 'ElSelect' });

	afterEach((): void => {
		wrapper.unmount();
	});

	it('picks the room or zone with the space select, and reads the spaces', async (): Promise<void> => {
		await mountForm(SpaceOccupancyForm, { nodeType: nodeType('space.occupancy.changed', AutomationNodeKind.trigger), config: {} });

		expect(wrapper.findComponent({ name: 'SpaceSelect' }).exists()).toBe(true);
		expect(mocks.fetchSpaces).toHaveBeenCalled();

		wrapper.findComponent({ name: 'SpaceSelect' }).vm.$emit('update:modelValue', SPACE);

		expect(lastConfig()).toEqual({ space_id: SPACE });
	});

	it('offers only rooms and zones, and flags a stored space of another type', async (): Promise<void> => {
		await mountForm(SpaceOccupancyForm, { nodeType: nodeType('space.occupancy.changed', AutomationNodeKind.trigger), config: { space_id: MASTER } });

		expect(wrapper.findComponent({ name: 'SpaceSelect' }).props('filter')).toBe('rooms_and_zones');

		await vi.waitFor((): void =>
			expect(wrapper.find('[data-test-field="space_id"]').text()).toContain('spacesHomeControlPlugin.automations.validation.spaceType')
		);
	});

	it('shows the occupancy trigger and the occupancy condition with their own fields', async (): Promise<void> => {
		await mountForm(SpaceOccupancyForm, { nodeType: nodeType('space.occupancy.changed', AutomationNodeKind.trigger), config: { space_id: SPACE } });

		expect(wrapper.find('[data-test-field="to"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-field="state"]').exists()).toBe(false);

		wrapper.unmount();

		await mountForm(SpaceOccupancyForm, { nodeType: nodeType('space.occupancy.is', AutomationNodeKind.condition), config: { space_id: SPACE } });

		expect(wrapper.find('[data-test-field="state"]').exists()).toBe(true);

		wrapper.find('[data-test-field="state"]').findComponent({ name: 'ElRadioGroup' }).vm.$emit('update:modelValue', 'vacant');

		expect(lastConfig()).toEqual({ space_id: SPACE, state: 'vacant' });
	});

	it('shows each activity mode card with its own fields', async (): Promise<void> => {
		await mountForm(SpaceModeForm, { nodeType: nodeType('space.mode.changed', AutomationNodeKind.trigger), config: { space_id: SPACE } });

		expect(wrapper.find('[data-test-field="from"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-field="to"]').exists()).toBe(true);

		wrapper.unmount();

		await mountForm(SpaceModeForm, { nodeType: nodeType('space.mode.is', AutomationNodeKind.condition), config: { space_id: SPACE } });

		wrapper.findComponent({ name: 'ElCheckboxGroup' }).vm.$emit('update:modelValue', ['away', 'work']);

		expect(lastConfig()).toEqual({ space_id: SPACE, modes: ['work', 'away'] });

		wrapper.unmount();

		await mountForm(SpaceModeForm, { nodeType: nodeType('space.mode.set', AutomationNodeKind.action), config: { space_id: SPACE } });

		select('mode').vm.$emit('update:modelValue', 'sleep');

		expect(lastConfig()).toEqual({ space_id: SPACE, mode: 'sleep' });
	});

	it('shows a problem of a space card in the words of the plugin', async (): Promise<void> => {
		await mountForm(SpaceModeForm, {
			nodeType: nodeType('space.mode.changed', AutomationNodeKind.trigger),
			config: { space_id: SPACE, from: 'relax', to: 'relax' },
		});

		await vi.waitFor((): void =>
			expect(wrapper.find('[data-test-field="to"]').text()).toContain('spacesHomeControlPlugin.automations.validation.sameState')
		);
	});

	describe('space lighting', (): void => {
		const lighting = nodeType('space.lighting.intent', AutomationNodeKind.action);

		it('shows only the fields the intent chosen uses', async (): Promise<void> => {
			await mountForm(SpaceLightingIntentForm, { nodeType: lighting, config: { space_id: SPACE, intent: 'on' } });

			expect(wrapper.find('[data-test-field="mode"]').exists()).toBe(false);
			expect(wrapper.find('[data-test-field="role"]').exists()).toBe(false);
			expect(wrapper.find('[data-test-field="brightness"]').exists()).toBe(false);

			await wrapper.setProps({ config: { space_id: SPACE, intent: 'role_brightness' } });

			expect(wrapper.find('[data-test-field="role"]').exists()).toBe(true);
			expect(wrapper.find('[data-test-field="brightness"]').exists()).toBe(true);
		});

		it('does not offer the hidden role', async (): Promise<void> => {
			await mountForm(SpaceLightingIntentForm, { nodeType: lighting, config: { space_id: SPACE, intent: 'role_on' } });

			const roles = select('role')
				.findAllComponents({ name: 'ElOption' })
				.map((option) => option.props('value'));

			expect(roles).toEqual(['main', 'task', 'ambient', 'accent', 'night', 'other']);
		});

		it('drops what the new intent does not use, and keeps what it does', async (): Promise<void> => {
			await mountForm(SpaceLightingIntentForm, {
				nodeType: lighting,
				config: { space_id: SPACE, intent: 'role_brightness', role: 'main', brightness: 40 },
			});

			select('intent').vm.$emit('update:modelValue', 'role_off');

			expect(lastConfig()).toEqual({ space_id: SPACE, intent: 'role_off', role: 'main' });

			select('intent').vm.$emit('update:modelValue', 'set_mode');

			expect(lastConfig()).toEqual({ space_id: SPACE, intent: 'set_mode' });
		});
	});

	it('summarizes a space card with the name of the space', async (): Promise<void> => {
		wrapper = mount(SpaceAutomationNodeSummary, {
			props: { nodeType: nodeType('space.mode.set', AutomationNodeKind.action), config: { space_id: SPACE, mode: 'relax' } },
		});

		expect(wrapper.text()).toContain('spacesHomeControlPlugin.automations.summaries.modeSet');
		expect(wrapper.text()).toContain('Living room');
	});
});
