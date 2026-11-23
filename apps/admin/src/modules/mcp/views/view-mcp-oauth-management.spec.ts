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
	routerReplace: vi.fn(),
}));

vi.mock('vue-router', () => ({
	useRoute: () => ({ query: {} }),
	useRouter: () => ({ replace: mocks.routerReplace }),
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

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key, locale: { value: 'en-US' } }) }));
const editDrawerLayout = {
	name: 'EditDrawerLayout',
	props: { open: Boolean, beforeClose: Function, routeless: Boolean },
	template: '<div><slot /><aside><slot name="form" /></aside></div>',
};

vi.mock('../../../common', () => ({
	ViewHeader: { name: 'ViewHeader', props: ['title', 'subtitle', 'icon', 'actions'], template: '<header><slot name="actions" /></header>' },
	CopyField: { name: 'CopyField', props: ['value', 'label'], template: '<div />' },
	EditDrawerLayout: {
		name: 'EditDrawerLayout',
		props: { open: Boolean, beforeClose: Function, routeless: Boolean },
		template: '<div><slot /><aside><slot name="form" /></aside></div>',
	},
	FormFooter: { name: 'FormFooter', props: ['dirty', 'saving', 'canSave'], template: '<footer />' },
	StatusTag: { name: 'StatusTag', props: ['status', 'label'], template: '<span />' },
	provideEditDrawer: () => ({}),
	useFlashMessage: () => ({ success: mocks.flashSuccess, error: mocks.flashError }),
	useSizeClass: () => ({ isPhone: ref(false) }),
	useListQuery: () => ({
		filters: ref({ search: undefined, status: 'all' }),
		sort: ref([{ by: 'name', dir: 'asc' }]),
		pagination: ref({}),
		viewMode: ref('table'),
		reset: vi.fn(),
	}),
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
	EditDrawerLayout: editDrawerLayout,
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
	ElTable: { name: 'ElTable', props: ['defaultSort'], template: '<table><slot /><slot name="empty" /></table>' },
	ElTableColumn: { name: 'ElTableColumn', template: '<td></td>' },
	ElTooltip: { name: 'ElTooltip', template: '<div><slot /></div>' },
	ElDropdown: { name: 'ElDropdown', emits: ['command'], template: '<div><slot /><slot name="dropdown" /></div>' },
	ElDropdownMenu: { name: 'ElDropdownMenu', template: '<ul><slot /></ul>' },
	ElDropdownItem: { name: 'ElDropdownItem', props: ['command'], template: '<li><slot /></li>' },
	// Keyed by the name the view imports it under: `<mcp-oauth-tab>` resolves to `McpOauthTab`
	McpOauthTab: { name: 'McpOAuthTab', props: ['statusOptions', 'filters', 'testId'], template: '<section><slot /></section>' },
	ViewHeader: { name: 'ViewHeader', props: ['title', 'subtitle', 'icon', 'actions'], template: '<header><slot name="actions" /></header>' },
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

	it('gives every tab its own search and filter bar', () => {
		const wrapper = mountForms();

		const bars = wrapper.findAllComponents({ name: 'McpOAuthTab' });

		expect(bars).toHaveLength(4);

		// Refresh families have no status of their own, so that tab shows search
		// alone rather than a select with nothing meaningful in it.
		const withStatus = bars.filter((bar) => (bar.props('statusOptions') as unknown[]).length > 0);

		expect(withStatus).toHaveLength(3);
	});

	it('builds every tab as one template 1 card holding its filter bar and table', () => {
		const wrapper = mountForms();

		for (const tab of wrapper.findAllComponents({ name: 'McpOAuthTab' })) {
			expect(tab.findComponent({ name: 'ElTable' }).exists()).toBe(true);
		}
	});

	it('gives the phone grant rows the scopes and the expiry, like the table', () => {
		const wrapper = mountForms();
		const vm = wrapper.vm as unknown as { grantRows: { caption: string }[] };

		expect(vm.grantRows[0].caption).toContain('mcpModule.oauthManagement.scope.mcp:read');
		expect(vm.grantRows[0].caption).toContain('·');
	});

	it('keeps Revoke all in the header menu, as a destructive item', () => {
		const wrapper = mountForms();
		const item = wrapper.find('[data-test-id="revoke-all-mcp-oauth"]');

		expect(item.exists()).toBe(true);
		expect(item.classes()).toContain('text-danger!');
	});

	it('tells each table which column it is sorted by', () => {
		const wrapper = mountForms();

		const tables = wrapper.findAllComponents({ name: 'ElTable' });

		expect(tables).toHaveLength(4);

		for (const table of tables) {
			// Without `default-sort` the header renders no active arrow, so the
			// list looks unsorted while actually being sorted.
			expect(table.props('defaultSort')).toEqual({ prop: expect.any(String), order: 'ascending' });
		}
	});

	it('reflects the selected tab in the url', async () => {
		const wrapper = mountForms();
		const vm = wrapper.vm as unknown as { activeTab: string };

		vm.activeTab = 'grants';
		await nextTick();

		expect(mocks.routerReplace).toHaveBeenCalledWith(expect.objectContaining({ query: expect.objectContaining({ tab: 'grants' }) }));
	});

	it('does not let a failed retry escape as an unhandled rejection', async () => {
		mocks.fetchAll.mockRejectedValueOnce(new Error('still broken'));

		const wrapper = mountForms();
		const vm = wrapper.vm as unknown as { onRetry: () => void };

		// `fetchAll` rethrows so callers can react; as an event handler that
		// rejection has nowhere to go and Vue reports it as an unhandled error.
		expect(() => vm.onRetry()).not.toThrow();
		await flushPromises();

		expect(mocks.fetchAll).toHaveBeenCalled();
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

	it('opens one form at a time in the edit drawer, each with a title and a subtitle', async () => {
		const wrapper = mountForms();
		const vm = wrapper.vm as unknown as { openCreate: () => Promise<void>; openGrantEdit: (value: IMcpOAuthGrant) => Promise<void> };
		const layout = wrapper.findComponent({ name: 'EditDrawerLayout' });

		expect(layout.props('routeless')).toBe(true);
		expect(layout.props('open')).toBe(false);

		await vm.openCreate();
		await nextTick();

		expect(layout.props('open')).toBe(true);
		expect(wrapper.findAllComponents({ name: 'ViewHeader' })[1].props('title')).toBe('mcpModule.oauthManagement.createClient');
		expect(wrapper.findAllComponents({ name: 'ViewHeader' })[1].props('subtitle')).toBe('mcpModule.oauthManagement.clientFormSubtitle');

		await vm.openGrantEdit(grant);
		await nextTick();

		expect(wrapper.findAllComponents({ name: 'ViewHeader' })).toHaveLength(2);
		expect(wrapper.findAllComponents({ name: 'ViewHeader' })[1].props('title')).toBe('mcpModule.oauthManagement.editGrant');
		expect(wrapper.findAllComponents({ name: 'ViewHeader' })[1].props('subtitle')).toBe('mcpModule.oauthManagement.grantFormSubtitle');
	});

	it.each([
		['client', 'openCreate', 'clientFormChanged'],
		['grant', 'openGrantEdit', 'grantFormChanged'],
	])('tracks changes on the %s form', async (_label, opener, changedKey) => {
		const wrapper = mountForms();
		const vm = wrapper.vm as unknown as Record<string, unknown>;

		await (vm[opener] as (value?: unknown) => Promise<void>)(grant);
		await nextTick();

		expect(vm[changedKey]).toBe(false);
	});

	it('guards the drawer close event', async () => {
		const wrapper = mountForms();
		const vm = wrapper.vm as unknown as { openCreate: () => Promise<void>; clientForm: { name: string } };

		await vm.openCreate();
		vm.clientForm.name = 'Something';
		await nextTick();

		const beforeClose = wrapper.findComponent({ name: 'EditDrawerLayout' }).props('beforeClose') as (done: () => void) => Promise<void>;
		const done = vi.fn();

		await beforeClose(done);
		await flushPromises();

		expect(ElMessageBox.confirm).toHaveBeenCalledOnce();
		expect(done).toHaveBeenCalledOnce();
	});

	it('asks before the grant form replaces a changed client form, and keeps the edits when dismissed', async () => {
		(ElMessageBox.confirm as Mock).mockRejectedValueOnce('cancel');

		const wrapper = mountForms();
		const vm = wrapper.vm as unknown as {
			openCreate: () => Promise<void>;
			openGrantEdit: (value: IMcpOAuthGrant) => Promise<void>;
			clientForm: { name: string };
			showClientDialog: boolean;
			showGrantDialog: boolean;
		};

		await vm.openCreate();
		vm.clientForm.name = 'Unsaved';
		await nextTick();

		// The docked form leaves the tables usable, so a row's Edit lands here while the form is open
		await vm.openGrantEdit(grant);
		await flushPromises();

		expect(ElMessageBox.confirm).toHaveBeenCalledOnce();
		expect(vm.showClientDialog).toBe(true);
		expect(vm.showGrantDialog).toBe(false);
		expect(vm.clientForm.name).toBe('Unsaved');
	});

	it('offers close on an untouched client form and discard once it changed', async () => {
		const wrapper = mountForms();
		const vm = wrapper.vm as unknown as { openCreate: () => Promise<void>; clientForm: { name: string } };

		await vm.openCreate();
		await nextTick();

		const footer = wrapper.findComponent({ name: 'FormFooter' });

		expect(footer.props('dirty')).toBe(false);
		expect(footer.props('canSave')).toBe(false);

		vm.clientForm.name = 'Something';
		await nextTick();

		expect(footer.props('dirty')).toBe(true);
		expect(footer.props('canSave')).toBe(true);
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

	it('hosts the client and grant forms in the template 4 edit drawer, without a route of their own', () => {
		const wrapper = shallowMount(ViewMcpOAuthManagement);

		expect(wrapper.findComponent({ name: 'EditDrawerLayout' }).props('routeless')).toBe(true);
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
