import { computed, ref } from 'vue';

import { ElButton, ElCheckbox, ElInput } from 'element-plus';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import { backendKey } from '../../../common/services/backend';

import ShellyCoverRecoverySection from './shelly-cover-recovery-section.vue';
import ShellyCoverRecovery from './shelly-cover-recovery.vue';

const role = ref('owner');
const client = { GET: vi.fn(), POST: vi.fn() };
const sockets = { on: vi.fn(), off: vi.fn() };
vi.mock('../../../common', async (original) => ({
	...(await original<typeof import('../../../common')>()),
	injectSockets: () => sockets,
	injectStoresManager: () => ({
		getStore: () => ({
			findForDevice: () => [
				{ id: 'cover', device: 'device', category: 'window_covering', identifier: 'cover:0' },
				{ id: 'switch', device: 'device', category: 'switcher', identifier: 'switch:0' },
			],
			findForChannel: (id: string) => [{ id: `${id}-command`, category: 'command' }],
		}),
	}),
}));
vi.mock('vue-i18n', async (original) => ({
	...(await original<typeof import('vue-i18n')>()),
	useI18n: () => ({ t: (key: string, values?: Record<string, unknown>) => `${key}${values ? JSON.stringify(values) : ''}` }),
}));
vi.mock('../../../modules/auth/composables/useSession', () => ({
	useSession: () => ({ profile: computed(() => ({ id: 'operator', role: role.value })) }),
}));
const wrappers: ReturnType<typeof mount>[] = [];
const context = () => ({
	context_id: 'context',
	physical_identity: 'AABBCCDDEE00|cover:0',
	expected_token: 'token',
	expected_revision: 'a'.repeat(64),
	started_at: '2026-10-15T16:00:00.000Z',
	expires_at: new Date(Date.now() + 30_000).toISOString(),
});
const setup = () => {
	const wrapper = mount(ShellyCoverRecovery, {
		props: { deviceId: 'device', channelId: 'channel', propertyId: 'command' },
		global: { provide: { [backendKey as symbol]: client } },
	});
	wrappers.push(wrapper);
	return wrapper;
};
const button = (wrapper: ReturnType<typeof setup>, id: string) =>
	wrapper.findAllComponents(ElButton).find((control) => control.attributes('data-test-id') === id)!;
