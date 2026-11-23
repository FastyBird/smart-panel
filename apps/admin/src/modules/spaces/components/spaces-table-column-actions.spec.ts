import { ref } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import type { ISpace } from '../store/spaces.store.types';

import SpacesTableColumnActions from './spaces-table-column-actions.vue';

const push = vi.fn();
const configure = ref<unknown>(undefined);

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('vue-router', () => ({
	useRouter: () => ({ push }),
}));

vi.mock('../composables', async () => {
	const { computed: vueComputed } = await import('vue');

	return { useSpacesPlugin: () => ({ plugin: vueComputed(() => ({ routes: { configure: configure.value } })) }) };
});

const space = { id: 's1', name: 'Kitchen', type: 'room' } as unknown as ISpace;

const stubs = {
	ElTooltip: { name: 'ElTooltip', props: ['content'], template: '<div><slot /></div>' },
	ElDropdown: { name: 'ElDropdown', emits: ['command'], template: '<div><slot /><slot name="dropdown" /></div>' },
	ElDropdownMenu: { template: '<ul><slot /></ul>' },
	ElDropdownItem: { template: '<li><slot /></li>' },
};

const mountActions = () => mount(SpacesTableColumnActions, { props: { space }, global: { stubs } });

describe('SpacesTableColumnActions', () => {
	it('offers Edit as a labelled icon and Delete in the more menu', async () => {
		configure.value = undefined;

		const wrapper = mountActions();

		expect(wrapper.find('[data-test-id="configure-space"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="edit-space"]').attributes('aria-label')).toBe('spacesModule.aria.edit');
		expect(wrapper.find('[data-test-id="remove-space"]').classes()).toContain('text-danger!');

		await wrapper.find('[data-test-id="edit-space"]').trigger('click');
		wrapper.findComponent({ name: 'ElDropdown' }).vm.$emit('command', 'remove');

		expect(wrapper.emitted('edit')).toEqual([['s1']]);
		expect(wrapper.emitted('remove')).toEqual([['s1']]);
	});

	it('opens the plugin configure page when the space type has one', async () => {
		configure.value = (id: string) => ({ name: 'configure', params: { id } });

		const wrapper = mountActions();

		await wrapper.find('[data-test-id="configure-space"]').trigger('click');

		expect(push).toHaveBeenCalledWith({ name: 'configure', params: { id: 's1' } });
	});
});
