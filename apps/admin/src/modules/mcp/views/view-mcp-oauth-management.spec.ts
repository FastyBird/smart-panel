import { nextTick, ref } from 'vue';

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
	updateGrant: vi.fn(),
	revokeClient: vi.fn(),
	revokeGrant: vi.fn().mockResolvedValue(undefined),
	revokeAccessToken: vi.fn(),
	revokeRefreshFamily: vi.fn(),
	revokeAll: vi.fn().mockResolvedValue(undefined),
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
	useBreakpoints: () => ({ isLGDevice: ref(true), isMDDevice: ref(true) }),
	AppBar: { name: 'AppBar', template: '<div><slot name="heading" /><slot name="button-right" /></div>' },
	AppBarHeading: {
		name: 'AppBarHeading',
		template: '<div><slot name="icon" /><slot name="title" /><slot name="subtitle" /></div>',
	},
	AppBarButton: { name: 'AppBarButton', template: '<button><slot name="icon" /></button>' },
	AppBarButtonAlign: { LEFT: 'left', RIGHT: 'right' },
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
		updateGrant: mocks.updateGrant,
		revokeClient: mocks.revokeClient,
		revokeGrant: mocks.revokeGrant,
		revokeAccessToken: mocks.revokeAccessToken,
		revokeRefreshFamily: mocks.revokeRefreshFamily,
		revokeAll: mocks.revokeAll,
	}),
}));

const formStubs = {
	ElDrawer: { name: 'ElDrawer', props: ['beforeClose'], template: '<aside><slot /></aside>' },
	ElScrollbar: { name: 'ElScrollbar', template: '<div><slot /></div>' },
	ElText: { name: 'ElText', template: '<span><slot /></span>' },
	ElButton: {
		name: 'ElButton',
		props: { type: String, plain: Boolean, disabled: Boolean },
		template: '<button :disabled="disabled"><slot name="icon" /><slot /></button>',
	},
	ElForm: {
		name: 'ElForm',
		template: '<form><slot /></form>',
		methods: { clearValidate: () => undefined, validate: () => Promise.resolve(true) },
	},
	ElFormItem: { name: 'ElFormItem', template: '<div><slot /></div>' },
	ElTabs: { name: 'ElTabs', template: '<div><slot /></div>' },
	ElTabPane: { name: 'ElTabPane', template: '<div><slot /></div>' },
	ElCard: { name: 'ElCard', template: '<section><slot /></section>' },
	ElTable: { name: 'ElTable', template: '<table><slot /><slot name="empty" /></table>' },
	ElTableColumn: { name: 'ElTableColumn', template: '<td></td>' },
	AppBar: { name: 'AppBar', template: '<div><slot name="heading" /><slot name="button-right" /></div>' },
	AppBarHeading: {
		name: 'AppBarHeading',
		template: '<div><slot name="icon" /><slot name="title" /><slot name="subtitle" /></div>',
	},
	ViewHeader: { name: 'ViewHeader', template: '<header><slot name="extra" /></header>' },
};

const mountForms = () => shallowMount(ViewMcpOAuthManagement, { global: { stubs: formStubs } });

