import { ref } from 'vue';

import { ElMessageBox } from 'element-plus';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, shallowMount } from '@vue/test-utils';

import { McpOAuthScope } from '../mcp.constants';
import type { IMcpOAuthGrant } from '../schemas/oauth-management.types';

import ViewMcpOAuthManagement from './view-mcp-oauth-management.vue';

const mocks = vi.hoisted(() => ({
	fetchAll: vi.fn().mockResolvedValue(undefined),
	createClient: vi.fn(),
	updateClient: vi.fn(),
	revokeClient: vi.fn(),
	revokeGrant: vi.fn().mockResolvedValue(undefined),
	revokeAccessToken: vi.fn(),
	revokeRefreshFamily: vi.fn(),
	flashSuccess: vi.fn(),
	flashError: vi.fn(),
}));

const grant: IMcpOAuthGrant = {
	id: '20000000-0000-4000-8000-000000000001',
	clientId: '10000000-0000-4000-8000-000000000001',
	clientName: 'Codex',
	approvedById: null,
	approvedScopes: [McpOAuthScope.READ],
	expiresAt: '2030-01-01T00:00:00.000Z',
	revokedAt: null,
	active: true,
	createdAt: '2026-01-01T00:00:00.000Z',
};

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('../../../common', () => ({
	ViewHeader: { name: 'ViewHeader', template: '<header><slot name="extra" /></header>' },
	useFlashMessage: () => ({ success: mocks.flashSuccess, error: mocks.flashError }),
}));
vi.mock('../composables/useMcpOAuthManagement', () => ({
	useMcpOAuthManagement: () => ({
		clients: ref([]),
		grants: ref([grant]),
		accessTokens: ref([]),
		refreshFamilies: ref([]),
		loading: ref(false),
		error: ref(null),
		fetchAll: mocks.fetchAll,
		createClient: mocks.createClient,
		updateClient: mocks.updateClient,
		revokeClient: mocks.revokeClient,
		revokeGrant: mocks.revokeGrant,
		revokeAccessToken: mocks.revokeAccessToken,
		revokeRefreshFamily: mocks.revokeRefreshFamily,
	}),
}));

describe('ViewMcpOAuthManagement', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(ElMessageBox, 'confirm');
		(ElMessageBox.confirm as Mock).mockResolvedValue('confirm');
	});

	it('requires confirmation before revoking a grant', async () => {
		const wrapper = shallowMount(ViewMcpOAuthManagement);
		const vm = wrapper.vm as unknown as { confirmGrantRevoke: (value: IMcpOAuthGrant) => Promise<void> };

		await vm.confirmGrantRevoke(grant);
		await flushPromises();

		expect(ElMessageBox.confirm).toHaveBeenCalledOnce();
		expect(mocks.revokeGrant).toHaveBeenCalledWith(grant.id);
	});

	it('labels an unusable grant with the backend inactive state', () => {
		const wrapper = shallowMount(ViewMcpOAuthManagement);
		const vm = wrapper.vm as unknown as {
			grantStatus: (value: IMcpOAuthGrant) => { key: string; type: string };
		};

		expect(vm.grantStatus({ ...grant, active: false })).toEqual({ key: 'inactive', type: 'warning' });
	});
});
