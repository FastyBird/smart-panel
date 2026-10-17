import { ref } from 'vue';

import { ElButton, ElCheckbox, ElFormItem, ElInput, ElInputNumber, ElSelect } from 'element-plus';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type VueWrapper, flushPromises, mount } from '@vue/test-utils';

import { type ThermostatConfiguration, draftFromConfiguration } from '../services/thermostat-authoring';
import { ThermostatMemberFreshness, type ThermostatMemberRuntime } from '../services/thermostat-members';

import ThermostatMemberCard from './thermostat-member-card.vue';
import ThermostatMemberInstallation from './thermostat-member-installation.vue';
import ThermostatMemberRecovery from './thermostat-member-recovery.vue';
import ThermostatPropertyPicker from './thermostat-property-picker.vue';
import VirtualCoolingPolicyEditor from './virtual-cooling-policy-editor.vue';
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
			property: `floor-${id.startsWith('claim-') ? id.slice(6) : id}`,
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
		await button(editor, 'Preview eligibility and claims').trigger('click');
		await flushPromises();
		expect(dewPointInput.props('modelValue')).toBe('repaired-dew');
		expect(mocks.post.mock.calls.find(([path]) => path.endsWith('/preview'))![1].body.actuators[0].cooling_protection.dew_point_property).toBe(
			'repaired-dew'
		);
		expect(button(editor, 'Save configuration').props('disabled')).toBe(false);
		cooling.findAllComponents(ElInputNumber)[0].vm.$emit('update:modelValue', 3);
		await flushPromises();
		expect(button(editor, 'Save configuration').props('disabled')).toBe(true);
		await button(editor, 'Preview eligibility and claims').trigger('click');
		await flushPromises();
		await button(editor, 'Save configuration').trigger('click');
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
	it('preserves edits already present before requesting release', async () => {
		const editor = await open();
		setNumber(editor, 'Heating setpoint (°C)', 22);
		await flushPromises();
		mocks.post.mockResolvedValueOnce({ data: { data: structuredClone(current) } });
		await button(editor, 'Request OFF and release').trigger('click');
		await flushPromises();
		expect(
			editor
				.findAllComponents(ElFormItem)
				.find((item) => item.props('label') === 'Heating setpoint (°C)')!
				.findComponent(ElInputNumber)
				.props('modelValue')
		).toBe(22);
	});
	it.each(['releasing', 'released', 'refused'] as const)('preserves in-flight policy/source edits after %s release response', async (outcome) => {
		const editor = await open();
		await button(editor, 'Preview eligibility and claims').trigger('click');
		await flushPromises();
		let respond!: (value: unknown) => void;
		mocks.post.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					respond = resolve;
				})
		);
		await button(editor, 'Request OFF and release').trigger('click');
		setNumber(editor, 'Heating setpoint (°C)', 23);
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
				.find((item) => item.props('label') === 'Heating setpoint (°C)')!
				.findComponent(ElInputNumber)
				.props('modelValue')
		).toBe(23);
		expect(
			editor
				.findAllComponents(ThermostatPropertyPicker)
				.find((picker) => picker.props('kind') === 'ambient')!
				.props('modelValue')
		).toBe('edited-ambient');
		expect(button(editor, 'Save configuration').props('disabled')).toBe(true);
		const cards = editor.findAllComponents(ThermostatMemberCard);
		expect(cards).toHaveLength(outcome === 'released' ? 0 : 2);
		if (outcome === 'releasing') expect(cards[0].props('member').retained).toMatchObject({ state: 'releasing', revision: 5 });
		if (outcome === 'refused') expect(editor.text()).toContain('release_revision_changed');
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
				.find((item) => item.props('label') === `devicesVirtualPlugin.members.${key}`)!
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
		expect(installation.text()).toContain('selected_protective_source_installation_snapshot_missing');
		expect(button(installation, 'devicesVirtualPlugin.members.stage').props('disabled')).toBe(true);
		await button(installation, 'devicesVirtualPlugin.members.stage').trigger('click');
		expect(mocks.put).not.toHaveBeenCalled();
		complete = true;
		await button(installation, 'devicesVirtualPlugin.members.reload').trigger('click');
		await flushPromises();
		expect(installation.text()).not.toContain('selected_protective_source_installation_snapshot_missing');
		expect(button(installation, 'devicesVirtualPlugin.members.stage').props('disabled')).toBe(false);
		await button(installation, 'devicesVirtualPlugin.members.stage').trigger('click');
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
				parallel: true,
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
		await button(editor, 'Reload').trigger('click');
		await flushPromises();
		expect(editor.findComponent(ThermostatMemberCard).props('freshness')).toBe(cache);
		expect(cache.size).toBe(2);
		expect(cache.observation('runtime-only', sample, 1000, 1000).activity).toBe('unknown');
		// Only a current authoritative runtime without the old claims confirms their removal.
		released = true;
		current = { ...current, revision: current.revision + 1, actuators: current.actuators.slice(1) };
		await button(editor, 'Reload').trigger('click');
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
