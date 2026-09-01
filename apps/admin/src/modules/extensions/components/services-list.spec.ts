import { ElAlert, ElTabPane, ElTabs } from 'element-plus';
import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import {
	ExtensionsModuleServiceActivationPolicy,
	ExtensionsModuleServiceDesiredState,
	ExtensionsModuleServiceOwnerKind,
	ExtensionsModuleServiceState,
} from '../../../openapi.constants';
import type { IService } from '../store/services.store.types';

import ServicesList from './services-list.vue';

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

const services: IService[] = [
	{
		extensionKind: ExtensionsModuleServiceOwnerKind.module,
		extensionType: 'mdns-module',
		serviceId: 'advertisement',
		activationPolicy: ExtensionsModuleServiceActivationPolicy.owner_enabled,
		state: ExtensionsModuleServiceState.started,
		desiredState: ExtensionsModuleServiceDesiredState.started,
		enabled: true,
		startCount: 1,
	},
	{
		extensionKind: ExtensionsModuleServiceOwnerKind.plugin,
		extensionType: 'devices-home-assistant-plugin',
		serviceId: 'discovery',
		activationPolicy: ExtensionsModuleServiceActivationPolicy.always,
		state: ExtensionsModuleServiceState.started,
		desiredState: ExtensionsModuleServiceDesiredState.started,
		enabled: false,
		startCount: 1,
	},
];

describe('ServicesList', () => {
	it('renders module and plugin service tabs', () => {
		const wrapper = mount(ServicesList, {
			props: {
				activeKind: ExtensionsModuleServiceOwnerKind.module,
				services,
				isActing: vi.fn().mockReturnValue(false),
			},
			global: {
				stubs: {
					Icon: true,
					ServiceItem: true,
				},
			},
		});

		expect(wrapper.findComponent(ElTabs).exists()).toBe(true);
		expect(wrapper.findComponent(ElAlert).classes()).toContain('shrink-0');
		expect(wrapper.findAllComponents(ElTabPane).map((pane) => pane.props('name'))).toEqual([
			ExtensionsModuleServiceOwnerKind.module,
			ExtensionsModuleServiceOwnerKind.plugin,
		]);
	});

	it('emits the selected owner kind', () => {
		const wrapper = mount(ServicesList, {
			props: {
				activeKind: ExtensionsModuleServiceOwnerKind.module,
				services,
				isActing: vi.fn().mockReturnValue(false),
			},
			global: {
				stubs: {
					Icon: true,
					ServiceItem: true,
				},
			},
		});

		wrapper.findComponent(ElTabs).vm.$emit('update:modelValue', ExtensionsModuleServiceOwnerKind.plugin);

		expect(wrapper.emitted('update:activeKind')).toEqual([[ExtensionsModuleServiceOwnerKind.plugin]]);
	});
});
