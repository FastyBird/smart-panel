/* eslint-disable vue/one-component-per-file -- Isolated component stubs for plugin integration tests. */
import { computed, h, ref } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';

import { DevicesModuleDeviceCategory } from '../../../../openapi.constants';

import DeviceWizardShell from './device-wizard-shell.vue';
import type { IDeviceWizardAdapter, IWizardResult, IWizardRow } from './device-wizard.types';
import DeviceWizard from './device-wizard.vue';

vi.mock('vue-meta', () => ({ useMeta: () => ({ meta: {} }) }));

enableAutoUnmount(afterEach);

const replace = vi.fn();
const push = vi.fn();

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('vue-router', () => ({
	onBeforeRouteLeave: vi.fn(),
	onBeforeRouteUpdate: vi.fn(),
	useRouter: () => ({
		replace,
		push,
		resolve: (location: unknown) => location,
	}),
	RouterLink: { name: 'RouterLink', template: '<a><slot /></a>' },
}));

const sizeClass = vi.hoisted(() => ({ value: 'dt' }));

const sizeClassMock = () => ({
	sizeClass: ref(sizeClass.value),
	isPhone: computed(() => sizeClass.value === 'phone'),
	isTabletPortrait: computed(() => sizeClass.value === 'tp'),
	isTabletLandscape: computed(() => sizeClass.value === 'tl'),
	isDesktop: computed(() => sizeClass.value === 'dt' || sizeClass.value === 'wd'),
	isTouch: computed(() => false),
});

// The shell's stepper and footer read the size class from their own module
vi.mock('../../../../common/composables/useSizeClass', () => ({ useSizeClass: () => sizeClassMock() }));

