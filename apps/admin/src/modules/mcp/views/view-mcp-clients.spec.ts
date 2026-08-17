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
	useBreakpoints: () => ({ isLGDevice: ref(true), isMDDevice: ref(true) }),
	useListQuery: () => ({
		filters: ref({ search: undefined, status: 'all', enabled: 'all', capabilities: [] }),
		sort: ref([{ by: 'name', dir: 'asc' }]),
		pagination: ref({ page: 1, size: 25 }),
		viewMode: ref('table'),
		reset: vi.fn(),
	}),
	AppBar: { name: 'AppBar', template: '<div><slot name="heading" /><slot name="button-right" /></div>' },
	AppBarHeading: { name: 'AppBarHeading', template: '<div><slot name="icon" /><slot name="title" /></div>' },
	AppBarButton: { name: 'AppBarButton', template: '<button><slot name="icon" /></button>' },
	AppBarButtonAlign: { LEFT: 'left', RIGHT: 'right' },
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
				// Render the drawer body so its contents can be asserted on.
				ElDrawer: { name: 'ElDrawer', template: '<aside><slot /></aside>' },
				ElScrollbar: { name: 'ElScrollbar', template: '<div><slot /></div>' },
				ElForm: { name: 'ElForm', template: '<form><slot /></form>' },
				ElFormItem: { name: 'ElFormItem', template: '<div><slot /></div>' },
				// shallowMount would otherwise auto-stub this away and drop the
				// header actions rendered into its `extra` slot.
				ViewHeader: { name: 'ViewHeader', template: '<header><slot name="extra" /></header>' },
			},
		},
	});

describe('ViewMcpClients', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(ElMessageBox, 'confirm');
		(ElMessageBox.confirm as Mock).mockResolvedValue('confirm');
	});

	it('renders the shared list component rather than a bespoke table', () => {
		const wrapper = mountView();

		// The separate desktop table and mobile card markup were replaced by the
		// list/table pair every other module uses, which handles both viewports.
		expect(wrapper.findComponent({ name: 'ListMcpClients' }).exists()).toBe(true);
	});

	it('renders the header create action as a plain primary button', () => {
		const wrapper = mountView();

		// Every other list header in the admin uses `type="primary" plain`
		// for its add action; MCP rendered a solid primary, which reads as a
		// different control.
		const create = wrapper.find('[data-test-id="create-mcp-client"]');

		expect(create.exists()).toBe(true);
		expect(create.attributes('type')).toBe('primary');
		expect(create.attributes('plain')).toBeDefined();
	});

	it('hosts the client form in a drawer rather than a dialog', () => {
		const wrapper = mountView();

		// The admin edits records in a drawer (see the devices module); MCP was
		// the only place presenting an add/edit form as a modal dialog.
		expect(wrapper.find('[data-test-id="mcp-client-form-drawer"]').exists()).toBe(true);
	});

	it('presents the capability ceiling hint as an alert', () => {
		const wrapper = mountView();

		const hint = wrapper.find('[data-test-id="mcp-client-capability-ceiling-hint"]');

		expect(hint.exists()).toBe(true);
		// Guidance in this module is carried by el-alert, not loose grey text.
		expect(hint.element.tagName.toLowerCase()).toContain('alert');
	});

	it('requires confirmation before revoking a credential', async () => {
		const wrapper = mountView();
		const list = wrapper.findComponent({ name: 'ListMcpClients' });

		expect(list.exists()).toBe(true);
		list.vm.$emit('revoke', client);
		await nextTick();
		await flushPromises();

		expect(ElMessageBox.confirm).toHaveBeenCalledOnce();
		expect(mocks.revokeClient).toHaveBeenCalledWith(client.id);
	});
});
