/* eslint-disable vue/one-component-per-file */
import { computed, defineComponent, h, ref } from 'vue';
import { RouterView, createMemoryHistory, createRouter } from 'vue-router';

import { ElMessageBox } from 'element-plus';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import { useDeviceWizardComplete, useDeviceWizardFlow } from './device-wizard-flow';
import DeviceWizardShell from './device-wizard-shell.vue';
import type { IWizardAction } from './device-wizard.types';

const sizeClass = vi.hoisted(() => ({ value: 'dt' }));

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('vue-meta', () => ({ useMeta: () => ({ meta: {} }) }));
vi.mock('../../../../common/composables/useSizeClass', async () => {
	const { computed, ref } = await import('vue');

	return {
		useSizeClass: () => ({
			sizeClass: ref(sizeClass.value),
			isPhone: computed(() => sizeClass.value === 'phone'),
			isTabletPortrait: computed(() => sizeClass.value === 'tp'),
			isTabletLandscape: computed(() => sizeClass.value === 'tl'),
			isDesktop: computed(() => sizeClass.value === 'dt' || sizeClass.value === 'wd'),
			isTouch: computed(() => false),
		}),
	};
});
vi.mock('../../../../common', async () => ({
	AppBreadcrumbs: defineComponent({ template: '<div />' }),
	ViewHeader: defineComponent({
		props: { title: { type: String, default: '' } },
		template: '<header><h1>{{ title }}</h1><slot name="actions" /></header>',
	}),
	WizardShell: (await import('../../../../common/components/wizard-shell.vue')).default,
	useLogger: () => ({ error: vi.fn() }),
	useSizeClass: (await import('../../../../common/composables/useSizeClass')).useSizeClass,
}));

afterEach(() => {
	vi.restoreAllMocks();
	sizeClass.value = 'dt';
});

const setup = async (extraActions: IWizardAction[] = []) => {
	const busy = ref(false),
		dirty = ref(false);
	let complete = () => {};
	const action = vi.fn();
	const Flow = defineComponent({
		setup() {
			complete = useDeviceWizardComplete();
			useDeviceWizardFlow(
				computed(() => ({
					steps: ['Configure', 'Review'],
					activeStep: 0,
					busy: busy.value,
					dirty: dirty.value,
					actions: [
						...extraActions,
						{ id: 'cancel', label: 'Cancel', variant: 'link', handler: vi.fn() },
						{ id: 'back', label: 'Back', variant: 'default', handler: vi.fn() },
						{ id: 'next', label: 'Next', variant: 'primary', handler: action },
					],
				}))
			);
			return () => h('p', 'Plugin content');
		},
	});
	const Page = defineComponent({ setup: () => () => h(DeviceWizardShell, { title: 'Add device' }, { default: () => h(Flow) }) });
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/devices', name: 'devices_module-devices', component: { template: '<p>Devices</p>' } },
			{ path: '/wizard', component: Page },
		],
	});
	await router.push('/wizard');
	await router.isReady();
	const wrapper = mount(RouterView, { global: { plugins: [router] } });
	await flushPromises();
	return { wrapper, router, busy, dirty, action, complete: () => complete() };
};

describe('shared device wizard shell', () => {
	it('puts the flow into the shared wizard shell: stepper, step card and one footer', async () => {
		const { wrapper, action } = await setup();
		expect(wrapper.findAll('[data-test-id="wizard-shell-step"]').map((step) => step.text().replace(/^\d+\s*/, ''))).toEqual(['Configure', 'Review']);
		expect(wrapper.get('[data-test-id="wizard-shell-step-card"]').text()).toContain('Plugin content');
		const footer = wrapper.get('[data-test-id="wizard-shell-footer"]');
		expect(footer.findAll('button').map((button) => button.text())).toEqual([
			'application.wizardShell.cancel',
			'application.wizardShell.back',
			'Next',
		]);
		expect(wrapper.find('header [data-test-id="wizard-shell-next"]').exists()).toBe(false);
		await wrapper.get('[data-test-id="wizard-shell-next"]').trigger('click');
		expect(action).toHaveBeenCalledOnce();
		wrapper.unmount();
	});

	it('keeps further flow actions beside the shell buttons', async () => {
		const extra = vi.fn();
		const { wrapper } = await setup([{ id: 'scan', label: 'Scan again', variant: 'default', handler: extra }]);
		const footer = wrapper.get('[data-test-id="wizard-shell-footer"]');
		expect(footer.findAll('button').map((button) => button.text())).toEqual([
			'application.wizardShell.cancel',
			'Scan again',
			'application.wizardShell.back',
			'Next',
		]);
		await wrapper.get('[data-test-id="wizard-action-scan"]').trigger('click');
		expect(extra).toHaveBeenCalledOnce();
		wrapper.unmount();
	});

	it('shows a progress bar in place of the stepper on phone', async () => {
		sizeClass.value = 'phone';
		const { wrapper } = await setup();
		expect(wrapper.find('[data-test-id="wizard-shell-progress"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="wizard-shell-stepper"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="wizard-shell-next"]').exists()).toBe(true);
		wrapper.unmount();
	});

	it('blocks both buttons and route navigation while a mutation is in flight', async () => {
		const { wrapper, router, busy, action } = await setup();
		busy.value = true;
		await flushPromises();
		expect(wrapper.get('[data-test-id="wizard-shell-next"]').attributes('disabled')).toBeDefined();
		await router.push('/devices');
		expect(router.currentRoute.value.path).toBe('/wizard');
		expect(action).not.toHaveBeenCalled();
		wrapper.unmount();
	});

	it('keeps a dirty draft when discard is declined, and leaves only after confirmation', async () => {
		const { wrapper, router, dirty } = await setup();
		dirty.value = true;
		const confirm = vi
			.spyOn(ElMessageBox, 'confirm')
			.mockRejectedValueOnce('cancel')
			.mockResolvedValueOnce('confirm' as Awaited<ReturnType<typeof ElMessageBox.confirm>>);
		await router.push('/devices');
		expect(router.currentRoute.value.path).toBe('/wizard');
		await router.push('/devices');
		expect(router.currentRoute.value.path).toBe('/devices');
		expect(confirm).toHaveBeenCalledTimes(2);
		wrapper.unmount();
	});

	it('lets a confirmed create open its detail before the producer clears its pending flag', async () => {
		const { wrapper, router, busy, dirty, complete } = await setup();
		busy.value = true;
		dirty.value = true;
		complete();
		await router.push('/devices');
		expect(router.currentRoute.value.path).toBe('/devices');
		wrapper.unmount();
	});

	it('serializes rapid clicks while an asynchronous step transition is pending', async () => {
		const { wrapper, action } = await setup();
		let resolve!: () => void;
		action.mockImplementation(
			() =>
				new Promise<void>((done) => {
					resolve = done;
				})
		);
		await wrapper.get('[data-test-id="wizard-shell-next"]').trigger('click');
		await wrapper.get('[data-test-id="wizard-shell-next"]').trigger('click');
		expect(action).toHaveBeenCalledOnce();
		resolve();
		await flushPromises();
		wrapper.unmount();
	});
});
