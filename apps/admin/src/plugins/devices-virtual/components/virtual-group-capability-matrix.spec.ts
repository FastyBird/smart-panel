import { ElCheckbox, ElTableColumn } from 'element-plus';
import { describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import type { GroupCapability, GroupCategory, GroupMemberOption } from '../utils/group-authoring.types';

import Matrix from './virtual-group-capability-matrix.vue';

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
const capabilities = ['on', 'brightness'].map((category) => ({
	category,
	data_type: 'bool',
	access: 'rw',
	format: null,
	unit: null,
	step: null,
})) as GroupCapability[];
const member: GroupMemberOption = {
	id: 'lamp',
	name: 'Couch light',
	detail: 'Light 0',
	room: 'Living Room',
	roomId: 'living',
	capabilities,
	eligible: true,
	reasons: [],
};

describe('group member capability matrix', () => {
	it('fixes names and removal around scrolling capability columns; mandatory and unavailable controls cannot be toggled', async () => {
		const view = mount(Matrix, {
			props: {
				members: [member],
				columns: ['on', 'brightness', 'hue'] as GroupCategory[],
				availableCapabilities: capabilities,
				selectedCapabilities: ['on', 'brightness'] as GroupCategory[],
				requiredCapabilities: ['on'] as GroupCategory[],
			},
		});
		await flushPromises();
		const columns = view.findAllComponents(ElTableColumn);
		expect(columns[0].props('fixed')).toBe('left');
		expect(columns.at(-1)?.props('fixed')).toBe('right');
		expect(columns.slice(1, -1).every((column) => !column.props('fixed'))).toBe(true);
		const checks = view.findAllComponents(ElCheckbox);
		expect(checks[0].props()).toMatchObject({ disabled: true, modelValue: true });
		expect(checks[1].props()).toMatchObject({ disabled: false, modelValue: true });
		expect(checks[2].props()).toMatchObject({ disabled: true, modelValue: false });
		checks[1].vm.$emit('update:modelValue', false);
		expect(view.emitted('toggle')).toEqual([['brightness', false]]);
		await view.get('[data-remove-member="lamp"]').trigger('click');
		expect(view.emitted('remove')).toEqual([['lamp']]);
		await view.setProps({ controlsDisabled: true });
		expect(view.findAllComponents(ElCheckbox).every((check) => check.props('disabled'))).toBe(true);
		expect(view.get('[data-remove-member="lamp"]').attributes('disabled')).toBeUndefined(); // Removable after failed catalog refresh.
		await view.setProps({ disabled: true });
		expect(view.get('[data-remove-member="lamp"]').attributes('disabled')).toBeDefined();
		view.unmount();
	});
});
