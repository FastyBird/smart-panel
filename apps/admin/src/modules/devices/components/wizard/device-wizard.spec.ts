import { computed, ref } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import { useBreakpoints } from '../../../../common';
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
		// Wrapped in vi.fn() so a single test can override it with mockReturnValueOnce to cover
		// the mobile footer branch, which this default never exercises.
		useBreakpoints: vi.fn(() => ({ isMDDevice: ref(true), isLGDevice: ref(true) })),
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

	it('clears selection and name state when Add more resets', async () => {
		const restart = vi.fn().mockResolvedValue(undefined);
		const wrapper = mountWizard(buildAdapter({ capabilities: { addMore: true }, restart }));
		await flushPromises();

		await wrapper.find('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();

		// Reconciliation pre-selects a `ready` row on first sight and fills the name from the
		// adapter's suggestion, so both are populated before we ever touch Add more.
		const nameInputBefore = wrapper.find<HTMLInputElement>('[data-test-id="wizard-step-confirm"] tbody input[type="text"]');
		const checkboxBefore = wrapper.find<HTMLInputElement>('[data-test-id="wizard-step-confirm"] tbody input[type="checkbox"]');
		expect(nameInputBefore.element.value).toBe('Living room switch');
		expect(checkboxBefore.element.checked).toBe(true);

		await wrapper.find('[data-test-id="wizard-action-adopt"]').trigger('click');
		await flushPromises();
		await wrapper.find('[data-test-id="wizard-action-addMore"]').trigger('click');
		await flushPromises();

		// The mock adapter's `rows` never change, so the wizard only ever reconciles once, on
		// mount. Revisiting confirm after Add more therefore renders straight from whatever
		// `reset()` left behind, with no second reconcile to refill it — the row shows blank/
		// unchecked here if and only if `reset()` actually cleared the state.
		await wrapper.find('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();

		const nameInputAfter = wrapper.find<HTMLInputElement>('[data-test-id="wizard-step-confirm"] tbody input[type="text"]');
		const checkboxAfter = wrapper.find<HTMLInputElement>('[data-test-id="wizard-step-confirm"] tbody input[type="checkbox"]');
		expect(nameInputAfter.element.value).toBe('');
		expect(checkboxAfter.element.checked).toBe(false);
	});

	it('renders the same action set in the mobile footer when isMDDevice is false', async () => {
		vi.mocked(useBreakpoints).mockReturnValueOnce({
			isXSDevice: computed(() => false),
			isSMDevice: computed(() => false),
			isMDDevice: computed(() => false),
			isLGDevice: computed(() => true),
			isXLDevice: computed(() => true),
			isXXLDevice: computed(() => true),
		});

		const wrapper = mountWizard(buildAdapter());
		await flushPromises();

		expect(wrapper.find('[data-test-id="wizard-action-mobile-cancel"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="wizard-action-mobile-next"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="wizard-action-cancel"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="wizard-action-next"]').exists()).toBe(false);
	});

	it('does not switch back to discover until restart resolves', async () => {
		let resolveRestart: () => void = () => {};
		const restart = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					resolveRestart = resolve;
				})
		);
		const wrapper = mountWizard(buildAdapter({ capabilities: { addMore: true }, restart }));
		await flushPromises();

		await wrapper.find('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();
		await wrapper.find('[data-test-id="wizard-action-adopt"]').trigger('click');
		await flushPromises();

		await wrapper.find('[data-test-id="wizard-action-addMore"]').trigger('click');
		await flushPromises();

		// restart() is still in flight: the shell must stay on results, not jump to discover.
		expect(wrapper.find('[data-test-id="wizard-step-results"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="wizard-step-discover"]').exists()).toBe(false);

		resolveRestart();
		await flushPromises();

		expect(wrapper.find('[data-test-id="wizard-step-discover"]').exists()).toBe(true);
	});
});
