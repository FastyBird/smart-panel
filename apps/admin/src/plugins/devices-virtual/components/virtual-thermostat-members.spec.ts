import { ref } from 'vue';

import { ElButton, ElCheckbox, ElFormItem, ElInput, ElInputNumber, ElSelect } from 'element-plus';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type VueWrapper, flushPromises, mount } from '@vue/test-utils';

import { type ThermostatConfiguration, draftFromConfiguration } from '../services/thermostat-authoring';
import type { ThermostatMemberRuntime } from '../services/thermostat-members';

import ThermostatMemberCard from './thermostat-member-card.vue';
import ThermostatMemberInstallation from './thermostat-member-installation.vue';
import ThermostatMemberRecovery from './thermostat-member-recovery.vue';
import ThermostatPropertyPicker from './thermostat-property-picker.vue';
import VirtualThermostatEditor from './virtual-thermostat-editor.vue';

const mocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn(), profile: { role: 'owner' }, on: vi.fn(), off: vi.fn() }));
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('../../../modules/auth/composables/useSession', () => ({ useSession: () => ({ profile: ref(mocks.profile) }) }));
vi.mock('../../../common', () => ({
	useBackend: () => ({ client: { GET: mocks.get, PUT: mocks.put, POST: mocks.post } }),
	getErrorReason: () => 'failure',
	injectSockets: () => ({ on: mocks.on, off: mocks.off }),
}));
const context = (id: string) => ({
	physical_identity: `canonical-${id}`,
	configuration_revision: 3,
	claim_revision: 4,
	graph_revision: 8,
	candidates: [
		{
			property: `floor-${id}`,
			physical_property: `physical-${id}`,
			name: `Floor ${id}`,
			fingerprint: id,
			snapshot: { component: 'temperature:100' },
		},
	],
	device_hardware_id: id,
	firmware: 'fixture',
	switch_configuration_json: '{"id":0}',
	reasons: [],
});
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
let view: VueWrapper | undefined;
let current = configuration();
beforeEach(() => {
	vi.clearAllMocks();
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
	it('previews and creates two distinct local members through the real editor controls', async () => {
		const editor = await open(true);
		editor.findComponent(ElInput).vm.$emit('update:modelValue', 'Room');
		for (const [label, value] of Object.entries({
			'Heating setpoint (°C)': 21,
			'Cold tolerance (°C)': 0.5,
			'Hot tolerance (°C)': 0.5,
			'Neutral heat/cool margin (°C)': 1,
			'Minimum OFF interval (ms)': 0,
			'Changeover interval (ms)': 0,
			'Contact opening debounce (ms)': 0,
			'Contact closing debounce (ms)': 0,
		}))
			setNumber(editor, label, value);
		editor
			.findAllComponents(ElCheckbox)
			.find((entry) => entry.text().includes('Protect heating'))!
			.vm.$emit('change', true);
		await flushPromises();
		setNumber(editor, 'Floor maximum (°C)', 28);
		setNumber(editor, 'Floor recovery hysteresis (°C)', 1);
		await button(editor, 'Add ambient').trigger('click');
		editor
			.findAllComponents(ThermostatPropertyPicker)
			.find((entry) => entry.props('kind') === 'ambient')!
			.vm.$emit('update:modelValue', 'ambient');
		setNumber(editor, 'Maximum original sample age (seconds)', 60);
		for (let index = 0; index < 2; index++) {
			await button(editor, 'devicesVirtualPlugin.members.addMember · heating').trigger('click');
			const card = editor.findAllComponents(ThermostatMemberCard)[index];
			card.findComponent(ThermostatPropertyPicker).vm.$emit('update:modelValue', `relay-${index}`);
			card.findComponent(ElInputNumber).vm.$emit('update:modelValue', 30);
			card.findComponent(ElCheckbox).vm.$emit('change', true);
			await flushPromises();
			card.findComponent(ElSelect).vm.$emit('change', `floor-relay-${index}`);
			setNumber(card, 'devicesVirtualPlugin.members.maximumAge', 30);
		}
		await flushPromises();
		await button(editor, 'Preview eligibility and claims').trigger('click');
		await flushPromises();
		const preview = mocks.post.mock.calls.find(([path]) => path.endsWith('/draft-preview'))!;
		expect(
			preview[1].body.configuration.actuators.map((member: { protection: { source_property: string } }) => member.protection.source_property)
		).toEqual(['floor-relay-0', 'floor-relay-1']);
		await button(editor, 'Create thermostat').trigger('click');
		await flushPromises();
		expect(editor.emitted('created')).toEqual([['created-controller']]);
		expect(mocks.post.mock.calls.some(([path]) => path.includes('/verify'))).toBe(false);
	});
	it('edits two members while retaining exact claims and exposes released evidence separately', async () => {
		const editor = await open();
		expect(editor.findAllComponents(ThermostatMemberCard)).toHaveLength(2);
		expect(editor.text()).toContain('historical-proof');
		const card = editor.findAllComponents(ThermostatMemberCard)[0];
		expect(card.text()).toContain('claim-0');
		expect(card.text()).toContain('canonical-0');
		expect(card.findAllComponents(ElButton).some((entry) => entry.text().includes('removeDraft'))).toBe(false);
		await button(editor, 'Preview eligibility and claims').trigger('click');
		await flushPromises();
		await button(editor, 'Save configuration').trigger('click');
		await flushPromises();
		expect(mocks.put.mock.calls[0][1].body.actuators).toHaveLength(2);
		expect(mocks.put.mock.calls[0][1].body).toMatchObject({ expected_revision: 3, expected_graph_revision: 8 });
	});
	it('includes retained missing members in the eight-member cap and uses fenced explicit recovery', async () => {
		current = configuration(8, true);
		const editor = await open();
		expect(editor.findAllComponents(ThermostatMemberCard)).toHaveLength(8);
		expect(button(editor, 'devicesVirtualPlugin.members.addMember · heating').props('disabled')).toBe(true);
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
	it('stages versioned installation through real controls with derived read-only metadata and exact fences', async () => {
		const editor = await open(),
			installation = editor.findComponent(ThermostatMemberInstallation);
		for (const [key, value] of Object.entries({ endpoint: 'offline.fixture', epoch: 'operator-key' }))
			installation
				.findAllComponents(ElFormItem)
				.find((entry) => entry.props('label') === `devicesVirtualPlugin.members.${key}`)!
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
			setNumber(installation, `devicesVirtualPlugin.members.${key}`, value);
		await flushPromises();
		await button(installation, 'devicesVirtualPlugin.members.stage').trigger('click');
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
	it('rejects an unoffered source and preserves the draft after server capability refusal', async () => {
		const editor = await open(),
			card = editor.findComponent(ThermostatMemberCard);
		card.findComponent(ElSelect).vm.$emit('change', 'foreign-floor');
		await flushPromises();
		expect(card.props('member').protection!.source_property).toBe('floor-0');
		mocks.post.mockResolvedValueOnce({ error: { message: 'source_contract_changed' } });
		await button(editor, 'Preview eligibility and claims').trigger('click');
		await flushPromises();
		expect(editor.text()).toContain('source_contract_changed');
		expect(button(editor, 'Save configuration').props('disabled')).toBe(true);
		expect(editor.findComponent(ThermostatMemberCard).props('member').retained!.id).toBe('claim-0');
	});
	it('retains the reviewed member draft after a server revision conflict', async () => {
		const editor = await open();
		await button(editor, 'Preview eligibility and claims').trigger('click');
		await flushPromises();
		mocks.put.mockResolvedValueOnce({ error: { message: 'configuration_revision_changed' }, response: { status: 409 } });
		await button(editor, 'Save configuration').trigger('click');
		await flushPromises();
		expect(editor.text()).toContain('configuration_revision_changed');
		expect(editor.findAllComponents(ThermostatMemberCard).map((card) => card.props('member').retained!.id)).toEqual(['claim-0', 'claim-1']);
		expect(mocks.put).toHaveBeenCalledTimes(1);
	});
	it('withdraws a clear-latch assertion when the original protective sample expires', async () => {
		view = mount(ThermostatMemberCard, {
			props: {
				member: draftFromConfiguration(configuration() as unknown as ThermostatConfiguration).actuators[0],
				parallel: true,
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
	it('withholds structural authoring for an ordinary user', async () => {
		mocks.profile.role = 'user';
		const editor = await open(true);
		expect(editor.find('[data-test-id="virtual-thermostat-editor"]').exists()).toBe(false);
		expect(mocks.post).not.toHaveBeenCalled();
	});
});
