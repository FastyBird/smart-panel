import { defineComponent, h, ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import { DevicesVirtualPluginDeviceMode } from '../../../../openapi.constants';

import VirtualWizardModeSelector from './virtual-wizard-mode-selector.vue';
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

const routes: [DevicesVirtualPluginDeviceMode, unknown][] = [
	[DevicesVirtualPluginDeviceMode.projection, { name: 'devices_virtual-wizard' }],
	[
		DevicesVirtualPluginDeviceMode.sensor_aggregate,
		{ name: 'devices_virtual-measurement_wizard', query: { mode: DevicesVirtualPluginDeviceMode.sensor_aggregate } },
	],
	[
		DevicesVirtualPluginDeviceMode.sensor_transform,
		{ name: 'devices_virtual-measurement_wizard', query: { mode: DevicesVirtualPluginDeviceMode.sensor_transform } },
	],
	[DevicesVirtualPluginDeviceMode.actuator_group, { name: 'devices_virtual-light_group_wizard' }],
	[DevicesVirtualPluginDeviceMode.climate_controller, { name: 'devices_virtual-thermostat_wizard' }],
];

beforeEach(() => {
	vi.clearAllMocks();
	mocks.leaveGuards.length = 0;
	mocks.isLGDevice = false;
});

describe('virtual wizard mode selector', () => {
	it.each(routes)('routes %s to its authoring page', (mode, location) => {
		const current =
			mode === DevicesVirtualPluginDeviceMode.projection ? DevicesVirtualPluginDeviceMode.actuator_group : DevicesVirtualPluginDeviceMode.projection;
		const wrapper = mount(VirtualWizardModeSelector, { props: { mode: current } });

		wrapper.findComponent({ name: 'ElRadioGroup' }).vm.$emit('change', mode);

		expect(mocks.push).toHaveBeenCalledWith(location);
	});

	it('highlights the current kind and does not navigate to it again', () => {
		const wrapper = mount(VirtualWizardModeSelector, { props: { mode: DevicesVirtualPluginDeviceMode.actuator_group } });
		const group = wrapper.findComponent({ name: 'ElRadioGroup' });

		expect(group.props('modelValue')).toBe(DevicesVirtualPluginDeviceMode.actuator_group);
		group.vm.$emit('change', DevicesVirtualPluginDeviceMode.actuator_group);

		expect(mocks.push).not.toHaveBeenCalled();
	});

	it('does not navigate while a save is in flight', () => {
		const wrapper = mount(VirtualWizardModeSelector, { props: { mode: DevicesVirtualPluginDeviceMode.projection, disabled: true } });

		wrapper.findComponent({ name: 'ElRadioGroup' }).vm.$emit('change', DevicesVirtualPluginDeviceMode.actuator_group);

		expect(mocks.push).not.toHaveBeenCalled();
	});
});

describe('virtual wizard shell', () => {
	const mountShell = (busy = false) =>
		mount(VirtualWizardShell, {
			props: { mode: DevicesVirtualPluginDeviceMode.sensor_aggregate, busy },
			slots: { default: '<div data-test-id="editor" />' },
		});

	it('wraps the editor in the wizard chrome with its kind highlighted', () => {
		const wrapper = mountShell();

		expect(wrapper.find('[data-test-id="editor"]').exists()).toBe(true);
		expect(wrapper.findComponent(VirtualWizardModeSelector).props('mode')).toBe(DevicesVirtualPluginDeviceMode.sensor_aggregate);
		expect(wrapper.find('[data-test-id="wizard-cancel"]').exists()).toBe(true);
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

	it('holds Cancel, the selector and route leaves while a save is in flight', async () => {
		const wrapper = mountShell(true);

		await wrapper.get('[data-test-id="wizard-cancel"]').trigger('click');

		expect(mocks.push).not.toHaveBeenCalled();
		expect(wrapper.findComponent(VirtualWizardModeSelector).props('disabled')).toBe(true);
		expect(mocks.leaveGuards[0]()).toBe(false);

		await wrapper.setProps({ busy: false });

		expect(mocks.leaveGuards[0]()).toBe(true);
	});
});
