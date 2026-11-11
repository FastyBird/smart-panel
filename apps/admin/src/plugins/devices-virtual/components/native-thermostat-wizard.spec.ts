import { createI18n } from 'vue-i18n';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import en from '../locales/en-US.json';
import type { NativeCandidate } from '../services/native-thermostat';

import NativeThermostatWizard from './native-thermostat-wizard.vue';

const mocks = vi.hoisted(() => ({ candidates: vi.fn(), create: vi.fn() }));
vi.mock('../../../common', () => ({ useBackend: () => ({}) }));
vi.mock('../services/native-thermostat', async (original) => ({
	...(await original<object>()),
	nativeThermostatTransport: () => mocks,
}));

const candidate = (device: string, provider: string, reasons: string[] = []): NativeCandidate => ({
	device,
	name: `Thermostat ${device}`,
	provider,
	physical_identity: device,
	fingerprint: 'v1',
	capabilities: { modes: ['off', 'heat'], heating: { minimum: 5, maximum: 30, step: 0.5 }, cooling: null, supportsCompound: false },
	reasons,
});
const mounted = () =>
	mount(NativeThermostatWizard, {
		global: {
			plugins: [
				createI18n({
					legacy: false,
					locale: 'en',
					missingWarn: false,
					fallbackWarn: false,
					messages: { en: { devicesVirtualPlugin: en, devicesModule: { wizard: { actions: { back: 'Back', next: 'Next' } } } } },
				}),
			],
		},
	});

describe('native thermostat wizard', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.candidates.mockResolvedValue([
			candidate('z', 'zigbee2mqtt'),
			candidate('h', 'home-assistant'),
			candidate('taken', 'home-assistant', ['reserved']),
		]);
		mocks.create.mockResolvedValue({ controller: 'controller-1' });
	});

	it('says it is for a real device and groups the supported devices by integration', async () => {
		const wrapper = mounted();
		await flushPromises();
		expect(wrapper.text()).toContain(en.nativeThermostat.wizard.intro);
		expect(wrapper.text()).toContain(en.nativeThermostat.wizard.supported);
		const groups = wrapper.findAllComponents({ name: 'ElOptionGroup' });
		expect(groups.map((group) => group.props('label'))).toEqual(['Home Assistant', 'Zigbee2MQTT']);
		const options = wrapper.findAllComponents({ name: 'ElOption' });
		expect(options.map((option) => [option.props('value'), option.props('disabled')])).toEqual([
			['h', false],
			['taken', true],
			['z', false],
		]);
		expect(options[1]!.props('label')).toContain(en.nativeThermostat.wizard.reasons.reserved);
		wrapper.unmount();
	});

	it('walks device, details and review, suggests the device name and creates the controller', async () => {
		const wrapper = mounted();
		await flushPromises();
		const steps = wrapper.findComponent({ name: 'VirtualWizardSteps' });
		expect(steps.props('canAdvance')).toBe(false);
		const select = wrapper.findComponent({ name: 'ElSelect' });
		select.vm.$emit('update:modelValue', 'h');
		select.vm.$emit('change', 'h');
		await flushPromises();
		expect(steps.props('canAdvance')).toBe(true);
		steps.vm.$emit('update:modelValue', 1);
		await flushPromises();
		expect(wrapper.findComponent({ name: 'ElInput' }).props('modelValue')).toBe('Thermostat h');
		steps.vm.$emit('update:modelValue', 2);
		await flushPromises();
		const summary = wrapper.get('[data-test-id="native-wizard-summary"]').text();
		expect(summary).toContain('Home Assistant');
		expect(summary).toContain('Off, Heat');
		expect(summary).toContain('5–30 °C, step 0.5');
		expect(summary).toContain(en.nativeThermostat.wizard.summary.unsupported);
		await wrapper.get('[data-test-id="native-wizard-create"]').trigger('click');
		await flushPromises();
		expect(mocks.create).toHaveBeenCalledWith('Thermostat h', 'h', expect.anything());
		expect(wrapper.emitted('created')).toEqual([['controller-1']]);
		expect(wrapper.emitted('busy')).toEqual([[true], [false]]);
		wrapper.unmount();
	});

	it('explains an empty list and keeps an uncertain create on screen', async () => {
		mocks.candidates.mockResolvedValueOnce([]);
		const empty = mounted();
		await flushPromises();
		expect(empty.get('[data-test-id="native-wizard-empty"]').text()).toContain(en.nativeThermostat.wizard.noCandidates);
		empty.unmount();

		mocks.create.mockRejectedValue(new Error('native_request_failed'));
		const wrapper = mounted();
		await flushPromises();
		const select = wrapper.findComponent({ name: 'ElSelect' });
		select.vm.$emit('update:modelValue', 'z');
		select.vm.$emit('change', 'z');
		await flushPromises();
		wrapper.findComponent({ name: 'VirtualWizardSteps' }).vm.$emit('update:modelValue', 2);
		await flushPromises();
		await wrapper.get('[data-test-id="native-wizard-create"]').trigger('click');
		await flushPromises();
		expect(wrapper.get('[data-test-id="native-wizard-error"]').text()).toContain(en.nativeThermostat.uncertain);
		expect(wrapper.emitted('created')).toBeUndefined();
		// One read for the empty mount, one for this mount and one after the failed create.
		expect(mocks.candidates).toHaveBeenCalledTimes(3);
		wrapper.unmount();
	});
});
