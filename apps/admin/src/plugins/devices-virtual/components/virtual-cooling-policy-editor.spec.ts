import { reactive } from 'vue';

import { ElSwitch } from 'element-plus';
import { describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import { DevicesVirtualPluginThermostatActuatorRole } from '../../../openapi';
import cs from '../locales/cs-CZ.json';
import de from '../locales/de-DE.json';
import en from '../locales/en-US.json';
import es from '../locales/es-ES.json';
import pl from '../locales/pl-PL.json';
import sk from '../locales/sk-SK.json';
import { emptyThermostatDraft } from '../services/thermostat-authoring';

import VirtualCoolingPolicyEditor from './virtual-cooling-policy-editor.vue';

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
describe('separate cooling protection authoring', () => {
	it('requires explicit thresholds and creates per-member dependencies on role changes without creating qualification', async () => {
		const draft = reactive(emptyThermostatDraft());
		draft.actuators.push({ role: DevicesVirtualPluginThermostatActuatorRole.heating, source_property: 'relay', lease_seconds: 5 });
		const wrapper = mount(VirtualCoolingPolicyEditor, { props: { draft, disabled: false } });
		wrapper.findComponent(ElSwitch).vm.$emit('change', true);
		await flushPromises();
		expect(draft.policy.cooling).toMatchObject({ marginC: null, recoveryHysteresisC: null, absoluteMinimumC: null });
		expect(draft.actuators[0].cooling_protection).toBeUndefined();
		draft.actuators[0].role = DevicesVirtualPluginThermostatActuatorRole.cooling;
		await flushPromises();
		expect(draft.actuators[0].cooling_protection).toEqual({
			schemaVersion: 1,
			purpose: 'cooled_surface',
			dew_point_property: null,
			surface_property: null,
			maximum_age_seconds: 60,
		});
		expect(wrapper.text()).toContain('devicesVirtualPlugin.dewPoint.installation');
		expect(wrapper.findAllComponents(ElSwitch)).toHaveLength(1);
		wrapper.unmount();
	});
	it('retains missing source identities and keeps the installed-protection policy from being silently detached', async () => {
		const draft = reactive(emptyThermostatDraft());
		draft.policy.cooling = { schemaVersion: 1, marginC: 2, recoveryHysteresisC: 1 };
		draft.actuators.push({
			role: DevicesVirtualPluginThermostatActuatorRole.cooling,
			source_property: 'relay',
			lease_seconds: 5,
			retained: {
				id: 'claim',
				cooling_protection: { dew_point_identity: 'old-dew', surface_identity: 'old-surface', dew_point_property: null, surface_property: null },
				cooling_diagnostics: { reasons: ['cooling_remote_profile_installation_unqualified', 'cooling_pending_release'] },
			} as never,
		});
		const wrapper = mount(VirtualCoolingPolicyEditor, { props: { draft, disabled: false } });
		await flushPromises();
		expect(wrapper.text()).toContain('old-dew');
		expect(wrapper.text()).toContain('old-surface');
		expect(wrapper.text()).toContain('cooling_pending_release');
		expect(wrapper.findComponent(ElSwitch).props('disabled')).toBe(true);
		wrapper.findComponent(ElSwitch).vm.$emit('change', false);
		expect(draft.policy.cooling).not.toBeNull();
		wrapper.unmount();
	});
});

describe('dew point and cooling locale coverage', () => {
	it.each(Object.entries({ en, cs, de, es, pl, sk }))('provides every new authoring/repair explanation in %s', (_language, locale) => {
		expect(Object.keys(locale.dewPoint).sort()).toEqual(Object.keys(en.dewPoint).sort());
		expect(Object.keys(locale.dewPoint.errors).sort()).toEqual(Object.keys(en.dewPoint.errors).sort());
		for (const value of Object.values(locale.dewPoint).flatMap((value) => (typeof value === 'string' ? [value] : Object.values(value))))
			expect(value.trim().length).toBeGreaterThan(0);
	});
});
