import { ref } from 'vue';

import { ElButton, ElCheckbox, ElFormItem, ElInput, ElInputNumber, ElOption, ElSelect, ElSwitch } from 'element-plus';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type VueWrapper, flushPromises, mount } from '@vue/test-utils';

import { pluginsManagerKey } from '../../../common/services/plugins';
import { channelsPropertiesStoreKey, channelsStoreKey, devicesStoreKey } from '../../../modules/devices/store/keys';
import ThermostatMemberInstallation from '../../devices-shelly-ng/components/thermostat-member-installation.vue';
import { type ThermostatConfiguration, type ThermostatMemberDraft, draftFromConfiguration } from '../services/thermostat-authoring';
import { ThermostatMemberFreshness, type ThermostatMemberRuntime } from '../services/thermostat-members';

import ThermostatMemberCard from './thermostat-member-card.vue';
import ThermostatMemberRecovery from './thermostat-member-recovery.vue';
import ThermostatPropertyPicker from './thermostat-property-picker.vue';
import VirtualCoolingPolicyEditor from './virtual-cooling-policy-editor.vue';
import VirtualThermostatEditor from './virtual-thermostat-editor.vue';
import VirtualWizardSourcePicker from './virtual-wizard-source-picker.vue';

const mocks = vi.hoisted(() => ({
	flashError: vi.fn(),
	fetch: vi.fn(),
	get: vi.fn(),
	put: vi.fn(),
	post: vi.fn(),
	profile: { role: 'owner' },
	catalogue: { devices: [] as Record<string, unknown>[], channels: [] as Record<string, unknown>[], properties: [] as Record<string, unknown>[] },
	on: vi.fn(),
	off: vi.fn(),
}));
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('../../../modules/auth/composables/useSession', () => ({ useSession: () => ({ profile: ref(mocks.profile) }) }));
vi.mock('../../../common', () => ({
	useFlashMessage: () => ({ error: mocks.flashError }),
	useBackend: () => ({ client: { GET: mocks.get, PUT: mocks.put, POST: mocks.post } }),
	getErrorReason: () => 'failure',
	injectSockets: () => ({ on: mocks.on, off: mocks.off }),
	// The spaces store behind the room and zone inputs of a new thermostat.
	injectStoresManager: () => ({
		getStore: (key: symbol) => ({
			fetch: mocks.fetch,
			firstLoadFinished: () => true,
			findAll: () =>
				key === devicesStoreKey
					? mocks.catalogue.devices
					: key === channelsStoreKey
						? mocks.catalogue.channels
						: key === channelsPropertiesStoreKey
							? mocks.catalogue.properties
							: [],
		}),
	}),
}));
const context = (id: string) => {
	const candidates = [
		{
			property: `floor-${id.startsWith('claim-') ? id.slice(6) : id}`,
			physical_property: `physical-${id}`,
			name: `Floor ${id}`,
			fingerprint: id,
			snapshot: { component: 'temperature:100' },
		},
	];
	return {
		physical_identity: `canonical-${id}`,
		configuration_revision: 3,
		claim_revision: 4,
		graph_revision: 8,
		candidates,
		safety_extensions: [
			{
				id: 'shelly-ng.guarded-switch',
				version: 1,
				name: 'Shelly guarded switch',
				roles: ['heating', 'cooling'],
				requires_cooling_protection: false,
				installation_path: '/plugins/devices-shelly-ng/producers/thermostat-installations',
				device_hardware_id: id,
				firmware: 'fixture',
				switch_configuration_json: '{"id":0}',
				reasons: [],
				candidates,
			},
		],
		device_hardware_id: id,
		firmware: 'fixture',
		switch_configuration_json: '{"id":0}',
		reasons: [],
	};
};
const configuration = (count = 2, missing = false) => ({
	controller: 'controller',
	revision: 3,
	graph_revision: 8,
	requested_mode: 'off',
	readiness: 'unavailable',
	reasons: [],
	policy: {
		heatingSetpoint: 21,
		coolingSetpoint: null,
		coldTolerance: 0.5,
		hotTolerance: 0.5,
		neutralMargin: 1,
		minimumOffMs: 0,
		changeoverMs: 0,
		floor: { limit: 28, recoveryHysteresis: 1 },
	},
	heuristic: null,
	contact_opening_ms: 0,
	contact_closing_ms: 0,
	sources: [{ id: 'ambient-binding', role: 'ambient', source_property: 'ambient', source_identity: 'ambient', maximum_age_seconds: 60 }],
	actuators: Array.from({ length: count }, (_, index) => ({
		id: `claim-${index}`,
		role: 'heating',
		source_property: missing && index === 0 ? null : `relay-${index}`,
		source_identity: `relay-${index}`,
		physical_identity: `canonical-${index}`,
		state: missing && index === 0 ? 'missing' : 'reserved',
		revision: 4,
		lease_seconds: 30,
		provider_profile: 'shelly-ng.guarded-switch',
		independent_protection_acknowledged: false,
		qualification_generation: `generation-${index}`,
		protection: {
			schema_version: 1,
			kind: 'local_floor',
			source_property: `floor-${index}`,
			source_identity: `floor-${index}`,
			physical_property: `physical-${index}`,
			maximum_age_seconds: 30,
			revision: 2,
		},
	})),
	settings: [],
	released_actuators: [{ id: 'released-history', release_evidence: { evidenceId: 'historical-proof' } }],
});
const resetCatalogue = () => {
	mocks.catalogue.devices = [
		{ id: 'sensor', name: 'Room temperature sensor', type: 'devices-zigbee2mqtt', roomId: null, zoneIds: [], status: { online: true } },
		...Array.from({ length: 2 }, (_, index) => ({
			id: `relay-device-${index}`,
			name: `Relay ${index}`,
			type: index ? 'devices-modbus' : 'devices-zigbee2mqtt',
			roomId: null,
			zoneIds: [],
			status: { online: true },
		})),
	];
	mocks.catalogue.channels = [
		{ id: 'temperature-channel', device: 'sensor', category: 'temperature', name: 'Room temperature' },
		{ id: 'contact-channel', device: 'sensor', category: 'contact', name: 'Window' },
		...Array.from({ length: 2 }, (_, index) => ({
			id: `relay-channel-${index}`,
			device: `relay-device-${index}`,
			category: 'switcher',
			identifier: 'switch:0',
			name: 'Relay output',
		})),
	];
	mocks.catalogue.properties = [
		{
			id: 'ambient',
			channel: 'temperature-channel',
			category: 'temperature',
			name: 'Temperature',
			dataType: 'float',
			permissions: ['ro'],
			unit: '°C',
			value: { value: 20, lastUpdated: new Date().toISOString() },
		},
		{
			id: 'window',
			channel: 'contact-channel',
			category: 'detected',
			name: 'Contact',
			dataType: 'bool',
			permissions: ['ro'],
			value: { value: false, lastUpdated: new Date().toISOString() },
		},
		{ id: 'not-contact', channel: 'temperature-channel', category: 'active', name: 'Active', dataType: 'bool', permissions: ['ro'] },
		...Array.from({ length: 2 }, (_, index) => ({
			id: `relay-${index}`,
			channel: `relay-channel-${index}`,
			category: 'on',
			identifier: 'output',
			name: 'On',
			dataType: 'bool',
			permissions: ['rw'],
			value: { value: false, lastUpdated: new Date().toISOString() },
		})),
	];
};

