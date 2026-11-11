import { ElSwitch, ElTable } from 'element-plus';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { type VueWrapper, flushPromises, mount } from '@vue/test-utils';

import { AutomationMode, AutomationRunStatus, AutomationStatus, WHOLE_HOME_SPACE_FILTER } from '../../automations.constants';
import type { IAutomation } from '../../store/automations.store.types';

import type { IAutomationsTableProps } from './automations-table.types';
import AutomationsTable from './automations-table.vue';

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('../../composables/useAutomationSpaces', () => ({
	useAutomationSpaces: () => ({
		getSpaceName: (id: string | null): string | null => (id === 'space-1' ? 'Hallway' : null),
	}),
}));

const automation = (overrides: Partial<IAutomation>): IAutomation => ({
	id: '1',
	name: 'Hallway motion light',
	description: null,
	icon: null,
	enabled: true,
	spaceId: 'space-1',
	mode: AutomationMode.restart,
	graph: null,
	revision: 1,
	status: AutomationStatus.ok,
	lastTriggeredAt: new Date('2026-01-02T08:30:00.000Z'),
	lastRunStatus: AutomationRunStatus.completed,
	createdAt: new Date(),
	updatedAt: null,
	...overrides,
});

describe('AutomationsTable', (): void => {
	let wrapper: VueWrapper;

	const items: IAutomation[] = [
		automation({}),
		automation({
			id: '2',
			name: 'Night mode',
			enabled: false,
			spaceId: null,
			status: AutomationStatus.suspended,
			lastTriggeredAt: null,
			lastRunStatus: null,
		}),
	];

	const createWrapper = async (props: Partial<IAutomationsTableProps> = {}): Promise<void> => {
		wrapper = mount(AutomationsTable, {
			props: {
				items,
				totalRows: items.length,
				filters: { search: undefined, spaceId: undefined, enabled: 'all', statuses: [] },
				filtersActive: false,
				tableHeight: 400,
				loading: false,
				updating: [],
				sortBy: 'name',
				sortDir: 'asc',
				...props,
			},
		});

		// The table renders its rows a tick after it was mounted
		await flushPromises();
	};

	afterEach((): void => {
		wrapper.unmount();
	});

	it('renders a row per automation with its space, status and last run', async (): Promise<void> => {
		await createWrapper();

		expect(wrapper.findComponent(ElTable).exists()).toBe(true);

		const rows = wrapper.findAll('tbody tr');

		expect(rows).toHaveLength(2);

		expect(rows[0]!.text()).toContain('Hallway motion light');
		expect(rows[0]!.text()).toContain('Hallway');
		expect(rows[0]!.text()).toContain('automations.statuses.ok.title');
		expect(rows[0]!.text()).toContain('automations.runStatuses.completed');

		expect(rows[1]!.text()).toContain('automations.fields.wholeHome');
		expect(rows[1]!.text()).toContain('automations.statuses.suspended.title');
		expect(rows[1]!.text()).toContain('automations.fields.neverRun');
	});

	it('shows the enabled state and asks for the opposite one when the switch is used', async (): Promise<void> => {
		await createWrapper();

		const switches = wrapper.findAllComponents(ElSwitch);

		expect(switches.map((item) => item.props('modelValue'))).toEqual([true, false]);

		await switches[1]!.find('input').trigger('change');

		expect(wrapper.emitted('toggle-enabled')).toEqual([['2', true]]);
		// Using the switch must not open the automation
		expect(wrapper.emitted('edit')).toBeUndefined();
	});

	it('marks the switch of an automation being updated as loading', async (): Promise<void> => {
		await createWrapper({ updating: ['2'] });

		expect(wrapper.findAllComponents(ElSwitch).map((item) => item.props('loading'))).toEqual([false, true]);
	});

	it('emits edit and remove for a row', async (): Promise<void> => {
		await createWrapper();

		await wrapper.findAll('[data-test-id="edit-automation"]')[0]!.trigger('click');
		await wrapper.findAll('[data-test-id="remove-automation"]')[1]!.trigger('click');

		expect(wrapper.emitted('edit')).toEqual([['1']]);
		expect(wrapper.emitted('remove')).toEqual([['2']]);
	});

	it('filters by the space of a row and removes the filter again', async (): Promise<void> => {
		const filters: IAutomationsTableProps['filters'] = { search: undefined, spaceId: undefined, enabled: 'all', statuses: [] };

		await createWrapper({ filters });

		await wrapper.findAll('tbody tr')[1]!.find('.el-link').trigger('click');

		expect(filters.spaceId).toBe(WHOLE_HOME_SPACE_FILTER);

		await wrapper.findAll('tbody tr')[1]!.find('.el-link').trigger('click');

		expect(filters.spaceId).toBeUndefined();
	});

	it('says that there are no automations yet', async (): Promise<void> => {
		await createWrapper({ items: [], totalRows: 0 });

		expect(wrapper.text()).toContain('automations.texts.noAutomations');
	});

	it('offers to reset the filters when they hide everything', async (): Promise<void> => {
		await createWrapper({ items: [], filtersActive: true });

		expect(wrapper.text()).toContain('automations.texts.noFilteredAutomations');
	});
});
