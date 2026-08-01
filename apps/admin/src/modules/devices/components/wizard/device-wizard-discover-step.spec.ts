import { describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import { DevicesModuleDeviceCategory } from '../../../../openapi.constants';

import DeviceWizardDiscoverStep from './device-wizard-discover-step.vue';
import type { IWizardControl, IWizardRow } from './device-wizard.types';

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
	categoryOptions: [],
	...overrides,
});

const mountStep = (controls: IWizardControl[] = [], rows: IWizardRow[] = [row()], ready = true) =>
	mount(DeviceWizardDiscoverStep, {
		props: { rows, columns: [], controls, identifierLabel: 'Hostname', ready },
		global: { stubs: { 'router-link': true } },
	});

describe('DeviceWizardDiscoverStep', () => {
	it('renders a banner control', () => {
		const wrapper = mountStep([{ type: 'banner', id: 'hint', severity: 'info', title: 'Scanning the network' }]);

		expect(wrapper.find('[data-test-id="wizard-control-hint"]').exists()).toBe(true);
		expect(wrapper.text()).toContain('Scanning the network');
	});

	it('renders a visible progress control', () => {
		const wrapper = mountStep([{ type: 'progress', id: 'scan', label: 'Found 3 devices', percentage: 40, visible: true }]);

		expect(wrapper.find('[data-test-id="wizard-control-scan"]').exists()).toBe(true);
		expect(wrapper.text()).toContain('Found 3 devices');
	});

	it('hides the content of an invisible progress control but keeps the slot', () => {
		const wrapper = mountStep([{ type: 'progress', id: 'pairing', label: 'Pairing open', percentage: 0, visible: false }]);

		expect(wrapper.find('[data-test-id="wizard-control-pairing"]').classes()).toContain('invisible');
	});

	it('invokes an action control handler on click', async () => {
		const handler = vi.fn();
		const wrapper = mountStep([{ type: 'action', id: 'restart', label: 'Restart scan', icon: 'mdi:radar', handler }]);

		await wrapper.find('[data-test-id="wizard-control-restart"] button').trigger('click');

		expect(handler).toHaveBeenCalledOnce();
	});

	it('submits a form control with its field values and clears them on success', async () => {
		const handler = vi.fn().mockResolvedValue(undefined);
		const wrapper = mountStep([
			{
				type: 'form',
				id: 'manual',
				fields: [{ key: 'hostname', label: 'Hostname' }],
				submitLabel: 'Add',
				submitDisabled: false,
				handler,
			},
		]);

		const input = wrapper.find<HTMLInputElement>('[data-test-id="wizard-control-manual"] input');
		await input.setValue('shelly-9.local');
		await wrapper.find('[data-test-id="wizard-control-manual"] form').trigger('submit');
		await flushPromises();

		expect(handler).toHaveBeenCalledWith({ hostname: 'shelly-9.local' });
		expect(input.element.value).toBe('');
	});

	it('retains the input value when the form handler rejects', async () => {
		const handler = vi.fn().mockRejectedValue(new Error('boom'));
		const wrapper = mountStep([
			{
				type: 'form',
				id: 'manual',
				fields: [{ key: 'hostname', label: 'Hostname' }],
				submitLabel: 'Add',
				submitDisabled: false,
				handler,
			},
		]);

		const input = wrapper.find<HTMLInputElement>('[data-test-id="wizard-control-manual"] input');
		await input.setValue('shelly-9.local');
		await wrapper.find('[data-test-id="wizard-control-manual"] form').trigger('submit');
		await flushPromises();

		expect(input.element.value).toBe('shelly-9.local');
	});

	it('shows the shell-owned loading text and background over the table while not ready', async () => {
		const wrapper = mountStep([], [], false);

		await flushPromises();

		const mask = wrapper.find('.el-loading-mask');

		expect(mask.exists()).toBe(true);
		expect(mask.find('.el-loading-text').text()).toBe('devicesModule.wizard.texts.loading');
		expect(mask.attributes('style')).toContain('var(--el-bg-color-overlay)');
	});

	it('renders a row with its label, sub-label and identifier', async () => {
		const wrapper = mountStep([]);

		// El-table registers its columns asynchronously, so the body cells are only
		// populated after the pending microtasks flush.
		await flushPromises();

		expect(wrapper.text()).toContain('Living room switch');
		expect(wrapper.text()).toContain('Shelly Plus 1');
		expect(wrapper.text()).toContain('shelly-1.local');
	});
});
