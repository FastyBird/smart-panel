import { computed, ref } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import { DevicesModuleDeviceCategory } from '../../../../openapi.constants';

import type { IDeviceWizardAdapter, IWizardResult, IWizardRow } from './device-wizard.types';
import DeviceWizard from './device-wizard.vue';

const replace = vi.fn();
const push = vi.fn();

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('vue-router', () => ({
	useRouter: () => ({
		replace,
		push,
		resolve: (location: unknown) => location,
	}),
	RouterLink: { name: 'RouterLink', template: '<a><slot /></a>' },
}));

vi.mock('../../../../common', async () => {
	const { defineComponent } = await import('vue');

	return {
		AppBarButton: defineComponent({ name: 'AppBarButton', template: '<div><slot /></div>' }),
		AppBarButtonAlign: { LEFT: 'left' },
		AppBarHeading: defineComponent({ name: 'AppBarHeading', template: '<div><slot /></div>' }),
		AppBreadcrumbs: defineComponent({ name: 'AppBreadcrumbs', template: '<div />' }),
		// Mirrors the real view-header.vue, which renders `heading` as visible text whenever
		// `isMDDevice` is true (the condition this whole suite runs under) — without declaring
		// it as a prop here, `adapter.title` would only ever reach the DOM as a dropped
		// fallthrough attribute, and "renders the adapter title" could never observe it.
		ViewHeader: defineComponent({
			name: 'ViewHeader',
			props: { heading: { type: String, default: '' }, subHeading: { type: String, default: '' } },
			template: '<div>{{ heading }} {{ subHeading }}<slot name="extra" /></div>',
		}),
		useBreakpoints: () => ({ isMDDevice: ref(true), isLGDevice: ref(true) }),
	};
});

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
	categoryOptions: [{ value: DevicesModuleDeviceCategory.lighting, label: 'Lighting' }],
	...overrides,
});

const buildAdapter = (overrides: Partial<IDeviceWizardAdapter> = {}): IDeviceWizardAdapter => ({
	title: 'Shelly NG',
	subtitle: 'Add Shelly devices',
	breadcrumbLabel: 'Wizard',
	pluginType: 'devices-shelly-ng-plugin',
	identifierLabel: 'Hostname',
	rows: computed(() => [row()]),
	results: computed<IWizardResult[]>(() => []),
	columns: [],
	controls: computed(() => []),
	ready: computed(() => true),
	busy: computed(() => false),
	capabilities: { addMore: false },
	start: vi.fn().mockResolvedValue(undefined),
	adopt: vi.fn().mockResolvedValue([]),
	...overrides,
});

const mountWizard = (adapter: IDeviceWizardAdapter) =>
	mount(DeviceWizard, {
		props: { adapterFactory: () => adapter },
		global: { stubs: { 'router-link': true } },
	});

describe('DeviceWizard', () => {
	it('calls start on mount', async () => {
		const adapter = buildAdapter();
		mountWizard(adapter);
		await flushPromises();

		expect(adapter.start).toHaveBeenCalledOnce();
	});

	it('calls dispose on unmount', async () => {
		const dispose = vi.fn().mockResolvedValue(undefined);
		const wrapper = mountWizard(buildAdapter({ dispose }));
		await flushPromises();

		wrapper.unmount();

		expect(dispose).toHaveBeenCalledOnce();
	});

	it('renders the adapter title', async () => {
		const wrapper = mountWizard(buildAdapter());
		await flushPromises();

		expect(wrapper.text()).toContain('Shelly NG');
	});

	it('advances to confirm and reconciles the rows', async () => {
		const wrapper = mountWizard(buildAdapter());
		await flushPromises();

		await wrapper.find('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();

		expect(wrapper.find('[data-test-id="wizard-step-confirm"]').exists()).toBe(true);
	});

	it('advances even when beforeLeaveDiscover rejects', async () => {
		const beforeLeaveDiscover = vi.fn().mockRejectedValue(new Error('permit-join off failed'));
		const wrapper = mountWizard(buildAdapter({ beforeLeaveDiscover }));
		await flushPromises();

		await wrapper.find('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();

		expect(beforeLeaveDiscover).toHaveBeenCalledOnce();
		expect(wrapper.find('[data-test-id="wizard-step-confirm"]').exists()).toBe(true);
	});

	it('stays on confirm when adopt rejects', async () => {
		const adopt = vi.fn().mockRejectedValue(new Error('network'));
		const wrapper = mountWizard(buildAdapter({ adopt }));
		await flushPromises();

		await wrapper.find('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();
		await wrapper.find('[data-test-id="wizard-action-adopt"]').trigger('click');
		await flushPromises();

		expect(wrapper.find('[data-test-id="wizard-step-confirm"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="wizard-step-results"]').exists()).toBe(false);
	});

	it('advances to results when adopt resolves', async () => {
		const wrapper = mountWizard(buildAdapter());
		await flushPromises();

		await wrapper.find('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();
		await wrapper.find('[data-test-id="wizard-action-adopt"]').trigger('click');
		await flushPromises();

		expect(wrapper.find('[data-test-id="wizard-step-results"]').exists()).toBe(true);
	});

	it('hides Add more when the plugin does not declare the capability', async () => {
		const wrapper = mountWizard(buildAdapter());
		await flushPromises();

		await wrapper.find('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();
		await wrapper.find('[data-test-id="wizard-action-adopt"]').trigger('click');
		await flushPromises();

		expect(wrapper.find('[data-test-id="wizard-action-addMore"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="wizard-action-done"]').exists()).toBe(true);
	});

	it('shows Add more and returns to discover after restart resolves', async () => {
		const restart = vi.fn().mockResolvedValue(undefined);
		const wrapper = mountWizard(buildAdapter({ capabilities: { addMore: true }, restart }));
		await flushPromises();

		await wrapper.find('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();
		await wrapper.find('[data-test-id="wizard-action-adopt"]').trigger('click');
		await flushPromises();
		await wrapper.find('[data-test-id="wizard-action-addMore"]').trigger('click');
		await flushPromises();

		expect(restart).toHaveBeenCalledOnce();
		expect(wrapper.find('[data-test-id="wizard-step-discover"]').exists()).toBe(true);
	});
});
