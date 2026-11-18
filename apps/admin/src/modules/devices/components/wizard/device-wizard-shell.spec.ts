/* eslint-disable vue/one-component-per-file */
import { computed, defineComponent, h, ref } from 'vue';
import { RouterView, createMemoryHistory, createRouter } from 'vue-router';

import { ElMessageBox } from 'element-plus';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import { useDeviceWizardComplete, useDeviceWizardFlow } from './device-wizard-flow';
import DeviceWizardShell from './device-wizard-shell.vue';

const viewport = vi.hoisted(() => ({ isMDDevice: undefined as unknown as { value: boolean } }));

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('vue-meta', () => ({ useMeta: () => ({ meta: {} }) }));
vi.mock('../../../../common', () => ({
	AppBreadcrumbs: defineComponent({ template: '<div />' }),
	ViewHeader: defineComponent({
		props: { heading: { type: String, default: '' } },
		template: '<header><h1>{{ heading }}</h1><slot name="extra" /></header>',
	}),
	useBreakpoints: () => {
		viewport.isMDDevice = ref(true);
		return { isMDDevice: viewport.isMDDevice };
	},
	useLogger: () => ({ error: vi.fn() }),
}));

afterEach(() => vi.restoreAllMocks());

const setup = async () => {
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
	it('keeps navigation in one footer on desktop and mobile', async () => {
		const { wrapper, action } = await setup();
		expect(wrapper.text()).toContain('Configure');
		expect(wrapper.text()).toContain('Plugin content');
		const footer = wrapper.get('[data-test-id="wizard-footer"]');
		expect(footer.find('[data-test-id="wizard-action-cancel"]').exists()).toBe(true);
		expect(
			footer
				.get('[data-test-id="wizard-navigation-actions"]')
				.findAll('button')
				.map((button) => button.text())
		).toEqual(['Back', 'Next']);
		expect(wrapper.find('header [data-test-id="wizard-action-next"]').exists()).toBe(false);
		await wrapper.get('[data-test-id="wizard-action-next"]').trigger('click');
		expect(action).toHaveBeenCalledOnce();
		viewport.isMDDevice.value = false;
		await flushPromises();
		expect(wrapper.findAll('[data-test-id="wizard-actions"]')).toHaveLength(1);
		expect(wrapper.get('[data-test-id="wizard-footer"]').find('[data-test-id="wizard-action-next"]').exists()).toBe(true);
		await wrapper.get('[data-test-id="wizard-action-next"]').trigger('click');
		expect(action).toHaveBeenCalledTimes(2);
		wrapper.unmount();
	});

	it('blocks both buttons and route navigation while a mutation is in flight', async () => {
		const { wrapper, router, busy, action } = await setup();
		busy.value = true;
		await flushPromises();
		expect(wrapper.get('[data-test-id="wizard-action-next"]').attributes('disabled')).toBeDefined();
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
		await wrapper.get('[data-test-id="wizard-action-next"]').trigger('click');
		await wrapper.get('[data-test-id="wizard-action-next"]').trigger('click');
		expect(action).toHaveBeenCalledOnce();
		resolve();
		await flushPromises();
		wrapper.unmount();
	});
});
