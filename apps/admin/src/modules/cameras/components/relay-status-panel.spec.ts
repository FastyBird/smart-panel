import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import { CamerasModuleDataGo2rtcConfigMode, CamerasModuleDataRelayStatusReason, CamerasModuleDataRelayStatusState } from '../../../openapi.constants';
import type { IRelayStatus } from '../store/relay-status.store.types';

import RelayStatusPanel from './relay-status-panel.vue';

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key) }),
}));

const status = (
	state: CamerasModuleDataRelayStatusState,
	reason: CamerasModuleDataRelayStatusReason | null = null,
	version: string | null = null
): IRelayStatus => ({
	relay: { mode: CamerasModuleDataGo2rtcConfigMode.managed, state, reason, version },
	sessions: { active: 2, max: 8, maxPerCamera: 4 },
});

const mountPanel = (value: IRelayStatus | null, stale = false) => mount(RelayStatusPanel, { props: { status: value, stale } });

describe('RelayStatusPanel', () => {
	it.each(Object.values(CamerasModuleDataRelayStatusReason))('shows the banner text for %s', (reason) => {
		const wrapper = mountPanel(status(CamerasModuleDataRelayStatusState.error, reason));

		expect(wrapper.find('[data-test-id="relay-status-reason"]').text()).toBe(`camerasModule.relayReasons.${reason}`);
	});

	it('shows no banner without a reason', () => {
		expect(mountPanel(status(CamerasModuleDataRelayStatusState.running)).find('[data-test-id="relay-status-reason"]').exists()).toBe(false);
	});

	it('says when the status could not be refreshed and keeps the last known values', () => {
		const wrapper = mountPanel(status(CamerasModuleDataRelayStatusState.running), true);

		expect(wrapper.find('[data-test-id="relay-status-stale"]').text()).toBe('camerasModule.relayStale');
		expect(wrapper.findAll('dd')[1].text()).toBe('camerasModule.config.relayStates.running');
	});

	it('shows no stale line for a current status', () => {
		expect(mountPanel(status(CamerasModuleDataRelayStatusState.running)).find('[data-test-id="relay-status-stale"]').exists()).toBe(false);
	});

	it('shows nothing but the allowed fields', () => {
		const wrapper = mountPanel(status(CamerasModuleDataRelayStatusState.running, null, '1.9.9'));
		const labels = wrapper.findAll('dt').map((node) => node.text());
		const values = wrapper.findAll('dd').map((node) => node.text());

		expect(labels).toEqual([
			'camerasModule.config.relayPanel.mode',
			'camerasModule.config.relayPanel.state',
			'camerasModule.config.relayPanel.version',
			'camerasModule.config.relayPanel.sessions',
			'camerasModule.config.relayPanel.maxPerCamera',
		]);
		expect(values).toEqual([
			'camerasModule.config.modes.managed',
			'camerasModule.config.relayStates.running',
			'1.9.9',
			'camerasModule.config.relayPanel.sessionsValue:{"active":2,"max":8}',
			'4',
		]);
	});

	it('omits the version row when the relay reports none', () => {
		expect(mountPanel(status(CamerasModuleDataRelayStatusState.disabled)).findAll('dt')).toHaveLength(4);
	});

	it('renders nothing without a status', () => {
		expect(mountPanel(null).find('[data-test-id="relay-status-panel"]').exists()).toBe(false);
	});
});