vi.mock('../../../../common', async () => {
	const { defineComponent } = await import('vue');

	return {
		AppBreadcrumbs: defineComponent({ name: 'AppBreadcrumbs', template: '<div />' }),
		// Mirrors the real view-header.vue, which renders `title` as visible text whenever
		// `isMDDevice` is true (the condition this whole suite runs under) — without declaring
		// it as a prop here, `adapter.title` would only ever reach the DOM as a dropped
		// fallthrough attribute, and "renders the adapter title" could never observe it.
		ViewHeader: defineComponent({
			name: 'ViewHeader',
			props: { title: { type: String, default: '' }, subtitle: { type: String, default: '' } },
			template: '<div>{{ title }} {{ subtitle }}<slot name="actions" /></div>',
		}),
		// Wrapped in vi.fn() so a single test can override it with mockReturnValueOnce to cover
		// the mobile footer branch, which this default never exercises.
		useLogger: () => ({ error: vi.fn() }),
		useBreakpoints: vi.fn(() => ({ isMDDevice: ref(true), isLGDevice: ref(true) })),
		WizardShell: (await import('../../../../common/components/wizard-shell.vue')).default,
		StatusTag: (await import('../../../../common/components/status-tag.vue')).default,
		useSizeClass: () => sizeClassMock(),
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
	mount(DeviceWizardShell, {
		props: { title: adapter.title, subtitle: adapter.subtitle },
		slots: { default: () => h(DeviceWizard, { adapterFactory: () => adapter }) },
		global: { stubs: { 'router-link': true } },
	});

type Wrapper = ReturnType<typeof mountWizard>;

const NEXT = '[data-test-id="wizard-shell-next"]';
const SELECT_CHECKBOX = '[data-test-id="wizard-step-select"] tbody input[type="checkbox"]';
const CONFIRM_NAME = '[data-test-id="wizard-step-confirm"] tbody input[type="text"]';

const click = async (wrapper: Wrapper, selector: string): Promise<void> => {
	await wrapper.get(selector).trigger('click');
	await flushPromises();
};

// Discover → Select
const toSelect = (wrapper: Wrapper): Promise<void> => click(wrapper, NEXT);

// Discover → Select → Confirm
const toConfirm = async (wrapper: Wrapper): Promise<void> => {
	await click(wrapper, NEXT);
	await click(wrapper, NEXT);
};

// Confirm → Results: the primary action on Confirm adds the devices
const adopt = (wrapper: Wrapper): Promise<void> => click(wrapper, NEXT);

describe('DeviceWizard', () => {
	it('runs Discover, Select, Confirm and Results in the shared wizard shell', async () => {
		const wrapper = mountWizard(buildAdapter());
		await flushPromises();

		expect(wrapper.findAll('[data-test-id="wizard-shell-step"]').map((step) => step.text().replace(/^\d+\s*/, ''))).toEqual([
			'devicesModule.wizard.steps.discover',
			'devicesModule.wizard.steps.select',
			'devicesModule.wizard.steps.confirm',
			'devicesModule.wizard.steps.results',
		]);
		expect(wrapper.find('[data-test-id="wizard-step-discover"]').exists()).toBe(true);

		await toSelect(wrapper);
		expect(wrapper.find('[data-test-id="wizard-step-select"]').exists()).toBe(true);
		// The shell counts the devices ticked for adoption
		expect(wrapper.get('[data-test-id="wizard-shell-selected"]').text()).toBe('application.bulkActions.selected');

		await click(wrapper, NEXT);
		expect(wrapper.find('[data-test-id="wizard-step-confirm"]').exists()).toBe(true);
		expect(wrapper.get(NEXT).text()).toBe('devicesModule.wizard.actions.adopt');

		await adopt(wrapper);
		expect(wrapper.find('[data-test-id="wizard-step-results"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="wizard-shell-cancel"]').exists()).toBe(false);
	});

	it('keeps Next on Select disabled until a device is ticked', async () => {
		const wrapper = mountWizard(buildAdapter());
		await flushPromises();
		await toSelect(wrapper);

		await wrapper.get(SELECT_CHECKBOX).setValue(false);
		await flushPromises();
		expect(wrapper.get(NEXT).attributes('disabled')).toBeDefined();

		await wrapper.get(SELECT_CHECKBOX).setValue(true);
		await flushPromises();
		expect(wrapper.get(NEXT).attributes('disabled')).toBeUndefined();
	});

	it('goes back from Confirm to Select keeping the selection', async () => {
		const wrapper = mountWizard(buildAdapter());
		await flushPromises();
		await toConfirm(wrapper);

		await click(wrapper, '[data-test-id="wizard-shell-back"]');

		expect(wrapper.find('[data-test-id="wizard-step-select"]').exists()).toBe(true);
		expect(wrapper.get<HTMLInputElement>(SELECT_CHECKBOX).element.checked).toBe(true);
	});

	it('validates an empty confirmation name at its input before adopting', async () => {
		const adapter = buildAdapter();
		const wrapper = mountWizard(adapter);
		await flushPromises();
		await toConfirm(wrapper);
		await wrapper.get(CONFIRM_NAME).setValue('  ');
		await adopt(wrapper);
		expect(adapter.adopt).not.toHaveBeenCalled();
		await vi.waitFor(() =>
			expect(wrapper.get('[data-test-id="wizard-step-confirm"]').text()).toContain('devicesModule.fields.devices.name.validation.required')
		);
		await wrapper.get(CONFIRM_NAME).setValue('Kitchen');
		await adopt(wrapper);
		expect(adapter.adopt).toHaveBeenCalledWith([expect.objectContaining({ name: 'Kitchen' })]);
		wrapper.unmount();
	});

	it('keeps confirmation rows and entered values fixed during adoption despite session updates', async () => {
		const rows = ref([row()]);
		const sessionKey = ref('first');
		let reject!: (reason: Error) => void;
		const adoptFn = vi.fn(
			() =>
				new Promise<[]>((_, fail) => {
					reject = fail;
				})
		);
		const wrapper = mountWizard(buildAdapter({ rows: computed(() => rows.value), sessionKey: computed(() => sessionKey.value), adopt: adoptFn }));
		await flushPromises();
		await toConfirm(wrapper);
		await wrapper.get(CONFIRM_NAME).setValue('My switch');
		const before = wrapper.get('[data-test-id="wizard-step-confirm"]').text();
		await adopt(wrapper);
		rows.value = [row({ label: 'Changed', suggestedName: 'Changed', adoptable: false, status: 'already_registered' })];
		sessionKey.value = 'second';
		await flushPromises();
		expect(wrapper.get('[data-test-id="wizard-step-confirm"]').text()).toBe(before);
		expect(wrapper.get<HTMLInputElement>(CONFIRM_NAME).element.value).toBe('My switch');
		reject(new Error('Save failed'));
		await flushPromises();
		expect(wrapper.get('[data-test-id="wizard-step-confirm"]').text()).toBe(before);
		expect(adoptFn).toHaveBeenCalledTimes(1);
		adoptFn.mockResolvedValueOnce([]);
		await adopt(wrapper);
		expect(adoptFn).toHaveBeenCalledTimes(2);
		expect(adoptFn.mock.calls[1]).toEqual(adoptFn.mock.calls[0]);
		expect(wrapper.find('[data-test-id="wizard-step-results"]').exists()).toBe(true);
		wrapper.unmount();
	});

	it('guards unsaved confirmation changes and clears the guard on successful adoption', async () => {
		const wrapper = mountWizard(buildAdapter());
		await flushPromises();
		await toConfirm(wrapper);
		const leaving = () => {
			const event = new Event('beforeunload', { cancelable: true });
			window.dispatchEvent(event);
			return event.defaultPrevented;
		};
		expect(leaving()).toBe(false);
		await wrapper.get(CONFIRM_NAME).setValue('Unsaved device');
		expect(leaving()).toBe(true);
		await adopt(wrapper);
		expect(leaving()).toBe(false);
	});

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

	it('advances even when beforeLeaveDiscover rejects', async () => {
		const beforeLeaveDiscover = vi.fn().mockRejectedValue(new Error('permit-join off failed'));
		const wrapper = mountWizard(buildAdapter({ beforeLeaveDiscover }));
		await flushPromises();

		await toSelect(wrapper);

		expect(beforeLeaveDiscover).toHaveBeenCalledOnce();
		expect(wrapper.find('[data-test-id="wizard-step-select"]').exists()).toBe(true);
	});

	it('stays on confirm when adopt rejects, keeping the user input intact', async () => {
		const wrapper = mountWizard(buildAdapter({ adopt: vi.fn().mockRejectedValue(new Error('network')) }));
		await flushPromises();
		await toConfirm(wrapper);

		// Edit the name so a real user edit is distinguishable from the adapter's own suggested default
		await wrapper.get(CONFIRM_NAME).setValue('Custom name');

		await adopt(wrapper);

		expect(wrapper.find('[data-test-id="wizard-step-confirm"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="wizard-step-results"]').exists()).toBe(false);

		// The rejection must not wipe what the user typed or ticked.
		expect(wrapper.get<HTMLInputElement>(CONFIRM_NAME).element.value).toBe('Custom name');

		await click(wrapper, '[data-test-id="wizard-shell-back"]');

		expect(wrapper.get<HTMLInputElement>(SELECT_CHECKBOX).element.checked).toBe(true);
	});

	it('hides Add more when the plugin does not declare the capability', async () => {
		const wrapper = mountWizard(buildAdapter());
		await flushPromises();
		await toConfirm(wrapper);
		await adopt(wrapper);

		expect(wrapper.find('[data-test-id="wizard-action-addMore"]').exists()).toBe(false);
		expect(wrapper.get(NEXT).text()).toBe('devicesModule.wizard.actions.done');
	});

	it('shows Add more and returns to discover after restart resolves', async () => {
		const restart = vi.fn().mockResolvedValue(undefined);
		const wrapper = mountWizard(buildAdapter({ capabilities: { addMore: true }, restart }));
		await flushPromises();
		await toConfirm(wrapper);
		await adopt(wrapper);
		await click(wrapper, '[data-test-id="wizard-action-addMore"]');

		expect(restart).toHaveBeenCalledOnce();
		expect(wrapper.find('[data-test-id="wizard-step-discover"]').exists()).toBe(true);
	});

	it('clears selection and name state when Add more resets', async () => {
		const restart = vi.fn().mockResolvedValue(undefined);
		const wrapper = mountWizard(buildAdapter({ capabilities: { addMore: true }, restart }));
		await flushPromises();
		await toSelect(wrapper);

		// Reconciliation pre-selects a `ready` row on first sight, so it is ticked before we ever touch Add more
		expect(wrapper.get<HTMLInputElement>(SELECT_CHECKBOX).element.checked).toBe(true);

		await click(wrapper, NEXT);
		await adopt(wrapper);
		await click(wrapper, '[data-test-id="wizard-action-addMore"]');

		// The mock adapter's `rows` never change, so the wizard only ever reconciles once, on mount. Revisiting Select
		// after Add more renders straight from whatever `reset()` left behind: unticked if and only if it cleared the state
		await toSelect(wrapper);

		expect(wrapper.get<HTMLInputElement>(SELECT_CHECKBOX).element.checked).toBe(false);
		expect(wrapper.get(NEXT).attributes('disabled')).toBeDefined();
	});

	it('promotes a plugin action control into the footer and wires it to the control handler', async () => {
		const handler = vi.fn();
		const wrapper = mountWizard(
			buildAdapter({
				controls: computed(() => [{ type: 'action' as const, id: 'restart-scan', label: 'Scan again', icon: 'mdi:radar', handler }]),
			})
		);
		await flushPromises();

		const promoted = wrapper.find('[data-test-id="wizard-shell-footer"] [data-test-id="wizard-action-control-restart-scan"]');
		expect(promoted.exists()).toBe(true);
		expect(promoted.text()).toContain('Scan again');

		await promoted.trigger('click');

		expect(handler).toHaveBeenCalledOnce();
	});

	it('drops the promoted action once the user leaves the discover step', async () => {
		const wrapper = mountWizard(
			buildAdapter({
				controls: computed(() => [{ type: 'action' as const, id: 'restart-scan', label: 'Scan again', icon: 'mdi:radar', handler: vi.fn() }]),
			})
		);
		await flushPromises();
		await toSelect(wrapper);

		expect(wrapper.find('[data-test-id="wizard-action-control-restart-scan"]').exists()).toBe(false);
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
		await toConfirm(wrapper);
		await adopt(wrapper);
		await click(wrapper, '[data-test-id="wizard-action-addMore"]');

		await toSelect(wrapper);
		expect(wrapper.get<HTMLInputElement>(SELECT_CHECKBOX).element.checked).toBe(true);

		await click(wrapper, NEXT);
		expect(wrapper.get<HTMLInputElement>(CONFIRM_NAME).element.value).toBe('Hallway dimmer');
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
		await toSelect(wrapper);

		expect(wrapper.get<HTMLInputElement>(SELECT_CHECKBOX).element.checked).toBe(true);

		// The user hits "Scan again": a second session id lands.
		sessionKey.value = 'session-2';
		await flushPromises();

		// The mock adapter's `rows` never change, so there is no second reconcile to refill the
		// state — the row renders unticked if and only if the watch actually reset it.
		expect(wrapper.get<HTMLInputElement>(SELECT_CHECKBOX).element.checked).toBe(false);
	});

	it('does not reset when the first session key arrives', async () => {
		// null → id is the initial session landing, not a rescan. Reconciliation has already run
		// against these rows by then, so resetting here would wipe state nothing will refill.
		const sessionKey = ref<string | null>(null);
		const wrapper = mountWizard(buildAdapter({ sessionKey: computed(() => sessionKey.value) }));
		await flushPromises();
		await toSelect(wrapper);

		sessionKey.value = 'session-1';
		await flushPromises();

		expect(wrapper.get<HTMLInputElement>(SELECT_CHECKBOX).element.checked).toBe(true);

		await click(wrapper, NEXT);
		expect(wrapper.get<HTMLInputElement>(CONFIRM_NAME).element.value).toBe('Living room switch');
	});

	it('reconciles the new session rows instead of leaving them blank when rows and sessionKey change in the same flush', async () => {
		// Mirrors the real Shelly adapters: both `rows` and `sessionKey` are computed from the
		// SAME underlying ref, so "Scan again" changes them via a single reactive trigger — the
		// backend seeds the new session from already-known devices before responding, so the
		// fresh rows arrive already populated rather than empty. Vue notifies same-flush watchers
		// in subscription order, which for a shared dependency matches watch-registration order.
		// If the `rows` watch reconciles before the `sessionKey` watch resets, the reset silently
		// wipes what reconcile just filled in, leaving the step blank for about a second.
		const session = ref({ key: 'session-1', currentRow: row() });
		const wrapper = mountWizard(
			buildAdapter({
				rows: computed(() => [session.value.currentRow]),
				sessionKey: computed(() => session.value.key),
			})
		);
		await flushPromises();
		await toSelect(wrapper);

		expect(wrapper.get<HTMLInputElement>(SELECT_CHECKBOX).element.checked).toBe(true);

		// "Scan again": a single assignment changes both `rows` and `sessionKey` together, in the
		// same reactive flush — exactly how the real adapters behave.
		session.value = { key: 'session-2', currentRow: row({ suggestedName: 'Kitchen relay' }) };
		await flushPromises();

		// The new session's row must be reconciled (selected, name filled from the fresh
		// suggestion) — not blank, which is what reconcile-before-reset produces.
		expect(wrapper.get<HTMLInputElement>(SELECT_CHECKBOX).element.checked).toBe(true);

		await click(wrapper, NEXT);
		expect(wrapper.get<HTMLInputElement>(CONFIRM_NAME).element.value).toBe('Kitchen relay');
	});

	it('keeps working for an adapter that declares no session key', async () => {
		const wrapper = mountWizard(buildAdapter());
		await flushPromises();
		await toConfirm(wrapper);

		expect(wrapper.get<HTMLInputElement>(CONFIRM_NAME).element.value).toBe('Living room switch');
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
		await toConfirm(wrapper);
		await adopt(wrapper);

		await click(wrapper, '[data-test-id="wizard-action-addMore"]');

		// restart() is still in flight: the shell must stay on results, not jump to discover.
		expect(wrapper.find('[data-test-id="wizard-step-results"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="wizard-step-discover"]').exists()).toBe(false);

		resolveRestart();
		await flushPromises();

		expect(wrapper.find('[data-test-id="wizard-step-discover"]').exists()).toBe(true);
	});

	it('retries only the failed devices and keeps the rest of the results', async () => {
		const rows = [row(), row({ key: 'b', identifier: 'b', label: 'Kitchen', suggestedName: 'Kitchen' })];
		const first: IWizardResult[] = [
			{ key: 'shelly-1.local', name: 'Living room switch', identifier: 'shelly-1.local', status: 'created', error: null },
			{ key: 'b', name: 'Kitchen', identifier: 'b', status: 'failed', error: 'Timeout' },
		];
		const results = ref<IWizardResult[]>([]);
		const adoptFn = vi
			.fn()
			.mockImplementationOnce(async () => {
				results.value = first;
				return first;
			})
			.mockImplementationOnce(async () => {
				const retried: IWizardResult[] = [{ key: 'b', name: 'Kitchen', identifier: 'b', status: 'created', error: null }];
				results.value = retried;
				return retried;
			});
		const wrapper = mountWizard(buildAdapter({ rows: computed(() => rows), results: computed(() => results.value), adopt: adoptFn }));
		await flushPromises();
		await toConfirm(wrapper);
		await adopt(wrapper);

		expect(wrapper.findAll('[data-test-id="wizard-result-retry"]')).toHaveLength(1);

		await click(wrapper, '[data-test-id="wizard-action-retryFailed"]');

		expect(adoptFn).toHaveBeenLastCalledWith([{ key: 'b', name: 'Kitchen', category: DevicesModuleDeviceCategory.lighting }]);
		// Both devices are listed, the retried one with its new outcome
		const text = wrapper.get('[data-test-id="wizard-step-results"]').text();
		expect(text).toContain('Living room switch');
		expect(text).toContain('Kitchen');
		expect(wrapper.find('[data-test-id="wizard-result-retry"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="wizard-action-retryFailed"]').exists()).toBe(false);
	});

	it('retries a single failed device from its row', async () => {
		const failed: IWizardResult[] = [
			{ key: 'shelly-1.local', name: 'Living room switch', identifier: 'shelly-1.local', status: 'failed', error: 'Timeout' },
		];
		const adoptFn = vi
			.fn()
			.mockResolvedValueOnce(failed)
			.mockResolvedValueOnce([{ ...failed[0], status: 'created', error: null }]);
		const wrapper = mountWizard(buildAdapter({ results: computed(() => failed), adopt: adoptFn }));
		await flushPromises();
		await toConfirm(wrapper);
		await adopt(wrapper);

		await click(wrapper, '[data-test-id="wizard-result-retry"]');

		expect(adoptFn).toHaveBeenCalledTimes(2);
		expect(adoptFn.mock.calls[1]).toEqual(adoptFn.mock.calls[0]);
		expect(wrapper.get('[data-test-id="wizard-step-results"]').text()).toContain('devicesModule.wizard.statuses.created');
	});
});
