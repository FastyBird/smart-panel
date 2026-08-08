import { nextTick, ref } from 'vue';

import { ElMessageBox } from 'element-plus';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, shallowMount } from '@vue/test-utils';

import { McpCapability } from '../mcp.constants';
import type { IMcpClient } from '../schemas/client.types';

import ViewMcpClients from './view-mcp-clients.vue';

const mocks = vi.hoisted(() => ({
	fetchClients: vi.fn().mockResolvedValue([]),
	createClient: vi.fn(),
	updateClient: vi.fn(),
	rotateClient: vi.fn(),
	revokeClient: vi.fn().mockResolvedValue(undefined),
	deleteClient: vi.fn(),
	fetchConfigModule: vi.fn().mockResolvedValue(undefined),
	flashSuccess: vi.fn(),
	flashError: vi.fn(),
}));

const client: IMcpClient = {
	id: '10000000-0000-4000-8000-000000000001',
	name: 'Test agent',
	description: null,
	enabled: true,
	capabilities: [McpCapability.read],
	createdById: null,
	tokenId: '20000000-0000-4000-8000-000000000001',
	credentialExpiresAt: '2030-01-01T00:00:00.000Z',
	credentialRevoked: false,
	lastUsedAt: null,
	createdAt: '2026-01-01T00:00:00.000Z',
	updatedAt: null,
};

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../common', () => ({
	ViewHeader: { name: 'ViewHeader', template: '<header><slot name="extra" /></header>' },
	useFlashMessage: () => ({ success: mocks.flashSuccess, error: mocks.flashError }),
}));

vi.mock('../../config/composables/useConfigModule', () => ({
	useConfigModule: () => ({
		configModule: ref({ type: 'mcp-module', enabled: true, capabilities: [McpCapability.read], allowedOrigins: [] }),
		fetchConfigModule: mocks.fetchConfigModule,
	}),
}));

vi.mock('../composables/useMcpClients', () => ({
	useMcpClients: () => ({
		clients: ref([client]),
		loading: ref(false),
		error: ref(null),
		fetchClients: mocks.fetchClients,
		createClient: mocks.createClient,
		updateClient: mocks.updateClient,
		rotateClient: mocks.rotateClient,
		revokeClient: mocks.revokeClient,
		deleteClient: mocks.deleteClient,
	}),
}));

const mountView = () =>
	shallowMount(ViewMcpClients, {
		global: {
			stubs: {
				ElCard: { name: 'ElCard', template: '<section><slot name="header" /><slot /></section>' },
			},
		},
	});

describe('ViewMcpClients', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(ElMessageBox, 'confirm');
		(ElMessageBox.confirm as Mock).mockResolvedValue('confirm');
	});

	it('renders dedicated desktop and mobile client layouts', () => {
		const wrapper = mountView();

		expect(wrapper.find('.mcp-client-table-wrap').exists()).toBe(true);
		expect(wrapper.find('.mcp-client-cards').exists()).toBe(true);
	});

	it('requires confirmation before revoking a credential', async () => {
		const wrapper = mountView();
		const actions = wrapper.findAllComponents({ name: 'McpClientActions' });

		expect(actions.length).toBeGreaterThan(0);
		actions[0]?.vm.$emit('revoke', client);
		await nextTick();
		await flushPromises();

		expect(ElMessageBox.confirm).toHaveBeenCalledOnce();
		expect(mocks.revokeClient).toHaveBeenCalledWith(client.id);
	});
});
