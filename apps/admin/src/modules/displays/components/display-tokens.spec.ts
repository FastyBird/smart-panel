import { ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import type { IDisplay, IDisplayToken } from '../store/displays.store.types';

import DisplayTokens from './display-tokens.vue';

const confirm = vi.fn();
const tokens = ref<IDisplayToken[]>([]);
const fetchTokens = vi.fn().mockResolvedValue(undefined);
const revokeToken = vi.fn();
const success = vi.fn();

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key, locale: ref('en-US') }),
}));

vi.mock('element-plus', () => ({
	ElButton: { name: 'ElButton', template: '<button v-bind="$attrs"><slot /></button>' },
	ElCard: { name: 'ElCard', template: '<div><slot /></div>' },
	ElMessageBox: { confirm: (...args: unknown[]) => confirm(...args) },
}));

vi.mock('@iconify/vue', () => ({
	Icon: { name: 'Icon', template: '<i />' },
}));

vi.mock('../../../common', () => ({
	CopyField: { name: 'CopyField', props: ['value', 'label'], template: '<div />' },
	KvGrid: { name: 'KvGrid', props: ['items'], template: '<div />' },
	StateView: { name: 'StateView', props: ['title'], template: '<div />' },
	StatusTag: { name: 'StatusTag', props: ['status', 'label'], template: '<span />' },
	useFlashMessage: () => ({ success, error: vi.fn() }),
}));

vi.mock('../composables/composables', () => ({
	useDisplay: () => ({ tokens, fetchTokens, revokeToken }),
}));

const token = (overrides: Partial<IDisplayToken> = {}): IDisplayToken =>
	({
		id: 'token-1',
		owner_type: 'display',
		owner_id: 'd1',
		name: 'Display token',
		description: null,
		expires_at: null,
		revoked: false,
		created_at: '2026-10-01T10:00:00Z',
		updated_at: null,
		...overrides,
	}) as IDisplayToken;

const mountTokens = async () => {
	const wrapper = mount(DisplayTokens, { props: { display: { id: 'd1' } as IDisplay } });

	await flushPromises();

	return wrapper;
};

describe('DisplayTokens', () => {
	beforeEach(() => {
		tokens.value = [token()];
		confirm.mockReset();
		revokeToken.mockReset();
		success.mockReset();
	});

	it('lists each token with its ID to copy, its state and Never for no expiry', async () => {
		const wrapper = await mountTokens();

		expect(fetchTokens).toHaveBeenCalled();
		expect(wrapper.findComponent({ name: 'CopyField' }).props('value')).toBe('token-1');
		expect(wrapper.findComponent({ name: 'StatusTag' }).props('status')).toBe('ok');
		expect((wrapper.findComponent({ name: 'KvGrid' }).props('items') as { value: string }[])[1]?.value).toBe('displaysModule.detail.tokens.never');
	});

	it('revokes only after the confirmation names the action', async () => {
		const wrapper = await mountTokens();

		confirm.mockRejectedValue('cancel');
		await wrapper.find('[data-test-id="revoke-display-tokens"]').trigger('click');
		await flushPromises();

		expect(revokeToken).not.toHaveBeenCalled();

		confirm.mockResolvedValue(true);
		revokeToken.mockResolvedValue(true);
		await wrapper.find('[data-test-id="revoke-display-tokens"]').trigger('click');
		await flushPromises();

		expect(confirm.mock.calls[1]?.[2]).toMatchObject({ confirmButtonText: 'displaysModule.actions.revokeToken' });
		expect(revokeToken).toHaveBeenCalledTimes(1);
		expect(success).toHaveBeenCalledWith('displaysModule.detail.tokens.revoked');
	});

	it('shows the empty state and no Revoke without tokens', async () => {
		tokens.value = [];

		const wrapper = await mountTokens();

		expect(wrapper.find('[data-test-id="revoke-display-tokens"]').exists()).toBe(false);
		expect(wrapper.findComponent({ name: 'StateView' }).props('title')).toBe('displaysModule.detail.tokens.noTokens');
	});
});
