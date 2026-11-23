import { describe, expect, it, vi } from 'vitest';

import { shallowMount } from '@vue/test-utils';

import SceneActionsList from './scene-actions-list.vue';

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../../common', () => ({
	StateView: { name: 'StateView', template: '<div />' },
}));

vi.mock('./scene-action-row.vue', () => ({ default: { name: 'SceneActionRow', emits: ['edit', 'remove'], template: '<li />' } }));

const action = (id: string) => ({ id, type: 'local', enabled: true, configuration: {} });

const mountList = (options: { value: string; label: string; disabled?: boolean }[], actions = [action('a'), action('b')]) =>
	shallowMount(SceneActionsList, {
		props: { actions, options, cardFor: () => null, labelFor: (type: string) => type },
		global: { stubs: { ElButton: { template: '<button v-bind="$attrs"><slot /></button>' } } },
	});

describe('SceneActionsList', () => {
	it('draws a row per action and passes their edit and delete on by index', () => {
		const wrapper = mountList([{ value: 'local', label: 'Local' }]);
		const rows = wrapper.findAllComponents({ name: 'SceneActionRow' });

		expect(rows).toHaveLength(2);

		rows[1]!.vm.$emit('edit');
		rows[0]!.vm.$emit('remove');

		expect(wrapper.emitted('edit')).toEqual([[1]]);
		expect(wrapper.emitted('remove')).toEqual([[0]]);
	});

	it('shows the empty state without actions', () => {
		const wrapper = mountList([{ value: 'local', label: 'Local' }], []);

		expect(wrapper.findComponent({ name: 'StateView' }).exists()).toBe(true);
		expect(wrapper.findAllComponents({ name: 'SceneActionRow' })).toHaveLength(0);
	});

	it('adds from the only enabled plugin straight away', async () => {
		const wrapper = mountList([
			{ value: 'local', label: 'Local' },
			{ value: 'other', label: 'Other', disabled: true },
		]);

		await wrapper.find('[data-test-id="add-scene-action"]').trigger('click');

		expect(wrapper.emitted('add')).toEqual([['local']]);
	});

	it('keeps Add visible but disabled when no action plugin is enabled', () => {
		const wrapper = mountList([{ value: 'local', label: 'Local', disabled: true }]);

		expect(wrapper.find('[data-test-id="add-scene-action"]').attributes('disabled')).toBeDefined();
	});
});