let view: VueWrapper | undefined;
let current = configuration();
beforeEach(() => {
	vi.clearAllMocks();
	resetCatalogue();
	mocks.profile.role = 'owner';
	current = configuration();
	mocks.get.mockImplementation((path: string, options: { params: { path: Record<string, string> } }) => {
		if (path.endsWith('/runtime')) return Promise.resolve({ data: { data: { branches: [], configuration_revision: current.revision } } });
		if (path.includes('member-authoring'))
			return Promise.resolve({ data: { data: context(options.params.path.property ?? options.params.path.claim) } });
		if (path.includes('thermostat-installations')) return Promise.resolve({ response: { status: 404 } });
		return Promise.resolve({ data: { data: structuredClone(current) }, response: { status: 200 } });
	});
	mocks.post.mockImplementation((path: string) =>
		Promise.resolve({
			data: { data: path.endsWith('/restore') ? current : path.endsWith('/thermostats') ? { device: { id: 'created-controller' } } : current },
		})
	);
	mocks.put.mockResolvedValue({ data: { data: current } });
});
afterEach(() => {
	view?.unmount();
	view = undefined;
});
const open = async (create = false) => {
	view = mount(VirtualThermostatEditor, {
		props: create ? { create: true } : { deviceId: 'controller' },
		global: {
			provide: {
				[pluginsManagerKey as symbol]: {
					getPlugins: () => [
						{
							elements: [
								{
									type: 'devices-shelly-ng',
									components: { virtualThermostatInstallations: { 'shelly-ng.guarded-switch': ThermostatMemberInstallation } },
								},
							],
						},
					],
				},
			},
			stubs: {
				VirtualThermostatComfort: true,
				ThermostatPropertyPicker: { props: ['modelValue', 'kind'], emits: ['update:modelValue'], template: '<div class="picker" />' },
			},
		},
	});
	await flushPromises();
	return view;
};
const button = (wrapper: VueWrapper, text: string) => wrapper.findAllComponents(ElButton).find((entry) => entry.text() === text)!;
const setNumber = (wrapper: VueWrapper, label: string, value: number) =>
	wrapper
		.findAllComponents(ElFormItem)
		.find((entry) => entry.props('label') === label)!
		.findComponent(ElInputNumber)
		.vm.$emit('update:modelValue', value);

