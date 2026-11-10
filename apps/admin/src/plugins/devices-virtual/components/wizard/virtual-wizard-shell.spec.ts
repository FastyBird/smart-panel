import { defineComponent, h, ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import VirtualWizardShell from './virtual-wizard-shell.vue';

const mocks = vi.hoisted(() => ({
	push: vi.fn(),
	replace: vi.fn(),
	leaveGuards: [] as Array<() => boolean>,
	isLGDevice: false,
}));

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('vue-meta', () => ({ useMeta: () => ({}) }));
vi.mock('vue-router', () => ({
	useRouter: () => ({ push: mocks.push, replace: mocks.replace, resolve: (location: unknown) => location }),
	onBeforeRouteLeave: (guard: () => boolean) => mocks.leaveGuards.push(guard),
}));
vi.mock('../../../../modules/devices', () => ({ RouteNames: { DEVICES: 'devices' } }));
vi.mock('../../../../common', () => {
	const Stub = defineComponent({
		setup(_, { slots }) {
			return () => h('div', [slots.default?.(), slots.extra?.()]);
		},
	});

	return {
		AppBarButton: Stub,
		AppBarButtonAlign: { LEFT: 'left' },
		AppBarHeading: Stub,
		AppBreadcrumbs: Stub,
		ViewHeader: Stub,
		useBreakpoints: () => ({ isMDDevice: ref(true), isLGDevice: ref(mocks.isLGDevice) }),
	};
});

beforeEach(() => {
	vi.clearAllMocks();
	mocks.leaveGuards.length = 0;
	mocks.isLGDevice = false;
});

describe('virtual wizard shell', () => {
	const mountShell = (busy = false) =>
		mount(VirtualWizardShell, {
			props: { busy },
			slots: { default: '<div data-test-id="editor" />' },
		});

	it('wraps the editor in the wizard chrome', () => {
		const wrapper = mountShell();

		expect(wrapper.find('[data-test-id="editor"]').exists()).toBe(true);
		// The kind is chosen before the wizard starts; nothing inside it switches between kinds.
		expect(wrapper.findComponent({ name: 'ElRadioGroup' }).exists()).toBe(false);
		expect(wrapper.find('[data-test-id="wizard-cancel"]').exists()).toBe(true);
	});

	it('offers the step navigation a place in the header', () => {
		const wrapper = mountShell();

		expect(wrapper.find('#virtual-wizard-actions').exists()).toBe(true);
	});

	it.each([
		[false, 'push'],
		[true, 'replace'],
	] as const)('cancels back to the devices list (desktop: %s)', async (desktop, method) => {
		mocks.isLGDevice = desktop;
		const wrapper = mountShell();

		await wrapper.get('[data-test-id="wizard-cancel"]').trigger('click');

		expect(mocks[method]).toHaveBeenCalledWith({ name: 'devices' });
	});

	it('holds Cancel and route leaves while a save is in flight', async () => {
		const wrapper = mountShell(true);

		await wrapper.get('[data-test-id="wizard-cancel"]').trigger('click');

		expect(mocks.push).not.toHaveBeenCalled();
		expect(mocks.leaveGuards[0]()).toBe(false);

		await wrapper.setProps({ busy: false });

		expect(mocks.leaveGuards[0]()).toBe(true);
	});
});