describe('ViewMcpOAuthManagement form conventions', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(ElMessageBox, 'confirm');
		(ElMessageBox.confirm as Mock).mockReset().mockResolvedValue('confirm');
	});

	it('puts the tabs above the cards rather than inside one', () => {
		const wrapper = mountForms();

		const tabs = wrapper.findComponent({ name: 'ElTabs' });

		expect(tabs.exists()).toBe(true);
		// A card wrapping the tab strip is the layout this page had; every other
		// tabbed view puts the tabs first and a card inside each pane.
		expect(tabs.element.closest('section')).toBeNull();
	});

	it('gives every tab a card of its own', () => {
		const wrapper = mountForms();

		expect(wrapper.findAllComponents({ name: 'ElTabPane' })).toHaveLength(4);
		expect(wrapper.findAllComponents({ name: 'McpTableEmpty' })).toHaveLength(4);
	});

	it('reports a load failure inside each table instead of as a page banner', () => {
		const wrapper = mountForms();

		for (const empty of wrapper.findAllComponents({ name: 'McpTableEmpty' })) {
			// Bound to the load error, so the table offers a retry rather than the
			// page carrying a dead-end alert.
			expect(empty.props('failed')).toBe(false);
			expect(empty.props('loading')).toBe(false);
		}
	});

	it('labels the header create action the way the other list headers do', () => {
		const wrapper = mountForms();

		const create = wrapper
			.findAllComponents({ name: 'ElButton' })
			.find((candidate) => candidate.attributes('data-test-id') === 'create-mcp-oauth-client');

		expect(create).toBeDefined();
		expect(create?.props('type')).toBe('primary');
		expect(create?.props('plain')).toBe(true);
		expect(create?.text()).toContain('mcpModule.actions.add');
	});

	it('gives both drawer headings a title and a subtitle row', () => {
		const wrapper = mountForms();

		const headings = wrapper.findAllComponents({ name: 'AppBarHeading' });

		expect(headings.length).toBe(2);

		for (const heading of headings) {
			expect(heading.find('[data-test-id="drawer-heading-title"]').exists()).toBe(true);
			expect(heading.find('[data-test-id="drawer-heading-subtitle"]').exists()).toBe(true);
		}
	});

	it.each([
		['client', 'openCreate', 'clientFormChanged'],
		['grant', 'openGrantEdit', 'grantFormChanged'],
	])('tracks changes on the %s form', async (_label, opener, changedKey) => {
		const wrapper = mountForms();
		const vm = wrapper.vm as unknown as Record<string, unknown>;

		(vm[opener] as (value?: unknown) => void)(grant);
		await nextTick();

		expect(vm[changedKey]).toBe(false);
	});

	it('guards the client drawer close event', async () => {
		const wrapper = mountForms();
		const vm = wrapper.vm as unknown as { openCreate: () => void; clientForm: { name: string } };

		vm.openCreate();
		vm.clientForm.name = 'Something';
		await nextTick();

		const drawer = wrapper.findComponent({ name: 'ElDrawer' });
		const beforeClose = drawer.props('beforeClose') as (done: () => void) => Promise<void>;
		const done = vi.fn();

		await beforeClose(done);
		await flushPromises();

		expect(ElMessageBox.confirm).toHaveBeenCalledOnce();
		expect(done).toHaveBeenCalledOnce();
	});

	it('offers close on an untouched client form and discard once it changed', async () => {
		const wrapper = mountForms();
		const vm = wrapper.vm as unknown as { openCreate: () => void; clientForm: { name: string } };

		vm.openCreate();
		await nextTick();

		expect(wrapper.find('[data-test-id="cancel-mcp-oauth-client-form"]').text()).toContain('mcpModule.actions.close');

		vm.clientForm.name = 'Something';
		await nextTick();

		expect(wrapper.find('[data-test-id="cancel-mcp-oauth-client-form"]').text()).toContain('mcpModule.actions.discard');
	});
});

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

	it('requires confirmation before revoking all OAuth authorization', async () => {
		const wrapper = shallowMount(ViewMcpOAuthManagement);
		const vm = wrapper.vm as unknown as { confirmGlobalRevoke: () => Promise<void> };

		await vm.confirmGlobalRevoke();
		await flushPromises();

		expect(ElMessageBox.confirm).toHaveBeenCalledOnce();
		expect(mocks.revokeAll).toHaveBeenCalledOnce();
		expect(mocks.flashSuccess).toHaveBeenCalledWith('mcpModule.oauthManagement.messages.allRevoked');
	});

	it('labels an unusable grant with the backend inactive state', () => {
		const wrapper = shallowMount(ViewMcpOAuthManagement);
		const vm = wrapper.vm as unknown as {
			grantStatus: (value: IMcpOAuthGrant) => { key: string; type: string };
		};

		expect(vm.grantStatus({ ...grant, active: false })).toEqual({ key: 'inactive', type: 'warning' });
	});

	it('allows inactive grants to be revoked until they expire or are revoked', () => {
		const wrapper = shallowMount(ViewMcpOAuthManagement);
		const vm = wrapper.vm as unknown as {
			canRevokeGrant: (value: IMcpOAuthGrant) => boolean;
		};

		expect(vm.canRevokeGrant({ ...grant, active: false })).toBe(true);
		expect(vm.canRevokeGrant({ ...grant, active: false, revokedAt: '2026-01-02T00:00:00.000Z' })).toBe(false);
		expect(vm.canRevokeGrant({ ...grant, active: false, expiresAt: '2020-01-01T00:00:00.000Z' })).toBe(false);
	});

	it('hosts the client and grant forms in drawers rather than dialogs', () => {
		const wrapper = shallowMount(ViewMcpOAuthManagement);

		// Matches the rest of the admin, which edits records in a drawer.
		expect(wrapper.find('[data-test-id="mcp-oauth-client-form-drawer"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="mcp-oauth-grant-form-drawer"]').exists()).toBe(true);
	});

	it('allows scope editing only while the grant is active', () => {
		const wrapper = shallowMount(ViewMcpOAuthManagement);
		const vm = wrapper.vm as unknown as {
			canEditGrant: (value: IMcpOAuthGrant) => boolean;
		};

		expect(vm.canEditGrant(grant)).toBe(true);
		expect(vm.canEditGrant({ ...grant, active: false })).toBe(false);
	});
});
