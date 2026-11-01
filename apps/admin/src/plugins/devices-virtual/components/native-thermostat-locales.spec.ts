import { ref } from 'vue';
import { createI18n } from 'vue-i18n';

import { describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import cs from '../locales/cs-CZ.json';
import de from '../locales/de-DE.json';
import en from '../locales/en-US.json';
import es from '../locales/es-ES.json';
import pl from '../locales/pl-PL.json';
import sk from '../locales/sk-SK.json';

import NativeThermostatEditor from './NativeThermostatEditor.vue';

vi.mock('../../../common', () => ({ useBackend: () => ({}) }));
vi.mock('../../../modules/auth/composables/useSession', () => ({
	useSession: () => ({ profile: ref({ role: 'admin' }) }),
}));
vi.mock('vue-router', () => ({ onBeforeRouteLeave: vi.fn(), onBeforeRouteUpdate: vi.fn() }));
vi.mock('../services/native-thermostat', async (original) => ({
	...(await original<object>()),
	nativeThermostatTransport: () => ({
		read: () =>
			Promise.resolve({
				controller: 'controller',
				binding_state: 'bound',
				control_strategy: 'native_unit',
				revision: 1,
				provider: 'home-assistant',
				physical_identity: 'fixture',
				fingerprint: 'v1',
				source_device: 'source',
				requested: { mode: 'heat' },
				capabilities: null,
				drift: [],
				observed: { available: false, temperature: null, mode: null, activity: null, observedAt: null, reasons: [] },
				latest_request: { state: 'settled', operations: [{ operation: 'mode', outcome: 'accepted', confirmed: false }] },
			}),
	}),
}));

describe('native thermostat actual localized rendering', () => {
	it.each([
		['cs', cs],
		['de', de],
		['en', en],
		['es', es],
		['pl', pl],
		['sk', sk],
	] as const)('renders %s request, observation and unconfirmed-outcome messages through real i18n', async (locale, messages) => {
		const i18n = createI18n({ legacy: false, locale, messages: { [locale]: { devicesVirtualPlugin: messages } } });
		const page = mount(NativeThermostatEditor, { props: { deviceId: 'controller' }, global: { plugins: [i18n] } });
		try {
			await flushPromises();
			const labels = messages.nativeThermostat;
			expect(page.text()).toContain(labels.title);
			expect(page.text()).toContain(labels.delegation);
			expect(page.get('[data-test-id="native-observed"]').text()).toContain(labels.unavailable);
			expect(page.get('[data-test-id="native-outcome"]').text()).toContain(labels.accepted);
			expect(page.text()).not.toContain('devicesVirtualPlugin.nativeThermostat.');
		} finally {
			page.unmount();
		}
	});
});
