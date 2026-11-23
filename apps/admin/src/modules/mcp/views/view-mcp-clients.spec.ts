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
	ViewHeader: { name: 'ViewHeader', props: ['title', 'subtitle', 'icon', 'actions'], template: '<header><slot name="actions" /></header>' },
	CopyField: { name: 'CopyField', props: ['value', 'label'], template: '<div />' },
	// Renders the list and the form side by side, so both can be asserted on
	EditDrawerLayout: {
		name: 'EditDrawerLayout',
		props: { open: Boolean, beforeClose: Function, routeless: Boolean },
		template: '<div><slot /><aside><slot name="form" /></aside></div>',
	},
	FormFooter: { name: 'FormFooter', props: ['dirty', 'saving', 'canSave', 'saveLabel'], template: '<footer />' },
	provideEditDrawer: () => ({}),
	useFlashMessage: () => ({ success: mocks.flashSuccess, error: mocks.flashError }),
	useListQuery: () => ({
		filters: ref({ search: undefined, status: 'all', enabled: 'all', capabilities: [] }),
		sort: ref([{ by: 'name', dir: 'asc' }]),
		pagination: ref({ page: 1, size: 10 }),
		viewMode: ref('table'),
		reset: vi.fn(),
	}),
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
				ElForm: {
					name: 'ElForm',
					template: '<form><slot /></form>',
					methods: {
						clearValidate: () => undefined,
						validate: () => Promise.resolve(true),
					},
				},
				ElFormItem: { name: 'ElFormItem', template: '<div><slot /></div>' },
				// shallowMount would otherwise auto-stub these away and drop their slots
				ViewHeader: { name: 'ViewHeader', props: ['title', 'subtitle', 'icon', 'actions'], template: '<header><slot name="actions" /></header>' },
				EditDrawerLayout: {
					name: 'EditDrawerLayout',
					props: { open: Boolean, beforeClose: Function, routeless: Boolean },
					template: '<div><slot /><aside><slot name="form" /></aside></div>',
				},
			},
		},
	});

describe('ViewMcpClients', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(ElMessageBox, 'confirm');
		// `clearAllMocks` leaves any queued `…Once` implementation in place, which
		// would leak a rejection into the next test.
		(ElMessageBox.confirm as Mock).mockReset().mockResolvedValue('confirm');
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

	it('hosts the client form in the template 4 edit drawer, without a route of its own', async () => {
		const wrapper = mountView();
		const layout = wrapper.findComponent({ name: 'EditDrawerLayout' });

		expect(layout.props('routeless')).toBe(true);
		expect(layout.props('open')).toBe(false);

		(wrapper.vm as unknown as { openCreate: () => void }).openCreate();
		await nextTick();

		expect(layout.props('open')).toBe(true);
	});

	it('shows the endpoint in a copy field', () => {
		const wrapper = mountView();
		const field = wrapper.findAllComponents({ name: 'CopyField' }).find((candidate) => candidate.attributes('data-test-id') === 'mcp-endpoint-url');

		expect(field?.props('value')).toBe(`${window.location.origin}/api/v1/modules/mcp`);
		expect(field?.props('label')).toBe('mcpModule.config.endpoint.title');
	});

	it('gives the capability ceiling as help text under the checkboxes', () => {
		const wrapper = mountView();

		const hint = wrapper.find('[data-test-id="mcp-client-capability-ceiling-hint"]');

		expect(hint.exists()).toBe(true);
		expect(hint.classes()).toContain('text-help');
	});

	it('offers search and add in the phone app bar', () => {
		const wrapper = mountView();
		const actions = wrapper.findAllComponents({ name: 'ViewHeader' })[0].props('actions') as { icon: string }[];

		expect(actions.map((action) => action.icon)).toEqual(['mdi:magnify', 'mdi:plus']);
	});

	it('confirms once for a bulk revoke rather than per selected client', async () => {
		const wrapper = mountView();
		const list = wrapper.findComponent({ name: 'ListMcpClients' });

		list.vm.$emit('bulk-action', 'revoke', [client, { ...client, id: 'second' }]);
		await nextTick();
		await flushPromises();

		expect(ElMessageBox.confirm).toHaveBeenCalledOnce();
		// The confirm button repeats the verb and the object (spec section 4)
		expect((ElMessageBox.confirm as Mock).mock.calls[0][2]).toMatchObject({ confirmButtonText: 'mcpModule.confirm.bulkRevokeButton' });
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

	it('gives the drawer heading a title and a subtitle row', () => {
		const wrapper = mountView();

		// The page header comes first, the drawer's header (drawn into the drawer's app bar) second
		const heading = wrapper.findAllComponents({ name: 'ViewHeader' })[1];

		expect(heading.props('title')).toBe('mcpModule.clientForm.createTitle');
		expect(heading.props('subtitle')).toBe('mcpModule.clientForm.formSubtitle');
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

		const footer = wrapper.findComponent({ name: 'FormFooter' });

		expect(footer.props('dirty')).toBe(false);
		expect(footer.props('canSave')).toBe(false);
		expect(footer.props('saveLabel')).toBe('mcpModule.actions.create');

		vm.clientForm.name = 'Something';
		await nextTick();

		expect(footer.props('dirty')).toBe(true);
		expect(footer.props('canSave')).toBe(true);
	});

	it('asks to confirm before discarding a changed form', async () => {
		const wrapper = mountView();
		const vm = wrapper.vm as unknown as { openCreate: () => void; clientForm: { name: string }; onCloseClientForm: () => Promise<void> };

		vm.openCreate();
		vm.clientForm.name = 'Something';
		await nextTick();

		await vm.onCloseClientForm();
		await flushPromises();

		expect(ElMessageBox.confirm).toHaveBeenCalledOnce();
	});

	it('closes without confirming when nothing was edited', async () => {
		const wrapper = mountView();
		const vm = wrapper.vm as unknown as { openCreate: () => void; onCloseClientForm: () => Promise<void> };

		vm.openCreate();
		await nextTick();

		await vm.onCloseClientForm();
		await flushPromises();

		expect(ElMessageBox.confirm).not.toHaveBeenCalled();
	});

	it('guards the drawer close event, not just the footer button', async () => {
		const wrapper = mountView();
		const vm = wrapper.vm as unknown as { openCreate: () => void; clientForm: { name: string } };

		vm.openCreate();
		vm.clientForm.name = 'Something';
		await nextTick();

		// Closing via the drawer itself — overlay click, escape, its own close
		// button — must run the same guard as the footer action, otherwise the
		// edits vanish without a word.
		const drawer = wrapper.findComponent({ name: 'EditDrawerLayout' });
		const beforeClose = drawer.props('beforeClose') as (done: () => void) => Promise<void>;

		expect(typeof beforeClose).toBe('function');

		const done = vi.fn();
		await beforeClose(done);
		await flushPromises();

		expect(ElMessageBox.confirm).toHaveBeenCalledOnce();
		expect(done).toHaveBeenCalledOnce();
	});

	it('keeps the drawer open when the discard confirmation is dismissed', async () => {
		(ElMessageBox.confirm as Mock).mockRejectedValueOnce('cancel');

		const wrapper = mountView();
		const vm = wrapper.vm as unknown as { openCreate: () => void; clientForm: { name: string } };

		vm.openCreate();
		vm.clientForm.name = 'Something';
		await nextTick();

		const drawer = wrapper.findComponent({ name: 'EditDrawerLayout' });
		const beforeClose = drawer.props('beforeClose') as (done: () => void) => Promise<void>;

		const done = vi.fn();
		await beforeClose(done);
		await flushPromises();

		expect(done).not.toHaveBeenCalled();
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
