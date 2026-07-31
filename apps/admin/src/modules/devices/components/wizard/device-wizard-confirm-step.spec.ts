import { describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import { DevicesModuleDeviceCategory } from '../../../../openapi.constants';

import DeviceWizardConfirmStep from './device-wizard-confirm-step.vue';
import type { IWizardRow } from './device-wizard.types';

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

const row = (overrides: Partial<IWizardRow> = {}): IWizardRow => ({
	key: 'shelly-1.local',
	label: 'Living room switch',
	subLabel: 'Shelly Plus 1',
	identifier: 'shelly-1.local',
	status: 'ready',
	adoptable: true,
	willUpdate: false,
	suggestedName: 'Living room switch',
	suggestedCategory: DevicesModuleDeviceCategory.lighting,
	categoryOptions: [{ value: DevicesModuleDeviceCategory.lighting, label: 'Lighting' }],
	...overrides,
});

const mountStep = (rows: IWizardRow[] = [row()], props: Record<string, unknown> = {}) =>
	mount(DeviceWizardConfirmStep, {
		props: {
			rows,
			columns: [],
			selected: { 'shelly-1.local': true },
			nameByKey: { 'shelly-1.local': 'Living room switch' },
			categoryByKey: { 'shelly-1.local': DevicesModuleDeviceCategory.lighting },
			identifierLabel: 'Hostname',
			allSelected: true,
			someSelected: true,
			...props,
		},
	});

describe('DeviceWizardConfirmStep', () => {
	it('renders one row per adoptable device', async () => {
		const wrapper = mountStep([row(), row({ key: 'b', identifier: 'b' })]);

		await flushPromises();

		expect(wrapper.findAll('tbody tr')).toHaveLength(2);
	});

	it('emits toggle-row when a row checkbox changes', async () => {
		const wrapper = mountStep();

		await flushPromises();

		await wrapper.find('tbody input[type="checkbox"]').setValue(false);

		expect(wrapper.emitted('toggle-row')?.[0]).toEqual(['shelly-1.local', false]);
	});

	it('emits toggle-all when the header checkbox changes', async () => {
		const wrapper = mountStep();

		await flushPromises();

		await wrapper.find('thead input[type="checkbox"]').setValue(false);

		expect(wrapper.emitted('toggle-all')?.[0]).toEqual([false]);
	});

	it('emits update-name when the name input changes', async () => {
		const wrapper = mountStep();

		await flushPromises();

		await wrapper.find('tbody input[type="text"]').setValue('Renamed');

		expect(wrapper.emitted('update-name')?.[0]).toEqual(['shelly-1.local', 'Renamed']);
	});

	it('shows a will-create tag for a new device', async () => {
		const wrapper = mountStep();

		await flushPromises();

		expect(wrapper.text()).toContain('devicesModule.wizard.statuses.willCreate');
	});

	it('shows a will-update tag for an already-registered device', async () => {
		const wrapper = mountStep([row({ status: 'already_registered', willUpdate: true })]);

		await flushPromises();

		expect(wrapper.text()).toContain('devicesModule.wizard.statuses.willUpdate');
	});
});
