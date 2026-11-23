import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import type { IScene } from '../../store/scenes.store.types';

import ScenesRowActions from './scenes-row-actions.vue';

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

const scene = (overrides: Partial<IScene> = {}) =>
	({ id: 's1', name: 'Evening', triggerable: true, editable: true, ...overrides }) as unknown as IScene;

const stubs = {
	ElTooltip: { name: 'ElTooltip', props: ['content'], template: '<div><slot /></div>' },
	ElDropdown: { name: 'ElDropdown', emits: ['command'], template: '<div><slot /><slot name="dropdown" /></div>' },
	ElDropdownMenu: { template: '<ul><slot /></ul>' },
	ElDropdownItem: { template: '<li><slot /></li>' },
};

describe('ScenesRowActions', () => {
	it('offers Run with its label, Edit as an icon and Delete in the more menu', async () => {
		const wrapper = mount(ScenesRowActions, { props: { scene: scene() }, global: { stubs } });

		expect(wrapper.find('[data-test-id="trigger-scene"]').text()).toContain('scenes.buttons.run.title');
		expect(wrapper.find('[data-test-id="edit-scene"]').attributes('aria-label')).toBe('scenes.aria.edit');
		expect(wrapper.find('[data-test-id="remove-scene"]').classes()).toContain('text-danger!');

		await wrapper.find('[data-test-id="trigger-scene"]').trigger('click');
		await wrapper.find('[data-test-id="edit-scene"]').trigger('click');
		wrapper.findComponent({ name: 'ElDropdown' }).vm.$emit('command', 'remove');

		expect(wrapper.emitted('trigger')).toEqual([['s1']]);
		expect(wrapper.emitted('edit')).toEqual([['s1']]);
		expect(wrapper.emitted('remove')).toEqual([['s1']]);
	});

	it('leaves out what the scene does not allow', () => {
		const wrapper = mount(ScenesRowActions, { props: { scene: scene({ triggerable: false, editable: false }) }, global: { stubs } });

		expect(wrapper.find('[data-test-id="trigger-scene"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="edit-scene"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="more-scene"]').exists()).toBe(false);
	});
});
