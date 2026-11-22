import { computed, ref } from 'vue';

import { ElSelect } from 'element-plus';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import type { SizeClass } from '../../../../common/composables/types';
import { DevicesModuleDeviceCategory } from '../../../../openapi.constants';

import DeviceWizardConfirmStep from './device-wizard-confirm-step.vue';
import type { IWizardRow } from './device-wizard.types';

const sizeClass = ref<SizeClass>('dt');

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../../common', async () => ({
	StatusTag: (await import('../../../../common/components/status-tag.vue')).default,
	useSizeClass: () => ({
		sizeClass,
		isPhone: computed(() => sizeClass.value === 'phone'),
		isTabletPortrait: computed(() => sizeClass.value === 'tp'),
		isTabletLandscape: computed(() => sizeClass.value === 'tl'),
		isDesktop: computed(() => sizeClass.value === 'dt' || sizeClass.value === 'wd'),
		isTouch: computed(() => false),
	}),
}));

const row = (overrides: Partial<IWizardRow> = {}): IWizardRow => ({
	key: 'shelly-1.local',
	label: 'Living room switch',
	subLabel: null,
	identifier: 'shelly-1.local',
	status: 'ready',
	adoptable: true,
	willUpdate: false,
	suggestedName: 'Living room switch',
	suggestedCategory: DevicesModuleDeviceCategory.lighting,
	categoryOptions: [
		{ value: DevicesModuleDeviceCategory.lighting, label: 'Lighting' },
		{ value: DevicesModuleDeviceCategory.switcher, label: 'Switcher' },
	],
	...overrides,
});

const mountStep = (rows: IWizardRow[] = [row()], props: Record<string, unknown> = {}) =>
	mount(DeviceWizardConfirmStep, {
		props: {
			rows,
			nameByKey: Object.fromEntries(rows.map((item) => [item.key, item.suggestedName])),
			categoryByKey: Object.fromEntries(rows.map((item) => [item.key, item.suggestedCategory])),
			identifierLabel: 'Hostname',
			confirmationMode: 'editable',
			...props,
		},
	});

describe('DeviceWizardConfirmStep', () => {
	beforeEach(() => {
		sizeClass.value = 'dt';
	});

	it('lists the selected devices in a table from tablet landscape up', async () => {
		const wrapper = mountStep([row(), row({ key: 'b', identifier: 'b', suggestedName: 'Kitchen', willUpdate: true })]);
		await flushPromises();

		expect(wrapper.find('[data-test-id="wizard-confirm-table"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="wizard-confirm-cards"]').exists()).toBe(false);
		expect(wrapper.findAll('tbody tr')).toHaveLength(2);
		expect(wrapper.text()).toContain('devicesModule.wizard.statuses.willCreate');
		expect(wrapper.text()).toContain('devicesModule.wizard.statuses.willUpdate');
	});

	it.each<SizeClass>(['tp', 'phone'])('shows one card per device on %s', async (size) => {
		sizeClass.value = size;

		const wrapper = mountStep([row(), row({ key: 'b', identifier: 'b', suggestedName: 'Kitchen' })]);
		await flushPromises();

		expect(wrapper.find('[data-test-id="wizard-confirm-table"]').exists()).toBe(false);

		const cards = wrapper.findAll('[data-test-id="wizard-confirm-card"]');

		expect(cards).toHaveLength(2);
		expect(cards[0].text()).toContain('Hostname');
		expect(cards[0].find('input[type="text"]').exists()).toBe(true);
		expect(cards[0].findComponent(ElSelect).exists()).toBe(true);
	});

	it('emits the edited name and category with the device key', async () => {
		const wrapper = mountStep();
		await flushPromises();

		await wrapper.get('tbody input[type="text"]').setValue('Renamed');
		await wrapper.findComponent(ElSelect).setValue(DevicesModuleDeviceCategory.switcher);

		expect(wrapper.emitted('update-name')?.[0]).toEqual(['shelly-1.local', 'Renamed']);
		expect(wrapper.emitted('update-category')?.[0]).toEqual(['shelly-1.local', DevicesModuleDeviceCategory.switcher]);
	});

	it('keeps the order while a name is typed', async () => {
		const wrapper = mountStep([
			row({ key: 'a', identifier: 'a', suggestedName: 'Apple' }),
			row({ key: 'b', identifier: 'b', suggestedName: 'Zebra' }),
		]);
		await flushPromises();

		await wrapper.setProps({ nameByKey: { a: 'Zzz', b: 'Zebra' } });

		expect(wrapper.findAll('tbody tr').map((tr) => tr.find('code').text())).toEqual(['a', 'b']);
	});

	it.each<SizeClass>(['dt', 'tp'])('shows automatic names and categories read-only in selection-only mode (%s)', async (size) => {
		sizeClass.value = size;

		const wrapper = mountStep([row()], { confirmationMode: 'selection-only' });
		await flushPromises();

		expect(wrapper.find('input[type="text"]').exists()).toBe(false);
		expect(wrapper.findComponent(ElSelect).exists()).toBe(false);
		expect(wrapper.text()).toContain('Living room switch');
		expect(wrapper.text()).toContain('Lighting');
	});
});