const load = async (wrapper: ReturnType<typeof setup>) => {
	await button(wrapper, 'recovery-context').trigger('click');
	await flushPromises();
};
const acknowledge = async (wrapper: ReturnType<typeof setup>) => {
	wrapper.findComponent(ElCheckbox).vm.$emit('update:modelValue', true);
	wrapper.findComponent(ElInput).vm.$emit('update:modelValue', ' Operator accepts handback ');
	await flushPromises();
};
beforeEach(() => {
	vi.clearAllMocks();
	role.value = 'owner';
	client.GET.mockResolvedValue({ data: { data: context() } });
	client.POST.mockResolvedValue({
		data: { data: { override_epoch: 'epoch', advisory: 'operator_overridden_unresolved_ordering', observed_state: 'stopped' } },
	});
});
afterEach(() => {
	wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
});
describe('explicit operator cover ordering recovery', () => {
	it('requires current context, literal acknowledgement and reason in the mounted component before an explicit POST', async () => {
		const wrapper = setup();
		expect(client.GET).not.toHaveBeenCalled();
		expect(client.POST).not.toHaveBeenCalled();
		await load(wrapper);
		expect(wrapper.text()).toContain('AABBCCDDEE00|cover:0');
		expect(wrapper.text()).toContain('token');
		expect(button(wrapper, 'recovery-submit').props('disabled')).toBe(true);
		wrapper.findComponent(ElCheckbox).vm.$emit('update:modelValue', true);
		await flushPromises();
		expect(button(wrapper, 'recovery-submit').props('disabled')).toBe(true);
		await acknowledge(wrapper);
		expect(button(wrapper, 'recovery-submit').props('disabled')).toBe(false);
		await button(wrapper, 'recovery-submit').trigger('click');
		await flushPromises();
		expect(client.POST).toHaveBeenCalledWith(
			'/plugins/devices-shelly-ng/devices/{deviceId}/channels/{channelId}/properties/{propertyId}/cover-ordering-recovery',
			{
				params: { path: { deviceId: 'device', channelId: 'channel', propertyId: 'command' } },
				body: {
					data: {
						context_id: 'context',
						expected_token: 'token',
						expected_revision: 'a'.repeat(64),
						acknowledgement: 'accept_uncertain_physical_handback',
						reason: 'Operator accepts handback',
					},
				},
			}
		);
		expect(wrapper.emitted('recovered')).toHaveLength(1);
		expect(wrapper.find('[data-test-id="recovery-advisory"]').exists()).toBe(true);
		expect(wrapper.findComponent(ElCheckbox).exists()).toBe(false);
	});
	it('never offers recovery to ordinary users', () => {
		role.value = 'user';
		const wrapper = setup();
		expect(wrapper.find('[data-test-id="cover-ordering-recovery"]').exists()).toBe(false);
		expect(client.GET).not.toHaveBeenCalled();
		expect(client.POST).not.toHaveBeenCalled();
	});
	it.each(['explicit acknowledgement', 'moving/fault condition', 'stale context', 'audit unavailable', 'administrator required'])(
		'shows server refusal %s and discards local acceptance rather than retrying',
		async (reason) => {
			const wrapper = setup();
			await load(wrapper);
			await acknowledge(wrapper);
			client.POST.mockResolvedValue({ error: { status: 'error', error: { code: 'ConflictError', message: reason } } });
			await button(wrapper, 'recovery-submit').trigger('click');
			await flushPromises();
			expect(wrapper.find('[data-test-id="recovery-error"]').text()).toContain(reason);
			expect(wrapper.emitted('recovered')).toBeUndefined();
			expect(wrapper.findComponent(ElCheckbox).exists()).toBe(false);
			expect(client.POST).toHaveBeenCalledTimes(1);
		}
	);
	it('ignores delayed contexts after remap and requires new acknowledgement after reconnect', async () => {
		let resolve!: (value: unknown) => void;
		client.GET.mockImplementationOnce(
			() =>
				new Promise((done) => {
					resolve = done;
				})
		);
		const wrapper = setup();
		await button(wrapper, 'recovery-context').trigger('click');
		await wrapper.setProps({ channelId: 'remapped' });
		resolve({ data: { data: context() } });
		await flushPromises();
		expect(wrapper.findComponent(ElCheckbox).exists()).toBe(false);
		await load(wrapper);
		await acknowledge(wrapper);
		await wrapper.setProps({ connected: false });
		expect(wrapper.findComponent(ElCheckbox).exists()).toBe(false);
		await wrapper.setProps({ connected: true });
		await load(wrapper);
		expect(button(wrapper, 'recovery-submit').props('disabled')).toBe(true);
		expect(client.POST).not.toHaveBeenCalled();
	});
	it('refuses expired contexts and blanks actor/context data when privileges change', async () => {
		client.GET.mockResolvedValueOnce({ data: { data: { ...context(), expires_at: new Date(Date.now() - 1000).toISOString() } } });
		const wrapper = setup();
		await load(wrapper);
		await acknowledge(wrapper);
		expect(button(wrapper, 'recovery-submit').props('disabled')).toBe(true);
		role.value = 'user';
		await flushPromises();
		expect(wrapper.text()).not.toContain('token');
		expect(client.POST).not.toHaveBeenCalled();
	});
	it('offers the explicit maintenance action from a canonical physical cover detail without guessing other channel categories', async () => {
		const wrapper = mount(ShellyCoverRecoverySection, {
			props: { device: { id: 'device', type: 'devices-shelly-ng' } as never },
			global: { provide: { [backendKey as symbol]: client } },
		});
		const target = wrapper.findComponent(ShellyCoverRecovery);
		expect(target.props()).toMatchObject({ deviceId: 'device', channelId: 'cover', propertyId: 'cover-command', connected: true });
		expect(wrapper.findAllComponents(ShellyCoverRecovery)).toHaveLength(1);
		expect(client.GET).not.toHaveBeenCalled();
		const disconnect = sockets.on.mock.calls.find(([event]) => event === 'disconnect')?.[1] as () => void;
		disconnect();
		await flushPromises();
		expect(target.props('connected')).toBe(false);
		await wrapper.setProps({ device: { id: 'device', type: 'devices-home-assistant' } as never });
		expect(wrapper.findComponent(ShellyCoverRecovery).exists()).toBe(false);
		wrapper.unmount();
		expect(sockets.off).toHaveBeenCalledTimes(2);
	});
});
