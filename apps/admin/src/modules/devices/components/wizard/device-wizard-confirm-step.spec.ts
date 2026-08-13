import { ElPagination, ElSelect } from 'element-plus';
import { describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import { DevicesModuleDeviceCategory } from '../../../../openapi.constants';

import DeviceWizardConfirmStep from './device-wizard-confirm-step.vue';
import type { IWizardColumn, IWizardRow } from './device-wizard.types';

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string, params?: { count?: number }) => (params?.count === undefined ? key : `${key}:${params.count}`),
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
			summaryRows: rows,
			columns: [],
			selected: { 'shelly-1.local': true },
			nameByKey: { 'shelly-1.local': 'Living room switch' },
			categoryByKey: { 'shelly-1.local': DevicesModuleDeviceCategory.lighting },
			identifierLabel: 'Hostname',
			confirmationMode: 'editable',
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

	it('emits toggle-rows for the filtered rows when the header checkbox changes', async () => {
		const wrapper = mountStep();

		await flushPromises();

		await wrapper.find('thead input[type="checkbox"]').setValue(false);

		expect(wrapper.emitted('toggle-rows')?.[0]).toEqual([['shelly-1.local'], false]);
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

	it('sorts by the edited name in nameByKey rather than the row suggestedName', async () => {
		// `:default-sort="{ prop: 'name', order: 'ascending' }"` sorts the table by this column on
		// mount, using `sortByName` as the comparator. The rows are set up so nameByKey and
		// suggestedName disagree on order: if the comparator ever regressed to reading
		// `row.suggestedName` instead of `props.nameByKey`, the rendered order would flip.
		const wrapper = mountStep(
			[row({ key: 'a', identifier: 'a', suggestedName: 'Zebra' }), row({ key: 'b', identifier: 'b', suggestedName: 'Apple' })],
			{
				nameByKey: { a: 'Apple', b: 'Zebra' },
			}
		);

		await flushPromises();

		const order = wrapper.findAll('tbody tr').map((tr) => tr.find('code').text());

		expect(order).toEqual(['a', 'b']);
	});

	it('sorts the full confirmation inventory before slicing it into pages', async () => {
		const rows = Array.from({ length: 26 }, (_, index) =>
			row({
				key: `device-${index}`,
				identifier: `device-${index}`,
				suggestedName: `Device ${String(25 - index).padStart(2, '0')}`,
			})
		);
		const wrapper = mountStep(rows, {
			confirmationMode: 'selection-only',
			selected: {},
			nameByKey: {},
			categoryByKey: {},
		});

		await flushPromises();

		expect(wrapper.findAll('tbody tr')).toHaveLength(25);
		expect(wrapper.find('tbody tr code').text()).toBe('device-25');
	});

	it('clamps the current page when edited names shrink the filtered inventory', async () => {
		const rows = Array.from({ length: 30 }, (_, index) =>
			row({ key: `device-${index}`, identifier: `device-${index}`, suggestedName: `Device ${index}` })
		);
		const wrapper = mountStep(rows, {
			confirmationMode: 'selection-only',
			selected: {},
			nameByKey: Object.fromEntries(rows.map((item) => [item.key, `Match ${item.identifier}`])),
			categoryByKey: {},
		});

		await flushPromises();
		await wrapper.find('[data-test-id="wizard-confirm-search"] input').setValue('match');
		await flushPromises();
		wrapper.findComponent(ElPagination).vm.$emit('update:current-page', 2);
		await flushPromises();

		expect(wrapper.findAll('tbody tr')).toHaveLength(5);

		await wrapper.setProps({
			nameByKey: Object.fromEntries(rows.map((item, index) => [item.key, `${index < 10 ? 'Match' : 'Other'} ${item.identifier}`])),
		});
		await flushPromises();

		expect(wrapper.find('[data-test-id="wizard-confirm-pagination"]').exists()).toBe(false);
		expect(wrapper.findAll('tbody tr')).toHaveLength(10);
		expect(wrapper.text()).toContain('device-0');
	});

	it('sorts by the translated category label rather than the raw category value', async () => {
		// Labels are deliberately inverted relative to the raw enum values ('lighting' <
		// 'switcher' alphabetically, but 'Zzz' > 'Aaa'): a regression back to comparing
		// `categoryByKey` values directly (instead of the resolved label) would flip the order.
		const categoryOptions = [
			{ value: DevicesModuleDeviceCategory.lighting, label: 'Zzz Category' },
			{ value: DevicesModuleDeviceCategory.switcher, label: 'Aaa Category' },
		];
		const wrapper = mountStep([row({ key: 'a', identifier: 'a', categoryOptions }), row({ key: 'b', identifier: 'b', categoryOptions })], {
			categoryByKey: { a: DevicesModuleDeviceCategory.switcher, b: DevicesModuleDeviceCategory.lighting },
		});

		await flushPromises();

		const categoryHeader = wrapper.findAll('th').find((th) => th.text().includes('devicesModule.wizard.columns.category'));

		expect(categoryHeader).toBeDefined();

		await categoryHeader!.find('.caret-wrapper').trigger('click');
		await flushPromises();

		const order = wrapper.findAll('tbody tr').map((tr) => tr.find('code').text());

		// Ascending by translated label: "Aaa Category" (row a, switcher) sorts before
		// "Zzz Category" (row b, lighting).
		expect(order).toEqual(['a', 'b']);
	});

	it('marks the header checkbox indeterminate when some but not all filtered rows are selected', async () => {
		const wrapper = mountStep([row(), row({ key: 'b', identifier: 'b' })], {
			selected: { 'shelly-1.local': true, b: false },
		});

		await flushPromises();

		expect(wrapper.find('thead .el-checkbox__input').classes()).toContain('is-indeterminate');
		expect(wrapper.find('thead .el-checkbox').attributes('aria-checked')).toBe('mixed');
	});

	it('does not mark the header checkbox indeterminate once every row is selected', async () => {
		const wrapper = mountStep([row(), row({ key: 'b', identifier: 'b' })], {
			selected: { 'shelly-1.local': true, b: true },
		});

		await flushPromises();

		expect(wrapper.find('thead .el-checkbox__input').classes()).not.toContain('is-indeterminate');
	});

	it('only renders extra columns declared for the confirm step', async () => {
		const columns: IWizardColumn[] = [
			{ key: 'confirmOnly', label: 'Confirm Only', steps: ['confirm'] },
			{ key: 'discoverOnly', label: 'Discover Only', steps: ['discover'] },
		];
		const wrapper = mountStep([row()], { columns });

		await flushPromises();

		expect(wrapper.text()).toContain('Confirm Only');
		expect(wrapper.text()).not.toContain('Discover Only');
	});

	it('emits update-category with the row key and the selected value', async () => {
		const wrapper = mountStep();

		await flushPromises();

		await wrapper.findComponent(ElSelect).setValue(DevicesModuleDeviceCategory.switcher);

		expect(wrapper.emitted('update-category')?.[0]).toEqual(['shelly-1.local', DevicesModuleDeviceCategory.switcher]);
	});

	it('renders automatic names and categories read-only in selection-only mode', async () => {
		const wrapper = mountStep([row()], { confirmationMode: 'selection-only' });

		await flushPromises();

		expect(wrapper.find('tbody input[type="text"]').exists()).toBe(false);
		expect(wrapper.findComponent(ElSelect).exists()).toBe(false);
		expect(wrapper.text()).toContain('Living room switch');
		expect(wrapper.text()).toContain('Lighting');
	});

	it('filters rows and applies the header toggle only to visible matches', async () => {
		const wrapper = mountStep([
			row(),
			row({ key: 'kitchen.local', identifier: 'kitchen.local', label: 'Kitchen light', suggestedName: 'Kitchen light' }),
		]);

		await flushPromises();
		await wrapper.find('[data-test-id="wizard-confirm-search"] input').setValue('kitchen');
		await flushPromises();

		expect(wrapper.findAll('tbody tr')).toHaveLength(1);
		await wrapper.find('thead input[type="checkbox"]').setValue(true);

		expect(wrapper.emitted('toggle-rows')?.[0]).toEqual([['kitchen.local'], true]);
	});

	it('filters by the rendered fallback status label', async () => {
		const wrapper = mountStep([row(), row({ key: 'registered', identifier: 'registered', status: 'already_registered', willUpdate: true })], {
			selected: { 'shelly-1.local': true, registered: true },
			nameByKey: { 'shelly-1.local': 'Living room switch', registered: 'Registered switch' },
			categoryByKey: {
				'shelly-1.local': DevicesModuleDeviceCategory.lighting,
				registered: DevicesModuleDeviceCategory.lighting,
			},
		});

		await flushPromises();
		await wrapper.find('[data-test-id="wizard-confirm-search"] input').setValue('already_registered');
		await flushPromises();

		expect(wrapper.findAll('tbody tr')).toHaveLength(1);
		expect(wrapper.text()).toContain('registered');
	});

	it('keeps full discovery totals while the confirmation table contains only adoptable rows', async () => {
		const adoptable = row();
		const wrapper = mountStep([adoptable], {
			summaryRows: [
				adoptable,
				row({ key: 'registered', identifier: 'registered', status: 'already_registered', adoptable: false }),
				row({ key: 'unsupported', identifier: 'unsupported', status: 'unsupported', adoptable: false }),
			],
		});

		await flushPromises();

		expect(wrapper.findAll('tbody tr')).toHaveLength(1);
		expect(wrapper.find('[data-test-id="wizard-inventory-found"]').text()).toBe('devicesModule.wizard.totals.found:3');
		expect(wrapper.find('[data-test-id="wizard-inventory-alreadyAdded"]').text()).toBe('devicesModule.wizard.totals.alreadyAdded:1');
		expect(wrapper.find('[data-test-id="wizard-inventory-unsupported"]').text()).toBe('devicesModule.wizard.totals.unsupported:1');
		expect(wrapper.find('[data-test-id="wizard-inventory-visible"]').text()).toBe('devicesModule.wizard.totals.visible:1');
	});

	it('keeps a large confirmation inventory inside a mobile horizontal scroller', async () => {
		const rows = Array.from({ length: 100 }, (_, index) => row({ key: `device-${index}`, identifier: `device-${index}`, label: `Device ${index}` }));
		const wrapper = mountStep(rows, {
			columns: [{ key: 'channels', label: 'Channels', steps: ['confirm'], width: 130 }],
			confirmationMode: 'selection-only',
		});

		await flushPromises();

		expect(wrapper.find('[data-test-id="wizard-inventory-found"]').text()).toBe('devicesModule.wizard.totals.found:100');
		expect(wrapper.find('[data-test-id="wizard-inventory-visible"]').text()).toBe('devicesModule.wizard.totals.visible:100');
		expect(wrapper.findAll('tbody tr')).toHaveLength(25);
		expect(wrapper.find('[data-test-id="wizard-confirm-pagination"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="wizard-confirm-table-scroll"]').classes()).toEqual(
			expect.arrayContaining(['min-h-0', 'overflow-x-auto', 'overscroll-x-contain'])
		);
		expect(wrapper.find('[data-test-id="wizard-confirm-table-scroll"] .el-table').attributes('style')).toContain('min-width: 1030px');
	});
});
