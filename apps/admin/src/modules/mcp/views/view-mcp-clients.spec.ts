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
		pagination: ref({ page: 1, size: 10 }),
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
				// Rendered so button labels can be asserted on.
				ElButton: {
					name: 'ElButton',
					props: { type: String, plain: Boolean, disabled: Boolean },
					// `type` is deliberately not bound to the native attribute — doing so
					// collides with the button's own `type` and reads back as "submit".
					template: '<button :disabled="disabled"><slot name="icon" /><slot /></button>',
				},
				ElText: { name: 'ElText', template: '<span><slot /></span>' },
				AppBar: { name: 'AppBar', template: '<div><slot name="heading" /><slot name="button-right" /></div>' },
				AppBarHeading: { name: 'AppBarHeading', template: '<div><slot name="icon" /><slot name="title" /></div>' },
				ElForm: {
					name: 'ElForm',
					template: '<form><slot /></form>',
					methods: {
						clearValidate: () => undefined,
						validate: () => Promise.resolve(true),
					},
				},
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
		const create = wrapper.findAllComponents({ name: 'ElButton' }).find((candidate) => candidate.attributes('data-test-id') === 'create-mcp-client');

		expect(create).toBeDefined();
		expect(create?.props('type')).toBe('primary');
		expect(create?.props('plain')).toBe(true);
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

	it('confirms once for a bulk revoke rather than per selected client', async () => {
		const wrapper = mountView();
		const list = wrapper.findComponent({ name: 'ListMcpClients' });

		list.vm.$emit('bulk-action', 'revoke', [client, { ...client, id: 'second' }]);
		await nextTick();
		await flushPromises();

		expect(ElMessageBox.confirm).toHaveBeenCalledOnce();
		expect(mocks.revokeClient).toHaveBeenCalledTimes(2);
	});

	it('sends the untouched fields back when bulk toggling enabled', async () => {
		const wrapper = mountView();
		const list = wrapper.findComponent({ name: 'ListMcpClients' });

		list.vm.$emit('bulk-action', 'disable', [client]);
		await nextTick();
		await flushPromises();

		// The update endpoint replaces the record — sending only `enabled` would
		// blank the name and capabilities.
		expect(mocks.updateClient).toHaveBeenCalledWith(client.id, {
			name: client.name,
			description: client.description,
			enabled: false,
			capabilities: client.capabilities,
		});
	});

	it('does nothing when a bulk action runs with an empty selection', async () => {
		const wrapper = mountView();
		const list = wrapper.findComponent({ name: 'ListMcpClients' });

		list.vm.$emit('bulk-action', 'delete', []);
		await nextTick();
		await flushPromises();

		expect(ElMessageBox.confirm).not.toHaveBeenCalled();
		expect(mocks.deleteClient).not.toHaveBeenCalled();
	});

	it('labels the header action the way the other list headers do', () => {
		const wrapper = mountView();

		// Other modules label this "Add"; "Create client" was MCP-only phrasing.
		expect(wrapper.find('[data-test-id="create-mcp-client"]').text()).toContain('mcpModule.actions.add');
	});

	it('renders the drawer heading through el-text so it picks up the bar styling', () => {
		const wrapper = mountView();

		// `.app-bar-heading__title > span` is what colours the heading; a bare
		// text node in the title slot never matches it.
		const heading = wrapper.findComponent({ name: 'AppBarHeading' });

		expect(heading.exists()).toBe(true);
		expect(heading.findComponent({ name: 'ElText' }).exists()).toBe(true);
	});

	it('keeps save disabled until the form changes', async () => {
		const wrapper = mountView();
		const vm = wrapper.vm as unknown as { openCreate: () => void; clientFormChanged: boolean; clientForm: { name: string } };

		vm.openCreate();
		await nextTick();

		expect(vm.clientFormChanged).toBe(false);

		vm.clientForm.name = 'Something';
		await nextTick();

		expect(vm.clientFormChanged).toBe(true);
	});

	it('offers close on an untouched form and discard once it changed', async () => {
		const wrapper = mountView();
		const vm = wrapper.vm as unknown as { openCreate: () => void; clientForm: { name: string } };

		vm.openCreate();
		await nextTick();

		expect(wrapper.find('[data-test-id="cancel-mcp-client-form"]').text()).toContain('mcpModule.actions.close');

		vm.clientForm.name = 'Something';
		await nextTick();

		expect(wrapper.find('[data-test-id="cancel-mcp-client-form"]').text()).toContain('mcpModule.actions.discard');
	});

	it('asks to confirm before discarding a changed form', async () => {
		const wrapper = mountView();
		const vm = wrapper.vm as unknown as { openCreate: () => void; clientForm: { name: string }; onCancelClientForm: () => Promise<void> };

		vm.openCreate();
		vm.clientForm.name = 'Something';
		await nextTick();

		await vm.onCancelClientForm();
		await flushPromises();

		expect(ElMessageBox.confirm).toHaveBeenCalledOnce();
	});

	it('closes without confirming when nothing was edited', async () => {
		const wrapper = mountView();
		const vm = wrapper.vm as unknown as { openCreate: () => void; onCancelClientForm: () => Promise<void> };

		vm.openCreate();
		await nextTick();

		await vm.onCancelClientForm();
		await flushPromises();

		expect(ElMessageBox.confirm).not.toHaveBeenCalled();
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
