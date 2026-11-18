import { computed, ref } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import type { IUseModbusDeviceWizard } from '../../composables/useModbusDeviceWizard';

import ModbusWizardTemplateStep from './modbus-wizard-template-step.vue';

const apply = vi.fn(),
	startEmpty = vi.fn();
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('../../../../common', () => ({
	useFlashMessage: () => ({ error: vi.fn() }),
	injectStoresManager: () => ({
		getStore: () => ({
			catalog: {
				templates: [
					{ id: 'board', name: 'Specific board', manufacturer: 'Vendor', model: 'Board', source: 'builtin', channelCount: 1, pointCount: 8 },
				],
				files: [],
			},
		}),
	}),
}));
const render = () =>
	mount(ModbusWizardTemplateStep, {
		props: {
			wizard: {
				state: { template: null, startedEmpty: false },
				applyingTemplate: ref(false),
				endpointMismatch: computed(() => null),
				applyTemplate: apply,
				startEmpty,
			} as unknown as IUseModbusDeviceWizard,
		},
	});

describe('optional Modbus template catalog', () => {
	it('offers custom configuration immediately and opens the hardware catalog only on request', async () => {
		const wrapper = render();
		expect(wrapper.find('[data-test-id="template-start-empty"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="template-board"]').exists()).toBe(false);
		await wrapper.get('[data-test-id="template-browse"]').trigger('click');
		expect(wrapper.find('[data-test-id="template-board"]').exists()).toBe(true);
		await wrapper.get('[data-test-id="template-board"]').trigger('click');
		expect(apply).toHaveBeenCalledWith('board');
		wrapper.unmount();
	});
});
