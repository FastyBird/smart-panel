import { describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import DeviceWizardResultsStep from './device-wizard-results-step.vue';
import type { IWizardResult } from './device-wizard.types';

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

const result = (overrides: Partial<IWizardResult> = {}): IWizardResult => ({
	key: 'shelly-1.local',
	name: 'Living room switch',
	identifier: 'shelly-1.local',
	status: 'created',
	error: null,
	...overrides,
});

const mountStep = (results: IWizardResult[]) =>
	mount(DeviceWizardResultsStep, {
		props: { results, columns: [], identifierLabel: 'Hostname' },
	});

describe('DeviceWizardResultsStep', () => {
	it('shows the success summary when nothing failed', async () => {
		const wrapper = mountStep([result()]);

		await flushPromises();

		expect(wrapper.text()).toContain('devicesModule.wizard.texts.resultsSuccess');
	});

	it('shows the failure summary when any row failed', async () => {
		const wrapper = mountStep([result(), result({ key: 'b', identifier: 'b', status: 'failed', error: 'Unauthorized' })]);

		await flushPromises();

		expect(wrapper.text()).toContain('devicesModule.wizard.texts.resultsFailed');
	});

	it('renders the error message for a failed row', async () => {
		const wrapper = mountStep([result({ status: 'failed', error: 'Unauthorized' })]);

		await flushPromises();

		expect(wrapper.text()).toContain('Unauthorized');
	});

	it('renders one row per result', async () => {
		const wrapper = mountStep([result(), result({ key: 'b', identifier: 'b' })]);

		await flushPromises();

		expect(wrapper.findAll('tbody tr')).toHaveLength(2);
	});
});
