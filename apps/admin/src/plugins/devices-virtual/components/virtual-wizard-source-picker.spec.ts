import { ElInput, ElPagination } from 'element-plus';
import { describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import type { VirtualWizardSource } from './virtual-wizard-source-picker.types';
import VirtualWizardSourcePicker from './virtual-wizard-source-picker.vue';

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string, params = {}) => `${key} ${JSON.stringify(params)}` }) }));
const source = (id: string, name: string, roomId: string, room: string): VirtualWizardSource => ({
	id,
	name,
	detail: 'Temperature',
	roomId,
	room,
	reading: '—',
	age: '—',
	online: false,
});
const sources = [source('hall', 'Hall sensor', 'hall', 'Hall'), source('bed', 'Ložnice sensor', 'bedroom', 'Ložnice')];

describe('virtual source selection', () => {
	it('suggests the selected room first, searches names without accents, and excludes selected readings', async () => {
		const view = mount(VirtualWizardSourcePicker, { props: { sources, selected: [], roomId: 'bedroom', roomName: 'Ložnice' } });
		expect(view.findAll('[data-source-id]').map((button) => button.attributes('data-source-id'))).toEqual(['bed', 'hall']);
		await view.get('[data-source-id="bed"]').trigger('click');
		expect(view.emitted('add')).toEqual([['bed']]); // Offline is a valid configuration choice.
		await view.setProps({ selected: [sources[1]!] });
		await flushPromises();
		expect(view.find('[data-source-id="bed"]').exists()).toBe(false);
		expect(view.get('[data-test-id="wizard-selected-sources"]').text()).toContain('Ložnice sensor');
		view.getComponent(ElInput).vm.$emit('update:modelValue', 'HALL');
		await view.vm.$nextTick();
		expect(view.find('[data-source-id="hall"]').exists()).toBe(true);
		await view.setProps({ selected: [] });
		view.getComponent(ElInput).vm.$emit('update:modelValue', 'loznice');
		await view.vm.$nextTick();
		expect(view.findAll('[data-source-id]').map((button) => button.attributes('data-source-id'))).toEqual(['bed']);
		view.unmount();
	});

	it('groups matching room, matching zones and remaining sources after searching and selection', async () => {
		const options = [
			{ ...source('other', 'Hall sensor', 'hall', 'Hall'), zoneIds: [] },
			{ ...source('zone', 'Kitchen sensor', 'kitchen', 'Kitchen'), zoneIds: ['downstairs'] },
			{ ...source('room', 'Bedroom sensor', 'bedroom', 'Bedroom'), zoneIds: ['downstairs'] },
		];
		const view = mount(VirtualWizardSourcePicker, { props: { sources: options, selected: [], roomId: 'bedroom', zoneIds: ['downstairs'] } });
		const groups = () => view.findAll('[data-source-group]').map((group) => group.attributes('data-source-group'));
		expect(groups()).toEqual(['room', 'zones', 'other']);
		expect(view.findAll('[data-source-id]').map((button) => button.attributes('data-source-id'))).toEqual(['room', 'zone', 'other']);
		await view.setProps({ selected: [options[2]] });
		expect(groups()).toEqual(['zones', 'other']);
		view.getComponent(ElInput).vm.$emit('update:modelValue', 'kitchen');
		await view.vm.$nextTick();
		expect(groups()).toEqual(['zones']);
		await view.setProps({ zoneIds: [] });
		expect(groups()).toEqual(['other']);
		view.unmount();
	});

	it('bounds rendered sources, searches the whole catalogue, and clamps pages after catalogue changes', async () => {
		const catalogue = Array.from({ length: 205 }, (_, index) => source(`s${index}`, `Sensor ${index}`, 'hall', 'Hall'));
		const view = mount(VirtualWizardSourcePicker, { props: { sources: catalogue, selected: [] } });
		expect(view.findAll('[data-source-id]')).toHaveLength(20);
		view.getComponent(ElPagination).vm.$emit('update:current-page', 11);
		await view.vm.$nextTick();
		expect(view.findAll('[data-source-id]')).toHaveLength(5);
		await view.get('[data-source-id="s204"]').trigger('click');
		expect(view.emitted('add')).toEqual([['s204']]);
		view.getComponent(ElInput).vm.$emit('update:modelValue', 'Sensor 204');
		await view.vm.$nextTick();
		expect(view.findAll('[data-source-id]').map((button) => button.attributes('data-source-id'))).toEqual(['s204']);
		await view.setProps({ selected: [catalogue[204]] });
		expect(view.findAll('[data-source-id]')).toHaveLength(0);
		view.getComponent(ElInput).vm.$emit('update:modelValue', '');
		await view.vm.$nextTick();
		expect(view.findAll('[data-source-id]')).toHaveLength(20);
		view.getComponent(ElPagination).vm.$emit('update:current-page', 10);
		await view.vm.$nextTick();
		await view.setProps({ sources: catalogue.slice(0, 3) });
		expect(view.findAll('[data-source-id]')).toHaveLength(3);
		expect(view.findComponent(ElPagination).exists()).toBe(false);
		view.unmount();
	});

	it('shows the same source columns without actions or search in read-only mode', async () => {
		const selected = [{ ...sources[0], state: { label: 'Sample expired', type: 'warning' as const }, weight: 2 }];
		const view = mount(VirtualWizardSourcePicker, { props: { sources, selected, readOnly: true } });
		await flushPromises();
		expect(view.find('input').exists()).toBe(false);
		expect(view.findAll('button')).toHaveLength(0);
		expect(view.findAll('[data-source-group]')).toHaveLength(0);
		expect(view.text()).toContain('Hall sensor');
		expect(view.text()).toContain('Sample expired');
		expect(view.text()).toContain('devicesVirtualPlugin.measurement.weight');
		view.unmount();
	});
	it('keeps missing bindings visible for removal and disables changes during saving', async () => {
		const missing = source('missing', 'Removed sensor', 'bedroom', 'Bedroom');
		const view = mount(VirtualWizardSourcePicker, { props: { sources, selected: [missing], disabled: true } });
		await flushPromises();
		const remove = view.get('[data-test-id="wizard-selected-sources"]').find('button');
		expect(remove.attributes('disabled')).toBeDefined();
		expect(view.get('[data-source-id="hall"]').attributes('disabled')).toBeDefined();
		await view.setProps({ disabled: false });
		await remove.trigger('click');
		expect(view.emitted('remove')).toEqual([['missing']]);
		view.unmount();
	});
});