describe('actual mandatory-member authoring forms', () => {
	vi.setConfig({ testTimeout: 30000 });
	it('clears independent protection acknowledgement on rebind and shows only advertised extension choices', async () => {
		const member = ref<ThermostatMemberDraft>({ role: 'heating', source_property: 'relay-0', lease_seconds: null } as ThermostatMemberDraft);
		mocks.get.mockImplementation((_path, options) => {
			const data = context(options.params.path.property);
			data.safety_extensions =
				options.params.path.property === 'relay-0' ? [{ ...data.safety_extensions[0], id: 'other-plugin.auto-off', name: 'Relay timer' }] : [];
			return Promise.resolve({ data: { data } });
		});
		view = mount(ThermostatMemberCard, {
			props: {
				member: member.value,
				selectable: true,
				configurationRevision: 0,
				requestedLimit: null,
				disabled: false,
				runtime: null,
				receivedAt: 0,
				now: 0,
			},
			global: { stubs: { ThermostatPropertyPicker: true } },
		});
		await flushPromises();
		const profile = view.findAllComponents(ElSelect).find((entry) => entry.attributes('data-test-id') === 'member-safety-profile')!;
		expect(profile.findAllComponents(ElOption).map((option) => option.props('value'))).toEqual(['supervised-switch', 'other-plugin.auto-off']);
		const ack = view.findAllComponents(ElCheckbox).find((entry) => entry.attributes('data-test-id') === 'independent-protection')!;
		ack.vm.$emit('update:modelValue', true);
		expect(member.value.independent_protection_acknowledged).toBe(true);
		profile.vm.$emit('change', 'foreign');
		expect(member.value.provider_profile).toBeUndefined();
		profile.vm.$emit('change', 'other-plugin.auto-off');
		await flushPromises();
		expect(member.value.provider_profile).toBe('other-plugin.auto-off');
		expect(view.find('[data-test-id="independent-protection"]').exists()).toBe(false);
		profile.vm.$emit('change', 'supervised-switch');
		await flushPromises();
		view.findAllComponents(ElCheckbox).find((entry) => entry.attributes('data-test-id') === 'independent-protection')!.vm.$emit('update:modelValue', true);
		view.findComponent(ThermostatPropertyPicker).vm.$emit('update:modelValue', 'relay-1');
		await flushPromises();
		expect(member.value.source_property).toBe('relay-1');
		expect(member.value.independent_protection_acknowledged).toBeUndefined();
		expect(view.find('[data-test-id="member-safety-profile"]').exists()).toBe(false);
		expect(view.text()).toContain('devicesVirtualPlugin.members.noFailsafe');
		expect(mocks.put).not.toHaveBeenCalled();
	});
	it('fetches all device visibility scopes even if the default device list already populated the cache', async () => {
		const editor = await open(true);
		editor.findComponent(ElInput).vm.$emit('update:modelValue', 'Thermostat');
		await editor.get('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();
		expect(mocks.fetch).toHaveBeenCalledWith({ hidden: 'all' });
	});
	it('validates only the current step and defers policy fields until after sensor and relay selection', async () => {
		const editor = await open(true);
		const next = async () => {
			await editor.get('[data-test-id="wizard-action-next"]').trigger('click');
			await flushPromises();
		};
		const currentStep = () => editor.findComponent({ name: 'DeviceWizardSteps' }).props('modelValue');
		expect(editor.findComponent({ name: 'DeviceWizardSteps' }).props('steps')).toHaveLength(5);
		expect(editor.findAllComponents(ElInputNumber)).toHaveLength(0);
		await next();
		expect(currentStep()).toBe(0);
		expect(
			editor
				.findAllComponents(ElFormItem)
				.find((field) => field.props('label') === 'devicesModule.fields.devices.name.title')!
				.props('error')
		).toBe('devicesModule.fields.devices.name.validation.required');
		editor.findComponent(ElInput).vm.$emit('update:modelValue', 'Room');
		await next();
		expect(currentStep()).toBe(1);
		expect(editor.find('[data-source-id="ambient"]').exists()).toBe(true);
		expect(editor.find('[data-source-id="window"]').exists()).toBe(true);
		expect(editor.find('[data-source-id="not-contact"]').exists()).toBe(false);
		await next();
		expect(currentStep()).toBe(1);
		await editor.get('[data-source-id="ambient"]').trigger('click');
		await next();
		expect(currentStep()).toBe(2);
		expect(editor.findAllComponents(ElInputNumber)).toHaveLength(0);
		await next();
		expect(currentStep()).toBe(2);
		await editor.get('[data-source-id="relay-0"]').trigger('click');
		await next();
		expect(currentStep()).toBe(3);
		const heating = editor.findAllComponents(ElFormItem).find((field) => field.props('label') === 'devicesVirtualPlugin.thermostat.heatingSetpoint')!;
		expect(heating.props('required')).toBe(true);
		expect(heating.findComponent(ElInputNumber).props('modelValue')).toBe(21);
		expect(editor.findAllComponents(ElFormItem).some((field) => field.props('label') === 'devicesVirtualPlugin.thermostat.coolingSetpoint')).toBe(
			false
		);
		expect(editor.findAllComponents(ThermostatPropertyPicker)).toHaveLength(0);
		expect(editor.findAllComponents(ElCheckbox).some((entry) => entry.text().includes('floorProtect'))).toBe(false);
		expect(editor.findAllComponents(ElFormItem).some((field) => field.props('label') === 'devicesVirtualPlugin.thermostat.floorLimit')).toBe(false);
		expect(editor.text()).not.toContain('devicesVirtualPlugin.members.displayFloor');
		expect(mocks.get.mock.calls.some(([path]) => path.includes('member-authoring'))).toBe(true);
		setNumber(editor, 'devicesVirtualPlugin.thermostat.heatingSetpoint', 21);
		setNumber(editor, 'devicesVirtualPlugin.thermostat.coldTolerance', Number.NaN);
		await next();
		expect(currentStep()).toBe(3);
		expect(mocks.post.mock.calls.some(([path]) => path.endsWith('/draft-preview'))).toBe(false);
		expect(
			editor
				.findAllComponents(ElFormItem)
				.find((field) => field.props('label') === 'devicesVirtualPlugin.thermostat.coldTolerance')!
				.props('error')
		).toContain('coldTolerance');
		setNumber(editor, 'devicesVirtualPlugin.thermostat.coldTolerance', 0.5);
		await next();
		expect(currentStep()).toBe(4);
		expect(mocks.post.mock.calls.filter(([path]) => path.endsWith('/draft-preview'))).toHaveLength(1);
	});
	it('assigns heat/cool in selection, configures boolean contacts later, and repairs the preview after removing a branch', async () => {
		const editor = await open(true);
		const next = async () => {
			await editor.get('[data-test-id="wizard-action-next"]').trigger('click');
			await flushPromises();
		};
		const back = async () => {
			await editor.get('[data-test-id="wizard-action-back"]').trigger('click');
			await flushPromises();
		};
		const role = (id: string) => editor.findAllComponents(ElSelect).find((select) => select.attributes('data-thermostat-role') === id)!;
		const contactField = (key: string) =>
			editor
				.findAllComponents(ElFormItem)
				.find((field) => field.props('label') === `devicesVirtualPlugin.thermostat.wizard.${key}`)!
				.findComponent(ElSelect);
		editor.findComponent(ElInput).vm.$emit('update:modelValue', 'Room');
		await next();
		await editor.get('[data-source-id="ambient"]').trigger('click');
		await editor.get('[data-source-id="window"]').trigger('click');
		expect(role('window').props('disabled')).toBe(true);
		await next();
		await editor.get('[data-source-id="relay-0"]').trigger('click');
		await editor.get('[data-source-id="relay-1"]').trigger('click');
		role('relay-1').vm.$emit('update:modelValue', 'cooling');
		await next();
		setNumber(editor, 'devicesVirtualPlugin.thermostat.heatingSetpoint', 21);
		setNumber(editor, 'devicesVirtualPlugin.thermostat.coolingSetpoint', 25);
		contactField('openValue').vm.$emit('update:modelValue', true);
		contactField('closedValue').vm.$emit('update:modelValue', true);
		await next();
		expect(editor.findComponent({ name: 'DeviceWizardSteps' }).props('modelValue')).toBe(3);
		expect(mocks.post.mock.calls.some(([path]) => path.endsWith('/draft-preview'))).toBe(false);
		contactField('closedValue').vm.$emit('update:modelValue', false);
		await next();
		expect(editor.findComponent({ name: 'DeviceWizardSteps' }).props('modelValue')).toBe(4);
		const first = mocks.post.mock.calls.find(([path]) => path.endsWith('/draft-preview'))![1].body.configuration;
		expect(first.actuators.map((member: { role: string }) => member.role)).toEqual(['heating', 'cooling']);
		expect(first.sources.find((source: { role: string }) => source.role === 'contact')).toMatchObject({ open_value: true, closed_value: false });
		await back();
		await back();
		editor
			.findAllComponents(VirtualWizardSourcePicker)
			.find((picker) => !picker.props('readOnly'))!
			.vm.$emit('remove', 'relay-1');
		await next();
		expect(editor.findAllComponents(ElFormItem).some((field) => field.props('label') === 'devicesVirtualPlugin.thermostat.coolingSetpoint')).toBe(
			false
		);
		expect(
			editor
				.findAllComponents(ElFormItem)
				.find((field) => field.props('label') === 'devicesVirtualPlugin.thermostat.heatingSetpoint')!
				.findComponent(ElInputNumber)
				.props('modelValue')
		).toBe(21);
		await next();
		const previews = mocks.post.mock.calls.filter(([path]) => path.endsWith('/draft-preview'));
		expect(previews).toHaveLength(2);
		expect(previews[1][1].body.configuration.policy).toMatchObject({ heatingSetpoint: 21, coolingSetpoint: null, cooling: null });
		expect(previews[1][1].body.configuration.actuators).toHaveLength(1);
	});
	it('selects cooling inputs in Sensors, auto-binds the qualified surface and sends only real control sources to the API', async () => {
		mocks.catalogue.devices.push({
			id: 'dew-device',
			name: 'Room dew point',
			type: 'virtual',
			mode: 'dew_point',
			roomId: null,
			zoneIds: [],
			status: { online: false },
		});
		mocks.catalogue.channels.push(
			{ id: 'dew-channel', device: 'dew-device', category: 'temperature', name: 'Dew point' },
			{ id: 'surface-channel', device: 'relay-device-1', category: 'temperature', name: 'Surface probe' }
		);
		mocks.catalogue.properties.push(
			{
				id: 'dew-reading',
				channel: 'dew-channel',
				category: 'temperature',
				name: 'Dew point',
				dataType: 'float',
				permissions: ['ro'],
				unit: '°C',
				valueOrigin: 'derived',
				sourceProperty: null,
			},
			{
				id: 'surface-reading',
				channel: 'surface-channel',
				category: 'temperature',
				name: 'Surface temperature',
				dataType: 'float',
				permissions: ['ro'],
				unit: '°C',
			}
		);
		const fallbackGet = mocks.get.getMockImplementation()!;
		mocks.get.mockImplementation((path, options) => {
			if (!path.includes('member-authoring')) return fallbackGet(path, options);
			const value = context(options.params.path.property);
			value.candidates.push({ ...value.candidates[0], property: 'surface-reading', name: 'Surface probe' });
			return Promise.resolve({ data: { data: value } });
		});
		const editor = await open(true);
		const next = async () => {
			await editor.get('[data-test-id="wizard-action-next"]').trigger('click');
			await flushPromises();
		};
		const role = (id: string) => editor.findAllComponents(ElSelect).find((select) => select.attributes('data-thermostat-role') === id)!;
		editor.findComponent(ElInput).vm.$emit('update:modelValue', 'Cool room');
		await next();
		await editor.get('[data-source-id="ambient"]').trigger('click');
		await next();
		await editor.get('[data-source-id="relay-1"]').trigger('click');
		role('relay-1').vm.$emit('update:modelValue', 'cooling');
		await next();
		editor.findComponent(VirtualCoolingPolicyEditor).findComponent(ElSwitch).vm.$emit('change', true);
		await flushPromises();
		expect(editor.find('[data-test-id="cooling-dew-point"]').exists()).toBe(false);
		await next();
		expect(editor.findComponent({ name: 'DeviceWizardSteps' }).props('modelValue')).toBe(1);
		expect(
			editor
				.findAllComponents(ElFormItem)
				.find((field) => field.attributes('data-test-id') === 'thermostat-selection-error')!
				.props('error')
		).toContain('devicesVirtualPlugin.thermostat.errors.coolingDewPointSource');
		expect(mocks.post.mock.calls.some(([path]) => path.endsWith('/draft-preview'))).toBe(false);
		await editor.get('[data-source-id="dew-reading"]').trigger('click');
		await editor.get('[data-source-id="surface-reading"]').trigger('click');
		role('surface-reading').vm.$emit('update:modelValue', 'cooled_surface');
		await next();
		await next();
		const card = editor.findComponent(ThermostatMemberCard);
		expect(card.props('member').cooling_protection).toMatchObject({
			dew_point_property: 'dew-reading',
			surface_property: 'surface-reading',
			maximum_age_seconds: 60,
		});
		expect(
			card
				.getComponent('[data-test-id="cooling-surface-picker"]')
				.findAllComponents(ElOption)
				.map((option) => option.props('label'))
		).toEqual(['Relay 1 · Surface temperature']);
		expect(editor.findAllComponents(ElFormItem).some((field) => field.props('label') === 'devicesVirtualPlugin.thermostat.floorLimit')).toBe(false);
		await next();
		expect(editor.findComponent({ name: 'DeviceWizardSteps' }).props('modelValue')).toBe(4);
		const request = mocks.post.mock.calls.find(([path]) => path.endsWith('/draft-preview'))![1].body.configuration;
		expect(request.sources.map((source: { role: string }) => source.role)).toEqual(['ambient']);
		expect(request.coolingSources).toBeUndefined();
		expect(request.actuators[0].cooling_protection).toMatchObject({
			dew_point_property: 'dew-reading',
			surface_property: 'surface-reading',
			maximum_age_seconds: 60,
		});
		expect(editor.findAllComponents(VirtualWizardSourcePicker)[0].props('selected')).toHaveLength(3);
		await editor.get('[data-test-id="wizard-action-back"]').trigger('click');
		await flushPromises();
		await button(editor.findComponent(VirtualCoolingPolicyEditor), 'devicesVirtualPlugin.thermostat.wizard.selectCoolingSources').trigger('click');
		await flushPromises();
		editor.findComponent(VirtualWizardSourcePicker).vm.$emit('remove', 'surface-reading');
		await next();
		expect(editor.findComponent({ name: 'DeviceWizardSteps' }).props('modelValue')).toBe(1);
		expect(
			editor
				.findAllComponents(ElFormItem)
				.find((field) => field.attributes('data-test-id') === 'thermostat-selection-error')!
				.props('error')
		).toContain('devicesVirtualPlugin.thermostat.errors.coolingSurfaceSource');
	});
	it('repairs retained cooling through the actual editor and invalidates preview approval after a protection edit', async () => {
		const stored = configuration(1);
		current = {
			...stored,
			policy: {
				...stored.policy,
				heatingSetpoint: null,
				coolingSetpoint: 25,
				floor: null,
				cooling: { schemaVersion: 1, marginC: 2, recoveryHysteresisC: 1, absoluteMinimumC: null },
			},
			actuators: stored.actuators.map((claim) => ({
				...claim,
				role: 'cooling',
				protection: null,
				cooling_protection: {
					schema_version: 1,
					revision: 2,
					purpose: 'cooled_surface',
					dew_point_property: null,
					dew_point_identity: 'retained-dew',
					surface_property: 'surface',
					surface_identity: 'surface',
					maximum_age_seconds: 30,
				},
				cooling_diagnostics: { ready: false, reasons: ['cooling_remote_profile_installation_unqualified'] },
			})),
		} as unknown as typeof current;
		const editor = await open();
		const cooling = editor.findComponent(VirtualCoolingPolicyEditor);
		expect(cooling.text()).toContain('retained-dew');
		expect(cooling.text()).toContain('cooling_remote_profile_installation_unqualified');
		const dewPointInput = cooling
			.findAllComponents(ElFormItem)
			.find((field) => field.props('label') === 'devicesVirtualPlugin.dewPoint.title')!
			.findComponent(ElInput);
		dewPointInput.vm.$emit('update:modelValue', 'repaired-dew');
		await flushPromises();
		await button(editor, 'devicesVirtualPlugin.thermostat.actions.preview').trigger('click');
		await flushPromises();
		expect(dewPointInput.props('modelValue')).toBe('repaired-dew');
		expect(mocks.post.mock.calls.find(([path]) => path.endsWith('/preview'))![1].body.actuators[0].cooling_protection.dew_point_property).toBe(
			'repaired-dew'
		);
		expect(button(editor, 'devicesVirtualPlugin.thermostat.actions.save').props('disabled')).toBe(false);
		cooling.findAllComponents(ElInputNumber)[0].vm.$emit('update:modelValue', 3);
		await flushPromises();
		expect(button(editor, 'devicesVirtualPlugin.thermostat.actions.save').props('disabled')).toBe(true);
		await button(editor, 'devicesVirtualPlugin.thermostat.actions.preview').trigger('click');
		await flushPromises();
		await button(editor, 'devicesVirtualPlugin.thermostat.actions.save').trigger('click');
		await flushPromises();
		expect(mocks.put).toHaveBeenCalledTimes(1);
		const request = mocks.put.mock.calls[0][1].body;
		expect(request.policy.cooling).toMatchObject({ marginC: 3, recoveryHysteresisC: 1, absoluteMinimumC: null });
		expect(request.actuators[0].cooling_protection).toEqual({
			schemaVersion: 1,
			purpose: 'cooled_surface',
			dew_point_property: 'repaired-dew',
			surface_property: 'surface',
			maximum_age_seconds: 30,
		});
		expect(request.requested_mode).toBe('off');
		expect(JSON.stringify(request)).not.toContain('qualification');
		expect(mocks.post.mock.calls.some(([path]) => path.includes('/verify'))).toBe(false);
	});
	it('automatically binds only the selected compatible floor sensor to two outputs on the same relay device', async () => {
		mocks.catalogue.devices.find((device) => device.id === 'relay-device-0')!.type = 'devices-shelly-ng';
		mocks.catalogue.channels.find((channel) => channel.id === 'relay-channel-1')!.device = 'relay-device-0';
		mocks.catalogue.channels.find((channel) => channel.id === 'relay-channel-1')!.identifier = 'switch:1';
		mocks.catalogue.channels.push({ id: 'floor-channel', device: 'relay-device-0', category: 'temperature', name: 'Floor probe' });
		mocks.catalogue.properties.push({
			id: 'selected-floor',
			channel: 'floor-channel',
			category: 'temperature',
			name: 'Floor temperature',
			dataType: 'float',
			permissions: ['ro'],
			unit: '°C',
		});
		const fallbackGet = mocks.get.getMockImplementation()!;
		const completeContext: (() => void)[] = [];
		mocks.get.mockImplementation((path, options) => {
			if (!path.includes('member-authoring')) return fallbackGet(path, options);
			const value = context(options.params.path.property);
			value.candidates.push({ ...value.candidates[0], property: 'selected-floor', name: 'Floor probe' });
			return new Promise((resolve) => completeContext.push(() => resolve({ data: { data: value } })));
		});
		const editor = await open(true);
		const next = async () => {
			await editor.get('[data-test-id="wizard-action-next"]').trigger('click');
			await flushPromises();
		};
		editor.findComponent(ElInput).vm.$emit('update:modelValue', 'Room');
		await next();
		await editor.get('[data-source-id="ambient"]').trigger('click');
		await editor.get('[data-source-id="selected-floor"]').trigger('click');
		await next();
		await editor.get('[data-source-id="relay-0"]').trigger('click');
		await editor.get('[data-source-id="relay-1"]').trigger('click');
		await next();
		expect(editor.findComponent({ name: 'DeviceWizardSteps' }).props('canAdvance')).toBe(false);
		expect(mocks.post.mock.calls.some(([path]) => path.endsWith('/draft-preview'))).toBe(false);
		completeContext.forEach((complete) => complete());
		await flushPromises();
		expect(editor.findComponent({ name: 'DeviceWizardSteps' }).props('canAdvance')).toBe(true);
		expect(editor.findAllComponents(ElCheckbox).some((entry) => entry.text().includes('floorProtect'))).toBe(false);
		for (const card of editor.findAllComponents(ThermostatMemberCard)) {
			card.findAllComponents(ElSelect).find((entry) => entry.attributes('data-test-id') === 'member-safety-profile')!.vm.$emit('change', 'shelly-ng.guarded-switch');
			await flushPromises();
			expect(card.findComponent(ThermostatPropertyPicker).exists()).toBe(false);
			expect(card.findComponent(ElCheckbox).exists()).toBe(false);
			expect(card.props('member').protection).toMatchObject({ source_property: 'selected-floor', maximum_age_seconds: 300 });
			const floorSelect = card.findAllComponents(ElSelect).find((select) => select.props('modelValue') === 'selected-floor')!;
			expect(floorSelect).toBeDefined();
			// A backend candidate that was not selected in Sensors cannot be assigned.
			floorSelect.vm.$emit('change', 'floor-relay-0');
			expect(card.props('member').protection!.source_property).toBe('selected-floor');
		}
		await next();
		expect(editor.findComponent({ name: 'DeviceWizardSteps' }).props('modelValue')).toBe(4);
		const preview = mocks.post.mock.calls.find(([path]) => path.endsWith('/draft-preview'))!;
		expect(
			preview[1].body.configuration.actuators.map((member: { protection: { source_property: string } }) => member.protection.source_property)
		).toEqual(['selected-floor', 'selected-floor']);
		const reviewTables = editor.findAllComponents(VirtualWizardSourcePicker);
		expect(reviewTables).toHaveLength(2);
		expect(reviewTables.every((table) => table.props('readOnly'))).toBe(true);
		expect(reviewTables[0].props('selected')).toHaveLength(2);
		expect(reviewTables[1].props('selected')).toHaveLength(2);
		expect(new Set(reviewTables[1].props('selected').map((row) => row.id)).size).toBe(2);
		expect(editor.get('[data-test-id="thermostat-processing-summary"]').text()).toContain('21');
		await button(editor, 'devicesVirtualPlugin.thermostat.actions.create').trigger('click');
		await flushPromises();
		expect(editor.emitted('created')).toEqual([['created-controller']]);
		expect(mocks.post.mock.calls.some(([path]) => path.includes('/verify'))).toBe(false);
	});
	it('never binds an unselected or incompatible local probe and preserves an edited age across selection updates', async () => {
		const member = {
			role: 'heating',
			source_property: 'relay-0',
			lease_seconds: 600,
			provider_profile: 'shelly-ng.guarded-switch',
		} as ThermostatMemberDraft;
		view = mount(ThermostatMemberCard, {
			props: {
				member,
				floorSources: [{ id: 'incompatible-floor', label: 'Remote floor sensor', maximumAgeSeconds: 300 }],
				selectable: false,
				configurationRevision: 0,
				requestedLimit: 28,
				disabled: false,
				receivedAt: 0,
				now: 0,
				runtime: null,
			},
		});
		await flushPromises();
		expect(member.protection).toBeUndefined();
		expect(view.text()).toContain('devicesVirtualPlugin.members.selectedFloorRequired');
		await view.setProps({ floorSources: [{ id: 'floor-relay-0', label: 'Selected floor temperature', maximumAgeSeconds: 300 }] });
		await flushPromises();
		expect(member.protection).toMatchObject({
			source_property: 'floor-relay-0',
			maximum_age_seconds: 300,
		});
		expect(view.findAllComponents(ElOption).map((option) => option.props('label'))).toContain('Selected floor temperature');
		setNumber(view, 'devicesVirtualPlugin.members.maximumAge', 120);
		await view.setProps({ floorSources: [{ id: 'floor-relay-0', label: 'Selected floor temperature', maximumAgeSeconds: 60 }] });
		expect(member.protection!.maximum_age_seconds).toBe(120);
		await view.setProps({ floorSources: [] });
		expect(member.protection).toBeUndefined();
	});
	it('filters cooling surfaces by both the selected sources and their software eligibility', async () => {
		const member = { role: 'cooling', source_property: 'relay-0', lease_seconds: 600 } as ThermostatMemberDraft;
		view = mount(ThermostatMemberCard, {
			props: {
				member,
				floorSources: [],
				coolingSources: [
					{ id: 'dew', label: 'Room dew point', role: 'dew_point' },
					{ id: 'wrong-device', label: 'Other surface', role: 'cooled_surface' },
				],
				selectable: false,
				configurationRevision: 0,
				requestedLimit: null,
				disabled: false,
				receivedAt: 0,
				now: 0,
				runtime: null,
			},
		});
		await flushPromises();
		expect(member.cooling_protection).toMatchObject({ dew_point_property: 'dew', surface_property: null, maximum_age_seconds: 60 });
		expect(
			view
				.findAllComponents(ElSelect)
				.find((select) => select.attributes('data-test-id') === 'cooling-surface-picker')!
				.findAllComponents(ElOption)
		).toHaveLength(0);
		await view.setProps({
			coolingSources: [
				{ id: 'dew', label: 'Room dew point', role: 'dew_point' },
				{ id: 'floor-relay-0', label: 'Selected local surface', role: 'cooled_surface' },
			],
		});
		expect(member.cooling_protection!.surface_property).toBe('floor-relay-0');
		await view.setProps({ coolingSources: [] });
		expect(member.cooling_protection).toMatchObject({ dew_point_property: null, surface_property: null });
		expect(mocks.get.mock.calls.filter(([path]) => path.includes('member-authoring'))).toHaveLength(1);
	});
	it('uses a remote surface for software condensation protection on a relay with an independent hardware guard', async () => {
		const authoring = context('relay-0');
		authoring.safety_extensions[0].candidates = [];
		mocks.get.mockResolvedValueOnce({ data: { data: authoring } });
		const member = { role: 'cooling', source_property: 'relay-0', provider_profile: 'shelly-ng.guarded-switch', lease_seconds: 15 } as ThermostatMemberDraft;
		view = mount(ThermostatMemberCard, { props: {
			member, coolingEnabled: true, coolingSources: [
				{ id: 'dew', label: 'Room dew point', role: 'dew_point' },
				{ id: 'floor-relay-0', label: 'Remote surface', role: 'cooled_surface' },
			], configurationRevision: 0, requestedLimit: null, disabled: false, receivedAt: 0, now: 0, runtime: null,
		} });
		await flushPromises();
		expect(member.cooling_protection?.surface_property).toBe('floor-relay-0');
	});
	it('does not detach an installed local guard when the wizard floor selection is empty', async () => {
		const member = draftFromConfiguration(configuration(1) as unknown as ThermostatConfiguration).actuators[0];
		view = mount(ThermostatMemberCard, {
			props: {
				member,
				floorSources: [],
				configurationRevision: 3,
				requestedLimit: 28,
				disabled: false,
				receivedAt: 0,
				now: 0,
				runtime: null,
			},
			global: { stubs: { ThermostatMemberInstallation: true, ThermostatMemberRecovery: true } },
		});
		await flushPromises();
		expect(member.protection!.source_property).toBe('floor-0');
	});
	it('edits two members while retaining exact claims and exposes released evidence separately', async () => {
		const editor = await open();
		expect(editor.findAllComponents(ThermostatMemberCard)).toHaveLength(2);
		expect(editor.text()).toContain('historical-proof');
		const card = editor.findAllComponents(ThermostatMemberCard)[0];
		expect(card.text()).toContain('claim-0');
		expect(card.text()).toContain('canonical-0');
		expect(card.findAllComponents(ElButton).some((entry) => entry.attributes('aria-label')?.includes('removeDraft'))).toBe(false);
		await button(editor, 'devicesVirtualPlugin.thermostat.actions.preview').trigger('click');
		await flushPromises();
		await button(editor, 'devicesVirtualPlugin.thermostat.actions.save').trigger('click');
		await flushPromises();
		expect(mocks.put.mock.calls[0][1].body.actuators).toHaveLength(2);
		expect(mocks.put.mock.calls[0][1].body).toMatchObject({ expected_revision: 3, expected_graph_revision: 8 });
	});
	it('includes retained missing members in the eight-member cap and uses fenced explicit recovery', async () => {
		current = configuration(8, true);
		const editor = await open();
		expect(editor.findAllComponents(ThermostatMemberCard)).toHaveLength(8);
		expect(button(editor, 'devicesVirtualPlugin.members.addMember · devicesVirtualPlugin.thermostat.roles.heating').props('disabled')).toBe(true);
		const recovery = editor.findComponent(ThermostatMemberRecovery);
		recovery.findComponent(ThermostatPropertyPicker).vm.$emit('update:modelValue', 'restored-property');
		recovery.findComponent(ElInput).vm.$emit('update:modelValue', 'operator checked physical identity');
		recovery.findComponent(ElCheckbox).vm.$emit('update:modelValue', true);
		await flushPromises();
		await button(recovery, 'devicesVirtualPlugin.members.recover').trigger('click');
		await flushPromises();
		expect(mocks.post.mock.calls.find(([path]) => path.endsWith('/restore'))?.[1]).toMatchObject({
			params: { path: { id: 'controller', claimId: 'claim-0' } },
			body: {
				expected_revision: 3,
				expected_claim_revision: 4,
				physical_identity: 'canonical-0',
				source_property: 'restored-property',
				disconnection_acknowledged: true,
			},
		});
	});
	it('preserves edits already present before requesting release', async () => {
		const editor = await open();
		setNumber(editor, 'devicesVirtualPlugin.thermostat.heatingSetpoint', 22);
		await flushPromises();
		mocks.post.mockResolvedValueOnce({ data: { data: structuredClone(current) } });
		await button(editor, 'devicesVirtualPlugin.thermostat.actions.release').trigger('click');
		await flushPromises();
		expect(
			editor
				.findAllComponents(ElFormItem)
				.find((item) => item.props('label') === 'devicesVirtualPlugin.thermostat.heatingSetpoint')!
				.findComponent(ElInputNumber)
				.props('modelValue')
		).toBe(22);
	});
	it.each(['releasing', 'released', 'refused'] as const)('preserves in-flight policy/source edits after %s release response', async (outcome) => {
		const editor = await open();
		await button(editor, 'devicesVirtualPlugin.thermostat.actions.preview').trigger('click');
		await flushPromises();
		let respond!: (value: unknown) => void;
		mocks.post.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					respond = resolve;
				})
		);
		await button(editor, 'devicesVirtualPlugin.thermostat.actions.release').trigger('click');
		setNumber(editor, 'devicesVirtualPlugin.thermostat.heatingSetpoint', 23);
		editor
			.findAllComponents(ThermostatPropertyPicker)
			.find((picker) => picker.props('kind') === 'ambient')!
			.vm.$emit('update:modelValue', 'edited-ambient');
		await flushPromises();
		if (outcome === 'refused') respond({ error: { message: 'release_revision_changed' } });
		else {
			current.revision = 4;
			for (const claim of current.actuators) {
				claim.state = 'releasing';
				claim.revision = 5;
			}
			if (outcome === 'released') current.actuators = [];
			respond({ data: { data: structuredClone(current) } });
		}
		await flushPromises();
		expect(
			editor
				.findAllComponents(ElFormItem)
				.find((item) => item.props('label') === 'devicesVirtualPlugin.thermostat.heatingSetpoint')!
				.findComponent(ElInputNumber)
				.props('modelValue')
		).toBe(23);
		expect(
			editor
				.findAllComponents(ThermostatPropertyPicker)
				.find((picker) => picker.props('kind') === 'ambient')!
				.props('modelValue')
		).toBe('edited-ambient');
		expect(button(editor, 'devicesVirtualPlugin.thermostat.actions.save').props('disabled')).toBe(true);
		const cards = editor.findAllComponents(ThermostatMemberCard);
		expect(cards).toHaveLength(outcome === 'released' ? 0 : 2);
		if (outcome === 'releasing') expect(cards[0].props('member').retained).toMatchObject({ state: 'releasing', revision: 5 });
		if (outcome === 'refused') expect(mocks.flashError).toHaveBeenCalledWith(expect.stringContaining('release_revision_changed'));
	});
	it('stages versioned installation through real controls with derived read-only metadata and exact fences', async () => {
		const editor = await open(),
			installation = editor.findComponent(ThermostatMemberInstallation);
		for (const [key, value] of Object.entries({ endpoint: 'offline.fixture', epoch: 'operator-key' }))
			installation
				.findAllComponents(ElFormItem)
				.find((entry) => entry.props('label') === `devicesShellyNgPlugin.thermostatInstallation.${key}`)!
				.findComponent(ElInput)
				.vm.$emit('update:modelValue', value);
		for (const [key, value] of Object.entries({
			script: 2,
			ceiling: 30,
			minimumLease: 1,
			maximumLease: 30,
			watchdog: 100,
			heatingMinimum: 15,
			heatingMaximum: 25,
		}))
			setNumber(installation, `devicesShellyNgPlugin.thermostatInstallation.${key}`, value);
		await flushPromises();
		await button(installation, 'devicesShellyNgPlugin.thermostatInstallation.stage').trigger('click');
		await flushPromises();
		const staged = mocks.put.mock.calls.find(([path]) => path.includes('thermostat-installations'))!;
		expect(staged[1]).toMatchObject({
			params: { path: { claim: 'claim-0' } },
			body: {
				expected_revision: 0,
				expected_configuration_revision: 3,
				expected_claim_revision: 4,
				expected_qualification_generation: 'generation-0',
				operator_attestations: [],
				member_setup: { format_version: 2, installed_floor_ceiling_c: 30, device_hardware_id: 'claim-0', switch_configuration_json: '{"id":0}' },
			},
		});
		expect(mocks.post.mock.calls.some(([path]) => path.includes('/verify'))).toBe(false);
	});
	it('blocks only the selected incomplete source snapshot and stages after current metadata reload', async () => {
		let complete = false;
		const ordinaryGet = mocks.get.getMockImplementation()!;
		mocks.get.mockImplementation((path: string, options: { params: { path: Record<string, string> } }) => {
			if (path.includes('member-authoring/claims')) {
				const data = context(options.params.path.claim);
				if (!complete) data.candidates[0].snapshot = null as unknown as { component: string };
				return Promise.resolve({ data: { data } });
			}
			return ordinaryGet(path, options);
		});
		const editor = await open(),
			installation = editor.findComponent(ThermostatMemberInstallation);
		for (const [key, value] of Object.entries({ endpoint: 'offline.fixture', epoch: 'operator-key' }))
			installation
				.findAllComponents(ElFormItem)
				.find((item) => item.props('label') === `devicesShellyNgPlugin.thermostatInstallation.${key}`)!
				.findComponent(ElInput)
				.vm.$emit('update:modelValue', value);
		for (const [key, value] of Object.entries({
			script: 2,
			ceiling: 30,
			minimumLease: 1,
			maximumLease: 30,
			watchdog: 100,
			heatingMinimum: 15,
			heatingMaximum: 25,
		}))
			setNumber(installation, `devicesShellyNgPlugin.thermostatInstallation.${key}`, value);
		await flushPromises();
		expect(installation.text()).toContain('selected_protective_source_installation_snapshot_missing');
		expect(button(installation, 'devicesShellyNgPlugin.thermostatInstallation.stage').props('disabled')).toBe(true);
		await button(installation, 'devicesShellyNgPlugin.thermostatInstallation.stage').trigger('click');
		expect(mocks.put).not.toHaveBeenCalled();
		complete = true;
		await button(installation, 'devicesShellyNgPlugin.thermostatInstallation.reload').trigger('click');
		await flushPromises();
		expect(installation.text()).not.toContain('selected_protective_source_installation_snapshot_missing');
		expect(button(installation, 'devicesShellyNgPlugin.thermostatInstallation.stage').props('disabled')).toBe(false);
		await button(installation, 'devicesShellyNgPlugin.thermostatInstallation.stage').trigger('click');
		await flushPromises();
		expect(mocks.put.mock.calls.filter(([path]) => path.includes('thermostat-installations'))).toHaveLength(1);
	});
	it('rejects an unoffered source and preserves the draft after server capability refusal', async () => {
		const editor = await open(),
			card = editor.findComponent(ThermostatMemberCard);
		card.findComponent(ElSelect).vm.$emit('change', 'foreign-floor');
		await flushPromises();
		expect(card.props('member').protection!.source_property).toBe('floor-0');
		mocks.post.mockResolvedValueOnce({ error: { message: 'source_contract_changed' } });
		await button(editor, 'devicesVirtualPlugin.thermostat.actions.preview').trigger('click');
		await flushPromises();
		expect(mocks.flashError).toHaveBeenCalledWith(expect.stringContaining('source_contract_changed'));
		expect(button(editor, 'devicesVirtualPlugin.thermostat.actions.save').props('disabled')).toBe(true);
		expect(editor.findComponent(ThermostatMemberCard).props('member').retained!.id).toBe('claim-0');
	});
	it('retains the reviewed member draft after a server revision conflict', async () => {
		const editor = await open();
		await button(editor, 'devicesVirtualPlugin.thermostat.actions.preview').trigger('click');
		await flushPromises();
		mocks.put.mockResolvedValueOnce({ error: { message: 'configuration_revision_changed' }, response: { status: 409 } });
		await button(editor, 'devicesVirtualPlugin.thermostat.actions.save').trigger('click');
		await flushPromises();
		expect(mocks.flashError).toHaveBeenCalledWith(expect.stringContaining('configuration_revision_changed'));
		expect(editor.findAllComponents(ThermostatMemberCard).map((card) => card.props('member').retained!.id)).toEqual(['claim-0', 'claim-1']);
		expect(mocks.put).toHaveBeenCalledTimes(1);
	});
	it('withdraws a clear-latch assertion when the original protective sample expires', async () => {
		view = mount(ThermostatMemberCard, {
			props: {
				member: draftFromConfiguration(configuration() as unknown as ThermostatConfiguration).actuators[0],
				configurationRevision: 3,
				requestedLimit: 28,
				disabled: true,
				receivedAt: 0,
				now: 0,
				runtime: null,
			},
			global: { stubs: { ThermostatMemberInstallation: true, ThermostatMemberRecovery: true } },
		});
		const card = view;
		await card.setProps({
			runtime: {
				claim: 'claim-0',
				protection: {
					status: 'fresh',
					quality: 'good',
					temperature: 22,
					sampled_at: new Date(0).toISOString(),
					age_seconds: 0,
					maximum_age_seconds: 10,
					expires_at: new Date(10000).toISOString(),
					ready: true,
					latched: false,
					reasons: [],
				},
			} as unknown as ThermostatMemberRuntime,
			receivedAt: 0,
			now: 0,
		});
		expect(card.text()).toMatch(/devicesVirtualPlugin\.members\.latched:\s*false/);
		await card.setProps({ now: 10000 });
		expect(card.text()).toMatch(/devicesVirtualPlugin\.members\.latched:\s*unknown/);
		expect(card.text()).not.toContain('22 °C');
	});
	it('withdraws observed relay activity and guard qualification on original feedback expiry', async () => {
		view = mount(ThermostatMemberCard, {
			props: {
				member: draftFromConfiguration(configuration() as unknown as ThermostatConfiguration).actuators[0],
				configurationRevision: 3,
				requestedLimit: 28,
				disabled: true,
				receivedAt: 0,
				now: 0,
				runtime: {
					claim: 'claim-0',
					activity: 'on',
					pending_on: false,
					qualification_ready: true,
					activity_sampled_at: new Date(0).toISOString(),
					activity_expires_at: new Date(30000).toISOString(),
				} as unknown as ThermostatMemberRuntime,
			},
			global: { stubs: { ThermostatMemberInstallation: true, ThermostatMemberRecovery: true } },
		});
		expect(view.text()).toMatch(/devicesVirtualPlugin\.members\.observed:\s*on/);
		expect(view.text()).toMatch(/devicesVirtualPlugin\.members\.qualification:\s*true/);
		expect(view.text()).toContain('devicesVirtualPlugin.members.qualificationHelp');
		await view.setProps({ now: 30000 });
		expect(view.text()).toMatch(/devicesVirtualPlugin\.members\.observed:\s*unknown/);
		expect(view.text()).toMatch(/devicesVirtualPlugin\.members\.qualification:\s*unknown/);
	});
	it('keeps separate claim sample fences across older reports, expiry, loading and cached refetches', async () => {
		const freshness = new ThermostatMemberFreshness();
		const report = (activityAt: number, protectionAt = activityAt, qualification: boolean | null = false) =>
			({
				claim: 'claim-0',
				activity: 'off',
				qualification_ready: qualification,
				activity_sampled_at: new Date(activityAt).toISOString(),
				activity_expires_at: new Date(activityAt + 30000).toISOString(),
				protection: {
					status: 'fresh',
					quality: 'good',
					temperature: 22,
					sampled_at: new Date(protectionAt).toISOString(),
					expires_at: new Date(protectionAt + 10000).toISOString(),
					age_seconds: 0,
					maximum_age_seconds: 10,
					ready: true,
					latched: false,
					reasons: [],
				},
			}) as unknown as ThermostatMemberRuntime;
		const props = {
			member: draftFromConfiguration(configuration() as unknown as ThermostatConfiguration).actuators[0],
			parallel: true,
			configurationRevision: 3,
			requestedLimit: 28,
			disabled: true,
			freshness,
			receivedAt: 2000,
			now: 2000,
			runtime: report(2000),
		};
		const mountCard = () =>
			mount(ThermostatMemberCard, { props, global: { stubs: { ThermostatMemberInstallation: true, ThermostatMemberRecovery: true } } });
		view = mountCard();
		expect(view.text()).toMatch(/members\.qualification:\s*false/);
		expect(view.text()).toContain('22 °C');
		await view.setProps({ runtime: report(1000), now: 3000, receivedAt: 3000 });
		expect(view.text()).toMatch(/members\.observed:\s*unknown/);
		expect(view.text()).not.toContain('22 °C');
		// A new physical relay report does not renew the independent, older protective sample.
		await view.setProps({ runtime: report(4000, 1000), now: 4000, receivedAt: 4000 });
		expect(view.text()).toMatch(/members\.observed:\s*off/);
		expect(view.text()).not.toContain('22 °C');
		await view.setProps({ runtime: report(4000, 5000), now: 5000, receivedAt: 5000 });
		expect(view.text()).toContain('22 °C');
		await view.setProps({ now: 34000 });
		expect(view.text()).toMatch(/members\.observed:\s*unknown/);
		expect(view.text()).not.toContain('22 °C');
		await view.setProps({ runtime: null });
		view.unmount();
		view = mountCard(); // The editor's cache survives a loading/remount boundary.
		await view.setProps({ runtime: report(4000, 5000), now: 6000, receivedAt: 6000 });
		expect(view.text()).toMatch(/members\.observed:\s*unknown/);
		expect(view.text()).not.toContain('22 °C');
		await view.setProps({ runtime: report(7000, 7000, null), now: 7000, receivedAt: 7000 });
		expect(view.text()).toMatch(/members\.observed:\s*off/);
		expect(view.text()).toMatch(/members\.qualification:\s*unknown/);
		expect(view.text()).toContain('22 °C');
		expect(freshness.size).toBe(1);
	});
	it('keeps the editor cache through real reloads and runtime-only claims until authoritative removal or device change', async () => {
		const get = mocks.get.getMockImplementation()!;
		let released = false;
		const sample = {
			claim: 'claim-0',
			claim_state: 'reserved',
			activity: 'off',
			qualification_ready: false,
			activity_sampled_at: new Date(0).toISOString(),
			activity_expires_at: new Date(30000).toISOString(),
		} as unknown as ThermostatMemberRuntime;
		mocks.get.mockImplementation((path: string, options: { params: { path: Record<string, string> } }) =>
			path.endsWith('/runtime')
				? Promise.resolve({
						data: {
							data: {
								branches: released ? [] : [sample, { ...sample, claim: 'runtime-only', claim_state: 'releasing' }],
								configuration_revision: current.revision,
							},
						},
					})
				: get(path, options)
		);
		const editor = await open();
		const cache = editor.findComponent(ThermostatMemberCard).props('freshness')!;
		cache.observation('runtime-only', sample, 0, 0);
		cache.observation('claim-0', sample, 0, 0);
		cache.expire(30000);
		// Actual configuration reload destroys and recreates the member cards.
		await button(editor, 'devicesVirtualPlugin.thermostat.actions.reload').trigger('click');
		await flushPromises();
		expect(editor.findComponent(ThermostatMemberCard).props('freshness')).toBe(cache);
		expect(cache.size).toBe(2);
		expect(cache.observation('runtime-only', sample, 1000, 1000).activity).toBe('unknown');
		// Only a current authoritative runtime without the old claims confirms their removal.
		released = true;
		current = { ...current, revision: current.revision + 1, actuators: current.actuators.slice(1) };
		await button(editor, 'devicesVirtualPlugin.thermostat.actions.reload').trigger('click');
		await flushPromises();
		expect(cache.size).toBe(0);
		cache.observation('claim-1', sample, 0, 0);
		await editor.setProps({ deviceId: 'another-controller' });
		await flushPromises();
		expect(cache.size).toBe(0);
	});
	it('withholds structural authoring for an ordinary user', async () => {
		mocks.profile.role = 'user';
		const editor = await open(true);
		expect(editor.find('[data-test-id="virtual-thermostat-editor"]').exists()).toBe(false);
		expect(mocks.post).not.toHaveBeenCalled();
	});
});
