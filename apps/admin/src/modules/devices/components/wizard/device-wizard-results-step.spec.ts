import { describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import DeviceWizardResultsStep from './device-wizard-results-step.vue';
import type { IWizardColumn, IWizardResult } from './device-wizard.types';

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

const mountStep = (results: IWizardResult[], columns: IWizardColumn[] = []) =>
	mount(DeviceWizardResultsStep, {
		props: { results, columns, identifierLabel: 'Hostname' },
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

	it('sorts failed rows to the top ahead of created, updated, and skipped rows', async () => {
		const wrapper = mountStep([
			result({ key: 'skipped', identifier: 'skipped', name: 'Skipped Row', status: 'skipped' }),
			result({ key: 'updated', identifier: 'updated', name: 'Update Row', status: 'updated' }),
			result({ key: 'created', identifier: 'created', name: 'Create Row', status: 'created' }),
			result({ key: 'failed-z', identifier: 'failed-z', name: 'Zulu Failure', status: 'failed', error: 'boom' }),
			result({ key: 'failed-a', identifier: 'failed-a', name: 'Alpha Failure', status: 'failed', error: 'boom' }),
		]);

		await flushPromises();

		const rows = wrapper.findAll('tbody tr');

		expect(rows).toHaveLength(5);
		expect(rows[0].text()).toContain('Alpha Failure');
		expect(rows[1].text()).toContain('Zulu Failure');
		expect(rows[2].text()).toContain('Create Row');
		expect(rows[3].text()).toContain('Update Row');
		expect(rows[4].text()).toContain('Skipped Row');
	});

	it('renders only the extra columns scoped to the results step', async () => {
		const columns: IWizardColumn[] = [
			{ key: 'confirmOnly', label: 'Confirm Only Column', steps: ['confirm'] },
			{ key: 'resultsOnly', label: 'Results Only Column', steps: ['results'] },
		];

		const wrapper = mountStep(
			[
				result({
					cells: {
						confirmOnly: { render: 'text', value: 'Should not render' },
						resultsOnly: { render: 'text', value: 'Should render' },
					},
				}),
			],
			columns
		);

		await flushPromises();

		expect(wrapper.text()).toContain('Results Only Column');
		expect(wrapper.text()).toContain('Should render');
		expect(wrapper.text()).not.toContain('Confirm Only Column');
		expect(wrapper.text()).not.toContain('Should not render');
	});

	it('does not mutate the results prop array while sorting', async () => {
		const results = [
			result({ key: 'updated', identifier: 'updated', name: 'Update Row', status: 'updated' }),
			result({ key: 'created', identifier: 'created', name: 'Create Row', status: 'created' }),
			result({ key: 'failed', identifier: 'failed', name: 'Failure Row', status: 'failed', error: 'boom' }),
		];
		const snapshot = results.map((item) => ({ ...item }));

		mountStep(results);

		await flushPromises();

		expect(results).toEqual(snapshot);
	});
});
