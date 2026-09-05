import { reactive, ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import { ElForm, type FormRules } from 'element-plus';

import { HOMEKIT_FORBIDDEN_PINS } from '../devices-homekit.constants';
import { HomeKitConfigEditFormSchema } from '../schemas/config.schemas';
import type { IHomeKitConfigEditForm } from '../schemas/config.types';
import type { IHomeKitConfig } from '../store/config.store.types';

import HomeKitConfigForm from './homekit-config-form.vue';

const useConfigPluginEditForm = vi.hoisted(() => vi.fn());
const model = reactive({
	type: 'devices-homekit',
	enabled: true,
	bridgeName: 'Smart Panel Bridge',
	port: 51826,
	pincode: '031-45-154',
	pincodeConfigured: true,
	username: 'CC:22:3D:E3:CE:30',
	setupId: 'SP01',
	mappedDeviceIds: [],
});

const mockStatus = ref({
	running: true,
	paired: true,
	pairedClientsCount: 1,
	bridgeName: 'Smart Panel Bridge',
	port: 51826,
	pincode: '031-45-154',
	username: 'CC:22:3D:E3:CE:30',
	setupUri: 'X-HM://0024R932WSP01',
	qrCodeDataUri: 'data:image/svg+xml;utf8,<svg></svg>',
	exposedDevicesCount: 3,
});

vi.mock('vue-i18n', async () => {
	const actual = await vi.importActual('vue-i18n');

	return { ...actual, useI18n: () => ({ t: (key: string) => key }) };
});

const mockConfigPluginsStore = {
	get: vi.fn().mockResolvedValue({
		type: 'devices-homekit',
		enabled: true,
		bridgeName: 'Smart Panel Bridge',
		port: 51826,
		pincode: '031-45-154',
		username: 'CC:22:3D:E3:CE:30',
		setupId: 'SP01',
		mappedDeviceIds: [],
	}),
};

const flashMessageMock = {
	success: vi.fn(),
	error: vi.fn(),
	warning: vi.fn(),
};

vi.mock('../../../common', () => ({
	useFlashMessage: () => flashMessageMock,
	injectStoresManager: () => ({
		getStore: vi.fn().mockReturnValue(mockConfigPluginsStore),
	}),
}));

vi.mock('../../../modules/config', async () => {
	const { ConfigPluginEditFormSchema } = await vi.importActual<typeof import('../../../modules/config/schemas/plugins.schemas')>(
		'../../../modules/config/schemas/plugins.schemas'
	);

	return {
		ConfigPluginEditFormSchema,
		FormResult: { NONE: 'none' },
		Layout: { DEFAULT: 'default' },
		useConfigPluginEditForm,
	};
});

vi.mock('../store/homekit-bridge.store', () => ({
	useHomeKitBridge: () =>
		reactive({
			status: mockStatus,
			fetchingStatus: ref(false),
			resettingPairing: ref(false),
			fetchStatus: vi.fn().mockImplementation(async () => mockStatus.value),
			resetPairing: vi.fn(),
		}),
}));

const mountForm = (options?: { formChanged?: boolean }) => {
	const markSaved = vi.fn();
	const reconcile = vi.fn();
	const submit = vi.fn().mockResolvedValue(true);

	useConfigPluginEditForm.mockReturnValue({
		formEl: ref(),
		model,
		formChanged: ref(options?.formChanged ?? false),
		submit,
		formResult: ref('none'),
		markSaved,
		reconcile,
	});

	const wrapper = mount(HomeKitConfigForm, {
		props: { config: model as unknown as IHomeKitConfig },
		global: {
			stubs: {
				HomeKitSetupWizard: {
					name: 'HomeKitSetupWizard',
					template: '<div />',
				},
				Icon: true,
			},
		},
	});

	return { wrapper, markSaved, reconcile, submit };
};

describe('HomeKitConfigForm', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		Object.assign(model, {
			type: 'devices-homekit',
			enabled: true,
			bridgeName: 'Smart Panel Bridge',
			port: 51826,
			pincode: '031-45-154',
			pincodeConfigured: true,
			username: 'CC:22:3D:E3:CE:30',
			setupId: 'SP01',
			mappedDeviceIds: [],
		});
	});

	it('renders all configuration fields', () => {
		const { wrapper } = mountForm();

		expect(wrapper.find('[name="enabled"]').exists()).toBe(true);
		expect(wrapper.find('[name="bridgeName"]').exists()).toBe(true);
		expect(wrapper.find('[name="port"]').exists()).toBe(true);
		expect(wrapper.find('[name="pincode"]').exists()).toBe(true);
	});

	it('renders bridge runtime status', async () => {
		const { wrapper } = mountForm();
		await flushPromises();

		expect(wrapper.text()).toContain('devicesHomeKitPlugin.status.running');
		expect(wrapper.text()).toContain('devicesHomeKitPlugin.status.pairedWithCount');
		expect(wrapper.text()).toContain('031-45-154');
	});

	it('blocks opening wizard and reset pairing when form is dirty', async () => {
		const { wrapper } = mountForm({ formChanged: true });
		await flushPromises();

		// Click configure devices button
		const buttons = wrapper.findAllComponents({ name: 'ElButton' });
		const configBtn = buttons.find((b) => b.text().includes('devicesHomeKitPlugin.buttons.configureDevices'));
		expect(configBtn).toBeDefined();

		await configBtn?.trigger('click');
		expect(flashMessageMock.warning).toHaveBeenCalledWith('devicesHomeKitPlugin.messages.saveBeforeAction');

		const resetBtn = buttons.find(
			(b) =>
				b.attributes('aria-label') === 'devicesHomeKitPlugin.buttons.resetPairing' || b.text().includes('devicesHomeKitPlugin.buttons.resetPairing')
		);
		expect(resetBtn).toBeDefined();
		await resetBtn?.trigger('click');
		expect(flashMessageMock.warning).toHaveBeenCalledTimes(2);
	});

	it('reconciles fresh config from store when wizard completes', async () => {
		const { wrapper, reconcile, markSaved } = mountForm({ formChanged: false });
		await flushPromises();

		// Find wizard component stub
		const wizard = wrapper.findComponent({ name: 'HomeKitSetupWizard' });
		expect(wizard.exists()).toBe(true);

		await wizard.vm.$emit('completed');
		await flushPromises();

		expect(mockConfigPluginsStore.get).toHaveBeenCalledWith({
			type: 'devices-homekit',
			force: true,
		});
		expect(reconcile).toHaveBeenCalled();
		expect(markSaved).toHaveBeenCalled();
	});

	it('handles refresh failure by entering out-of-sync state and blocking saves/actions', async () => {
		mockConfigPluginsStore.get.mockRejectedValueOnce(new Error('Network error'));

		const { wrapper, submit } = mountForm({ formChanged: false });
		await flushPromises();

		const wizard = wrapper.findComponent({ name: 'HomeKitSetupWizard' });
		await wizard.vm.$emit('completed');
		await flushPromises();

		// Out-of-sync banner should be visible
		expect(wrapper.text()).toContain('devicesHomeKitPlugin.texts.outOfSyncTitle');
		expect(wrapper.text()).toContain('devicesHomeKitPlugin.texts.outOfSyncDescription');

		// Fieldset should be disabled
		const fieldset = wrapper.find('fieldset');
		expect(fieldset.attributes('disabled')).toBeDefined();

		// Action buttons should be disabled
		const buttons = wrapper.findAllComponents({ name: 'ElButton' });
		const configBtn = buttons.find((b) => b.text().includes('devicesHomeKitPlugin.buttons.configureDevices'));
		expect(configBtn?.props('disabled')).toBe(true);

		const resetBtn = buttons.find(
			(b) =>
				b.attributes('aria-label') === 'devicesHomeKitPlugin.buttons.resetPairing' || b.text().includes('devicesHomeKitPlugin.buttons.resetPairing')
		);
		expect(resetBtn?.props('disabled')).toBe(true);

		// Submitting form remotely is blocked
		await wrapper.setProps({ remoteFormSubmit: true });
		await flushPromises();

		expect(submit).not.toHaveBeenCalled();
		expect(flashMessageMock.error).toHaveBeenCalledWith('devicesHomeKitPlugin.messages.outOfSyncBlock');
	});

	it('allows retry refresh to recover from out-of-sync state', async () => {
		mockConfigPluginsStore.get.mockRejectedValueOnce(new Error('Network error'));

		const { wrapper, reconcile, markSaved } = mountForm({ formChanged: false });
		await flushPromises();

		const wizard = wrapper.findComponent({ name: 'HomeKitSetupWizard' });
		await wizard.vm.$emit('completed');
		await flushPromises();

		expect(wrapper.text()).toContain('devicesHomeKitPlugin.texts.outOfSyncTitle');

		// First retry fails
		mockConfigPluginsStore.get.mockRejectedValueOnce(new Error('Still down'));
		const buttons = wrapper.findAllComponents({ name: 'ElButton' });
		const retryBtn = buttons.find((b) => b.text().includes('devicesHomeKitPlugin.buttons.retryRefresh'));
		expect(retryBtn).toBeDefined();

		await retryBtn?.trigger('click');
		await flushPromises();

		expect(flashMessageMock.error).toHaveBeenCalledWith('devicesHomeKitPlugin.messages.refreshFailed');
		expect(wrapper.text()).toContain('devicesHomeKitPlugin.texts.outOfSyncTitle');

		// Second retry succeeds
		mockConfigPluginsStore.get.mockResolvedValueOnce({
			type: 'devices-homekit',
			enabled: true,
			bridgeName: 'Smart Panel Bridge',
			port: 51826,
			pincode: '031-45-154',
			username: 'CC:22:3D:E3:CE:30',
			setupId: 'SP01',
			mappedDeviceIds: [],
		});

		await retryBtn?.trigger('click');
		await flushPromises();

		expect(flashMessageMock.success).toHaveBeenCalledWith('devicesHomeKitPlugin.messages.refreshSuccess');
		expect(wrapper.text()).not.toContain('devicesHomeKitPlugin.texts.outOfSyncTitle');
		expect(reconcile).toHaveBeenCalled();
		expect(markSaved).toHaveBeenCalled();
	});

	it('generates a valid random PIN when clicking the dice button', async () => {
		const { wrapper } = mountForm();
		await flushPromises();

		const pinFormItem = wrapper.findAllComponents({ name: 'ElFormItem' }).find((item) => item.props('prop') === 'pincode');
		expect(pinFormItem).toBeDefined();

		const diceBtn = pinFormItem?.findComponent({ name: 'ElButton' });
		expect(diceBtn?.exists()).toBe(true);

		await diceBtn?.trigger('click');
		expect(model.pincode).toMatch(/^\d{3}-\d{2}-\d{3}$/);
	});

	it('formats PIN code with XXX-XX-XXX mask on input', async () => {
		const { wrapper } = mountForm();
		await flushPromises();

		const pinFormItem = wrapper.findAllComponents({ name: 'ElFormItem' }).find((item) => item.props('prop') === 'pincode');
		const pinInput = pinFormItem?.findComponent({ name: 'ElInput' });
		expect(pinInput?.exists()).toBe(true);

		await pinInput?.vm.$emit('input', '12345678');
		expect(model.pincode).toBe('123-45-678');

		await pinInput?.vm.$emit('input', '987');
		expect(model.pincode).toBe('987');

		await pinInput?.vm.$emit('input', '98765');
		expect(model.pincode).toBe('987-65');
	});

	it('filters non-digit keydown on port and pin inputs', async () => {
		const { wrapper } = mountForm();
		await flushPromises();

		const portFormItem = wrapper.findAllComponents({ name: 'ElFormItem' }).find((item) => item.props('prop') === 'port');
		const pinFormItem = wrapper.findAllComponents({ name: 'ElFormItem' }).find((item) => item.props('prop') === 'pincode');

		const portNativeInput = portFormItem?.find('input');
		const pinNativeInput = pinFormItem?.find('input');

		expect(portNativeInput?.exists()).toBe(true);
		expect(pinNativeInput?.exists()).toBe(true);

		const letterEvent = new KeyboardEvent('keydown', { key: 'a', cancelable: true, bubbles: true });
		portNativeInput?.element.dispatchEvent(letterEvent);
		expect(letterEvent.defaultPrevented).toBe(true);

		const pinLetterEvent = new KeyboardEvent('keydown', { key: 'x', cancelable: true, bubbles: true });
		pinNativeInput?.element.dispatchEvent(pinLetterEvent);
		expect(pinLetterEvent.defaultPrevented).toBe(true);

		const digitEvent = new KeyboardEvent('keydown', { key: '5', cancelable: true, bubbles: true });
		portNativeInput?.element.dispatchEvent(digitEvent);
		expect(digitEvent.defaultPrevented).toBe(false);
	});

	it('renders status buttons in a single row with flex-nowrap and icon-only pairing button', async () => {
		const { wrapper } = mountForm();
		await flushPromises();

		const card = wrapper.findComponent({ name: 'ElCard' });
		expect(card.props('headerClass')).toBe('py-2!');
		expect(card.props('bodyClass')).toBe('py-3!');
		expect(card.props('footerClass')).toBe('py-2! px-4!');

		const footer = card.find('.el-card__footer div');
		expect(footer.classes()).toContain('flex-nowrap');

		const buttons = card.findAllComponents({ name: 'ElButton' });
		const qrBtn = buttons.find((b) => b.attributes('aria-label') === 'devicesHomeKitPlugin.buttons.showPairing');
		expect(qrBtn).toBeDefined();
		expect(qrBtn?.classes()).toContain('px-2!');

		const portInput = wrapper.findComponent({ name: 'ElInputNumber' });
		expect(portInput.classes()).toContain('port-input');
	});

	it('generates a secure PIN when generate button is clicked using crypto.getRandomValues', async () => {
		const { wrapper } = mountForm();
		await flushPromises();

		const pinFormItem = wrapper.findAllComponents({ name: 'ElFormItem' }).find((item) => item.props('prop') === 'pincode');
		const generateBtn = pinFormItem?.findComponent({ name: 'ElButton' });
		expect(generateBtn?.exists()).toBe(true);

		await generateBtn?.trigger('click');
		await flushPromises();

		expect(model.pincode).toMatch(/^\d{3}-\d{2}-\d{3}$/);
	});

	it('rejects values exceeding maxValid and forbidden PINs during rejection sampling', async () => {
		const getRandomValuesSpy = vi.spyOn(crypto, 'getRandomValues');

		// 1st call: out of range (>= 4_200_000_000) -> rejected by inner loop
		// 2nd call: forbidden PIN 11111111 (111-11-111) -> rejected by outer loop
		// 3rd call: valid PIN 12345679 -> accepted (123-45-679)
		getRandomValuesSpy
			.mockImplementationOnce((arr) => {
				(arr as Uint32Array)[0] = 4_250_000_000;
				return arr;
			})
			.mockImplementationOnce((arr) => {
				(arr as Uint32Array)[0] = 11_111_111;
				return arr;
			})
			.mockImplementationOnce((arr) => {
				(arr as Uint32Array)[0] = 12_345_679;
				return arr;
			});

		const { wrapper } = mountForm();
		await flushPromises();

		const pinFormItem = wrapper.findAllComponents({ name: 'ElFormItem' }).find((item) => item.props('prop') === 'pincode');
		const generateBtn = pinFormItem?.findComponent({ name: 'ElButton' });

		await generateBtn?.trigger('click');
		await flushPromises();

		expect(getRandomValuesSpy).toHaveBeenCalledTimes(3);
		expect(model.pincode).toBe('123-45-679');

		getRandomValuesSpy.mockRestore();
	});

	describe('Form validation rules and schema transforms', () => {
		type Validator = (rule: unknown, value: unknown, callback: (error?: Error) => void) => void;

		const getValidator = (wrapper: ReturnType<typeof mountForm>['wrapper'], field: 'bridgeName' | 'pincode'): Validator => {
			const elForm = wrapper.findComponent(ElForm);
			const rules = elForm.props('rules') as FormRules<IHomeKitConfigEditForm>;
			const rule = rules[field];
			const first = Array.isArray(rule) ? rule[0] : rule;

			if (!first || typeof first.validator !== 'function') {
				throw new Error(`${field} rule validator not found`);
			}

			return first.validator as Validator;
		};

		const runValidator = (validator: Validator, value: unknown): Promise<void> =>
			new Promise<void>((resolve, reject) => {
				validator({}, value, (error) => (error ? reject(error instanceof Error ? error : new Error(String(error))) : resolve()));
			});

		it('rejects empty or whitespace-only bridge names in form rule validator', async () => {
			const { wrapper } = mountForm();
			const validator = getValidator(wrapper, 'bridgeName');

			await expect(runValidator(validator, '')).rejects.toThrow('devicesHomeKitPlugin.fields.config.name.validation.required');
			await expect(runValidator(validator, '   ')).rejects.toThrow('devicesHomeKitPlugin.fields.config.name.validation.required');
			await expect(runValidator(validator, undefined)).rejects.toThrow('devicesHomeKitPlugin.fields.config.name.validation.required');
			await expect(runValidator(validator, 'Smart Panel Bridge')).resolves.toBeUndefined();
		});

		it('rejects all forbidden PINs in form rule validator', async () => {
			const { wrapper } = mountForm();
			const validator = getValidator(wrapper, 'pincode');

			for (const forbiddenPin of HOMEKIT_FORBIDDEN_PINS) {
				await expect(runValidator(validator, forbiddenPin)).rejects.toThrow(
					'devicesHomeKitPlugin.fields.config.pinCode.validation.forbidden'
				);
			}
		});

		it('rejects invalid PIN formats in form rule validator', async () => {
			const { wrapper } = mountForm();
			const validator = getValidator(wrapper, 'pincode');

			for (const badPin of ['12345678', 'abc-de-fgh', '123-4567']) {
				await expect(runValidator(validator, badPin)).rejects.toThrow(
					'devicesHomeKitPlugin.fields.config.pinCode.validation.format'
				);
			}
		});

		it('allows blank PIN in form rule validator when PIN is already configured', async () => {
			model.pincodeConfigured = true;
			const { wrapper } = mountForm();
			const validator = getValidator(wrapper, 'pincode');

			await expect(runValidator(validator, '')).resolves.toBeUndefined();
			await expect(runValidator(validator, '   ')).resolves.toBeUndefined();
			await expect(runValidator(validator, undefined)).resolves.toBeUndefined();
		});

		it('rejects blank PIN in form rule validator when PIN is not configured', async () => {
			model.pincodeConfigured = false;
			const { wrapper } = mountForm();
			const validator = getValidator(wrapper, 'pincode');

			await expect(runValidator(validator, '')).rejects.toThrow(
				'devicesHomeKitPlugin.fields.config.pinCode.validation.required'
			);
			await expect(runValidator(validator, '   ')).rejects.toThrow(
				'devicesHomeKitPlugin.fields.config.pinCode.validation.required'
			);
			await expect(runValidator(validator, undefined)).rejects.toThrow(
				'devicesHomeKitPlugin.fields.config.pinCode.validation.required'
			);
		});

		it('transforms blank PIN to undefined in HomeKitConfigEditFormSchema when pincodeConfigured is true', () => {
			const parsed = HomeKitConfigEditFormSchema.parse({
				type: 'devices-homekit',
				enabled: true,
				bridgeName: 'Smart Panel Bridge',
				port: 51826,
				pincode: '',
				pincodeConfigured: true,
				username: 'CC:22:3D:E3:CE:30',
				setupId: 'SP01',
				mappedDeviceIds: [],
			});

			expect(parsed.pincode).toBeUndefined();
		});

		it('rejects blank PIN in HomeKitConfigEditFormSchema when pincodeConfigured is false', () => {
			const result = HomeKitConfigEditFormSchema.safeParse({
				type: 'devices-homekit',
				enabled: true,
				bridgeName: 'Smart Panel Bridge',
				port: 51826,
				pincode: '',
				pincodeConfigured: false,
				username: 'CC:22:3D:E3:CE:30',
				setupId: 'SP01',
				mappedDeviceIds: [],
			});

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues.some((issue) => issue.path.includes('pincode') && issue.message === 'PIN code is required')).toBe(true);
			}
		});
	});
});
