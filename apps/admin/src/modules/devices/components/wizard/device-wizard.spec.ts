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

// `Partial<IDeviceWizardAdapter>` flattens the discriminated union into independent optional
// fields, so the merge below can't be checked against the union itself — the cast is a test-mock
// convenience only. Every test in this file that overrides `capabilities: { addMore: true }`
// already pairs it with a `restart` handler, so the real correlation the union enforces is not
// bypassed in practice; production adapters still get the compiler check.
const buildAdapter = (overrides: Partial<IDeviceWizardAdapter> = {}): IDeviceWizardAdapter =>
	({
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
	}) as IDeviceWizardAdapter;

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

	it('swallows a dispose rejection on unmount instead of leaving it unhandled', async () => {
		// Deliberately NOT vi.fn(): vi.fn() attaches its own tracking around the call and masks
		// whether the shell itself ever attaches a rejection handler to the returned promise.
		let disposeCalled = false;
		const dispose = (): Promise<void> => {
			disposeCalled = true;

			return Promise.reject(new Error('teardown failed'));
		};
		const wrapper = mountWizard(buildAdapter({ dispose }));
		await flushPromises();

		wrapper.unmount();
		await flushPromises();

		// If the shell doesn't await/catch dispose()'s promise, this rejection surfaces as an
		// unhandled rejection and fails the test run — there is nothing else this test needs to
		// assert to catch that regression.
		expect(disposeCalled).toBe(true);
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

	it('stays on confirm when adopt rejects, keeping the user input intact', async () => {
		const adopt = vi.fn().mockRejectedValue(new Error('network'));
		const wrapper = mountWizard(buildAdapter({ adopt }));
		await flushPromises();

		await wrapper.find('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();

		// Edit the name so a real user edit is distinguishable from the adapter's own suggested
		// default, then leave the row selected (the default state).
		await wrapper.find<HTMLInputElement>('[data-test-id="wizard-step-confirm"] tbody input[type="text"]').setValue('Custom name');

		await wrapper.find('[data-test-id="wizard-action-adopt"]').trigger('click');
		await flushPromises();

		expect(wrapper.find('[data-test-id="wizard-step-confirm"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="wizard-step-results"]').exists()).toBe(false);

		// The rejection must not wipe what the user typed or ticked.
		const nameInput = wrapper.find<HTMLInputElement>('[data-test-id="wizard-step-confirm"] tbody input[type="text"]');
		const checkbox = wrapper.find<HTMLInputElement>('[data-test-id="wizard-step-confirm"] tbody input[type="checkbox"]');
		expect(nameInput.element.value).toBe('Custom name');
		expect(checkbox.element.checked).toBe(true);
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

	it('reconciles the replacement session when Add more installs new rows', async () => {
		// Zigbee2MQTT's `restart()` tears the session down and starts a new one, assigning the
		// replacement session *before* it resolves. That assignment queues the `rows` watcher,
		// which Vue flushes before the shell's `await` resumes — so the new rows are already
		// reconciled by the time `onAddMore` continues. Resetting after the await would wipe
		// that, stranding the user on a fresh session with nothing selected and blank names
		// until a later poll reconciled it again. Z2M declares no `sessionKey`, so nothing else
		// would refill it either.
		const replacement = row({ key: 'shelly-9.local', identifier: 'shelly-9.local', label: 'Hallway dimmer', suggestedName: 'Hallway dimmer' });
		const rows = ref<IWizardRow[]>([row()]);
		const restart = vi.fn(async (): Promise<void> => {
			rows.value = [replacement];
		});

		const wrapper = mountWizard(buildAdapter({ capabilities: { addMore: true }, restart, rows: computed(() => rows.value) }));
		await flushPromises();

		await wrapper.find('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();
		await wrapper.find('[data-test-id="wizard-action-adopt"]').trigger('click');
		await flushPromises();
		await wrapper.find('[data-test-id="wizard-action-addMore"]').trigger('click');
		await flushPromises();

		await wrapper.find('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();

		const nameInput = wrapper.find<HTMLInputElement>('[data-test-id="wizard-step-confirm"] tbody input[type="text"]');
		const checkbox = wrapper.find<HTMLInputElement>('[data-test-id="wizard-step-confirm"] tbody input[type="checkbox"]');

		expect(nameInput.element.value).toBe('Hallway dimmer');
		expect(checkbox.element.checked).toBe(true);
	});

	it('clears selection and name state when the adapter reports a new session', async () => {
		// Plugins without `addMore` (Shelly NG) reopen a discovery session from a discover-step
		// control the shell never sees, so `reset()` is never reached via Add more. Without the
		// session-key watch, a device that was `ready` in scan 1 and comes back as
		// `already_registered` in scan 2 would stay ticked and silently overwrite its stored
		// name and category on adopt.
		const sessionKey = ref<string | null>('session-1');
		const wrapper = mountWizard(buildAdapter({ sessionKey: computed(() => sessionKey.value) }));
		await flushPromises();

		await wrapper.find('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();

		const nameInputBefore = wrapper.find<HTMLInputElement>('[data-test-id="wizard-step-confirm"] tbody input[type="text"]');
		const checkboxBefore = wrapper.find<HTMLInputElement>('[data-test-id="wizard-step-confirm"] tbody input[type="checkbox"]');
		expect(nameInputBefore.element.value).toBe('Living room switch');
		expect(checkboxBefore.element.checked).toBe(true);

		// The user hits "Scan again": a second session id lands.
		sessionKey.value = 'session-2';
		await flushPromises();

		// The mock adapter's `rows` never change, so there is no second reconcile to refill the
		// state — the row renders blank/unchecked if and only if the watch actually reset it.
		const nameInputAfter = wrapper.find<HTMLInputElement>('[data-test-id="wizard-step-confirm"] tbody input[type="text"]');
		const checkboxAfter = wrapper.find<HTMLInputElement>('[data-test-id="wizard-step-confirm"] tbody input[type="checkbox"]');
		expect(nameInputAfter.element.value).toBe('');
		expect(checkboxAfter.element.checked).toBe(false);
	});

	it('does not reset when the first session key arrives', async () => {
		// null → id is the initial session landing, not a rescan. Reconciliation has already run
		// against these rows by then, so resetting here would wipe state nothing will refill.
		const sessionKey = ref<string | null>(null);
		const wrapper = mountWizard(buildAdapter({ sessionKey: computed(() => sessionKey.value) }));
		await flushPromises();

		await wrapper.find('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();

		sessionKey.value = 'session-1';
		await flushPromises();

		const nameInput = wrapper.find<HTMLInputElement>('[data-test-id="wizard-step-confirm"] tbody input[type="text"]');
		const checkbox = wrapper.find<HTMLInputElement>('[data-test-id="wizard-step-confirm"] tbody input[type="checkbox"]');
		expect(nameInput.element.value).toBe('Living room switch');
		expect(checkbox.element.checked).toBe(true);
	});

	it('reconciles the new session rows instead of leaving them blank when rows and sessionKey change in the same flush', async () => {
		// Mirrors the real Shelly adapters: both `rows` and `sessionKey` are computed from the
		// SAME underlying ref, so "Scan again" changes them via a single reactive trigger — the
		// backend seeds the new session from already-known devices before responding, so the
		// fresh rows arrive already populated rather than empty. Vue notifies same-flush watchers
		// in subscription order, which for a shared dependency matches watch-registration order.
		// If the `rows` watch reconciles before the `sessionKey` watch resets, the reset silently
		// wipes what reconcile just filled in, leaving the confirm step blank for about a second.
		const session = ref({ key: 'session-1', currentRow: row() });
		const wrapper = mountWizard(
			buildAdapter({
				rows: computed(() => [session.value.currentRow]),
				sessionKey: computed(() => session.value.key),
			})
		);
		await flushPromises();

		await wrapper.find('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();

		const nameInputBefore = wrapper.find<HTMLInputElement>('[data-test-id="wizard-step-confirm"] tbody input[type="text"]');
		const checkboxBefore = wrapper.find<HTMLInputElement>('[data-test-id="wizard-step-confirm"] tbody input[type="checkbox"]');
		expect(nameInputBefore.element.value).toBe('Living room switch');
		expect(checkboxBefore.element.checked).toBe(true);

		// "Scan again": a single assignment changes both `rows` and `sessionKey` together, in the
		// same reactive flush — exactly how the real adapters behave.
		session.value = { key: 'session-2', currentRow: row({ suggestedName: 'Kitchen relay' }) };
		await flushPromises();

		const nameInputAfter = wrapper.find<HTMLInputElement>('[data-test-id="wizard-step-confirm"] tbody input[type="text"]');
		const checkboxAfter = wrapper.find<HTMLInputElement>('[data-test-id="wizard-step-confirm"] tbody input[type="checkbox"]');

		// The new session's row must be reconciled (selected, name filled from the fresh
		// suggestion) — not blank, which is what reconcile-before-reset produces.
		expect(nameInputAfter.element.value).toBe('Kitchen relay');
		expect(checkboxAfter.element.checked).toBe(true);
	});

	it('keeps working for an adapter that declares no session key', async () => {
		const wrapper = mountWizard(buildAdapter());
		await flushPromises();

		await wrapper.find('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();

		const nameInput = wrapper.find<HTMLInputElement>('[data-test-id="wizard-step-confirm"] tbody input[type="text"]');
		expect(nameInput.element.value).toBe('Living room switch');
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
