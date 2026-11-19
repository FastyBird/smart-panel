/* eslint-disable vue/one-component-per-file, vue/require-prop-types */
import { computed, defineComponent, h } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type VueWrapper, mount } from '@vue/test-utils';

import {
	CamerasModuleDataGo2rtcConfigMode,
	CamerasModuleDataRelayStatusReason,
	CamerasModuleDataRelayStatusState,
	UsersModuleUserRole,
} from '../../../openapi.constants';
import type { IRelayStatus } from '../store/relay-status.store.types';

import RelayStatusChip from './relay-status-chip.vue';

const mocks = vi.hoisted(() => ({ role: undefined as unknown as { value: string } }));

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));

vi.mock('../../auth/composables/useSession', () => ({
	useSession: () => ({ profile: computed(() => ({ role: mocks.role.value })) }),
}));

const RouterLinkStub = { props: ['to'], template: '<a data-test-id="settings-link" :data-to="JSON.stringify(to)"><slot /></a>' };
const ElTagStub = defineComponent({
	name: 'ElTag',
	props: ['type'],
	setup:
		(props, { slots }) =>
		() =>
			h('span', { 'data-test-id': 'relay-status-chip', 'data-type': props.type }, slots.default?.()),
});
const ElTooltipStub = defineComponent({
	name: 'ElTooltip',
	props: ['content', 'disabled'],
	setup:
		(props, { slots }) =>
		() =>
			h('div', { 'data-tooltip': props.disabled ? '' : props.content }, slots.default?.()),
});

const status = (state: CamerasModuleDataRelayStatusState, reason: CamerasModuleDataRelayStatusReason | null = null): IRelayStatus => ({
	relay: { mode: CamerasModuleDataGo2rtcConfigMode.managed, state, reason, version: null },
	sessions: { active: 0, max: 8, maxPerCamera: 4 },
});

const mountChip = (value: IRelayStatus | null, stale = false): VueWrapper =>
	mount(RelayStatusChip, {
		props: { status: value, stale },
		global: { stubs: { RouterLink: RouterLinkStub, ElTag: ElTagStub, ElTooltip: ElTooltipStub } },
	});

describe('RelayStatusChip', () => {
	beforeEach(() => {
		mocks.role = { value: UsersModuleUserRole.admin };
	});

	it.each([
		[CamerasModuleDataRelayStatusState.running, 'success', 'camerasModule.relayChip.running'],
		[CamerasModuleDataRelayStatusState.starting, 'warning', 'camerasModule.relayChip.starting'],
		[CamerasModuleDataRelayStatusState.disabled, 'info', 'camerasModule.relayChip.disabled'],
		[CamerasModuleDataRelayStatusState.unavailable, 'danger', 'camerasModule.relayChip.unavailable'],
		[CamerasModuleDataRelayStatusState.error, 'danger', 'camerasModule.relayChip.unavailable'],
	])('renders the %s state as a %s tag', (state, type, text) => {
		const chip = mountChip(status(state)).find('[data-test-id="relay-status-chip"]');

		expect(chip.attributes('data-type')).toBe(type);
		expect(chip.text()).toBe(text);
	});

	it('shows a status that could not be refreshed as unknown instead of its last state', () => {
		const wrapper = mountChip(status(CamerasModuleDataRelayStatusState.running), true);
		const chip = wrapper.find('[data-test-id="relay-status-chip"]');

		expect(chip.attributes('data-type')).toBe('info');
		expect(chip.text()).toBe('camerasModule.relayChip.unknown');
		expect(wrapper.find('[data-tooltip]').attributes('data-tooltip')).toBe('camerasModule.relayStale');
	});

	it('uses the reason sentence for crashed', () => {
		const wrapper = mountChip(status(CamerasModuleDataRelayStatusState.error, CamerasModuleDataRelayStatusReason.crashed));

		expect(wrapper.find('[data-tooltip]').attributes('data-tooltip')).toBe('camerasModule.relayReasons.crashed');
	});

	it('has no tooltip without a reason', () => {
		const wrapper = mountChip(status(CamerasModuleDataRelayStatusState.running));

		expect(wrapper.find('[data-tooltip]').attributes('data-tooltip')).toBe('');
	});

	it('links to the module settings for admins and owners', () => {
		const wrapper = mountChip(status(CamerasModuleDataRelayStatusState.running));

		expect(JSON.parse(wrapper.find('[data-test-id="relay-status-chip-link"]').attributes('data-to') ?? '{}')).toEqual({
			name: 'config_module-config_module_edit',
			params: { module: 'cameras-module' },
		});

		mocks.role.value = UsersModuleUserRole.owner;

		expect(mountChip(status(CamerasModuleDataRelayStatusState.running)).find('[data-test-id="relay-status-chip-link"]').exists()).toBe(true);
	});

	it('shows no link for other users', () => {
		mocks.role.value = UsersModuleUserRole.user;

		const wrapper = mountChip(status(CamerasModuleDataRelayStatusState.running));

		expect(wrapper.find('[data-test-id="relay-status-chip-link"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="relay-status-chip"]').exists()).toBe(true);
	});

	it('renders nothing before the status is known', () => {
		expect(mountChip(null).find('[data-test-id="relay-status-chip"]').exists()).toBe(false);
	});
});
