import { type Ref, defineComponent, markRaw } from 'vue';

import { ElMessageBox } from 'element-plus';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type VueWrapper, flushPromises, mount } from '@vue/test-utils';

import { RouteNames } from '../automations.constants';
import { discardAutomationDraft, peekAutomationDraft } from '../automations.drafts';
import { ListAutomations } from '../components/components';

import ViewAutomations from './view-automations.vue';

const mocks = vi.hoisted(() => ({
	fetchAutomations: vi.fn(),
	fetchSpaces: vi.fn(),
	exportAutomation: vi.fn(),
	fetchSuggestions: vi.fn(),
	dismissSuggestion: vi.fn(),
	routerPush: vi.fn(),
	routerReplace: vi.fn(),
	route: null as unknown as { name: string; path: string; matched: { name: string }[]; query: Record<string, string> },
	detailMounts: 0,
	// Assigned by the mock factories below, which is the first place `ref` is available
	loadFailed: null as unknown as Ref<boolean>,
	isLGDevice: null as unknown as Ref<boolean>,
}));

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('vue-meta', () => ({
	useMeta: () => ({ meta: {} }),
}));

vi.mock('vue-router', async () => {
	const { reactive } = await import('vue');

	mocks.route = reactive({ name: 'automations_module-automations', path: '/automations', matched: [], query: {} });

	return {
		useRoute: () => mocks.route,
		useRouter: () => ({
			push: mocks.routerPush,
			replace: mocks.routerReplace,
			// An automation's edit form lives at its id, as in the real routes
			resolve: (to: { params?: { id?: string } }) => ({ ...to, path: to.params?.id ? `/automations/${to.params.id}` : undefined }),
		}),
	};
});

// What the router shows in the drawer: it reports its form the way the detail views do
const DetailView = defineComponent({
	name: 'DetailView',
	props: { remoteFormChanged: { type: Boolean, default: false } },
	emits: ['update:remote-form-changed', 'update:remote-form-saving'],
	mounted() {
		mocks.detailMounts++;
	},
	template: '<div />',
});

vi.mock('../../../common', async () => {
	const { defineComponent: defineVueComponent, h, ref } = await import('vue');

	mocks.isLGDevice = ref<boolean>(true);

	const StubComponent = defineVueComponent({
		setup(_, { slots }) {
			return () => h('div', [slots.default?.(), slots['button-right']?.(), slots.actions?.()]);
		},
	});

	return {
		AppBreadcrumbs: StubComponent,
		ViewError: StubComponent,
		ViewHeader: StubComponent,
		// The real layout puts the form in a drawer or beside the list; all that matters here is whether it is open
		EditDrawerLayout: defineVueComponent({
			name: 'EditDrawerLayout',
			props: { open: { type: Boolean, default: false }, beforeClose: { type: Function, default: undefined } },
			emits: ['close'],
			setup(props, { slots }) {
				return () => h('div', [slots.default?.(), props.open ? slots.form?.() : null]);
			},
		}),
		// From tablet portrait up the form opens beside the list; on phone it is a page of its own
		provideEditDrawer: () => ({ inDrawer: mocks.isLGDevice }),
	};
});

vi.mock('../components/components', async () => {
	const { defineComponent: defineVueComponent } = await import('vue');

	return {
		ListAutomations: defineVueComponent({
			name: 'ListAutomations',
			props: {
				loading: { type: Boolean, default: false },
				loadFailed: { type: Boolean, default: false },
			},
			emits: ['retry', 'flow', 'export', 'edit'],
			setup: (_, { expose }) => expose({ focusSearch: vi.fn() }),
			template: '<div />',
		}),
		AutomationTemplateDialog: defineVueComponent({
			name: 'AutomationTemplateDialog',
			props: { visible: { type: Boolean, default: false } },
			emits: ['update:visible', 'generated'],
			template: '<div />',
		}),
		AutomationImportDialog: defineVueComponent({
			name: 'AutomationImportDialog',
			props: { visible: { type: Boolean, default: false } },
			emits: ['update:visible', 'imported'],
			template: '<div />',
		}),
		AutomationSuggestions: defineVueComponent({
			name: 'AutomationSuggestions',
			props: { suggestions: { type: Array, default: () => [] }, answering: { type: Array, default: () => [] } },
			emits: ['open', 'dismiss'],
			template: '<div />',
		}),
	};
});

vi.mock('../composables/composables', async () => {
	const { ref } = await import('vue');

	mocks.loadFailed = ref<boolean>(false);

	return {
		useAutomationSpaces: () => ({ fetchSpaces: mocks.fetchSpaces }),
		useAutomationExport: () => ({ exporting: () => false, exportAutomation: mocks.exportAutomation }),
		useAutomationSuggestions: () => ({
			suggestions: ref([]),
			answering: ref([]),
			fetchSuggestions: mocks.fetchSuggestions,
			dismiss: mocks.dismissSuggestion,
			toDraft: (suggestion: { id: string; spaceId: string | null; draft: Record<string, unknown> }) => ({
				...suggestion.draft,
				spaceId: suggestion.spaceId,
				suggestionId: suggestion.id,
			}),
		}),
		useAutomationsActions: () => ({ updating: ref([]), remove: vi.fn(), setEnabled: vi.fn() }),
		useAutomationsDataSource: () => ({
			fetchAutomations: mocks.fetchAutomations,
			automations: ref([]),
			automationsPaginated: ref([]),
			totalRows: ref(0),
			filters: ref({ search: undefined, spaceId: undefined, enabled: 'all', statuses: [] }),
			filtersActive: ref(false),
			sortBy: ref('name'),
			sortDir: ref('asc'),
			paginateSize: ref(10),
			paginatePage: ref(1),
			areLoading: ref(false),
			loadFailed: mocks.loadFailed,
			resetFilter: vi.fn(),
		}),
	};
});

describe('ViewAutomations', (): void => {
	let wrapper: VueWrapper;

	const mountView = async (): Promise<VueWrapper> => {
		wrapper = mount(ViewAutomations, {
			global: {
				stubs: {
					RouterView: {
						name: 'RouterView',
						data: () => ({ detail: markRaw(DetailView) }),
						template: '<slot :Component="detail" />',
					},
				},
			},
		});

		await flushPromises();

		return wrapper;
	};

	afterEach((): void => {
		wrapper.unmount();
	});

	beforeEach((): void => {
		vi.clearAllMocks();

		mocks.fetchAutomations.mockResolvedValue(undefined);
		mocks.fetchSpaces.mockResolvedValue(undefined);
		mocks.loadFailed.value = false;
		mocks.isLGDevice.value = true;

		openRoute(listRoute);
	});

	const listRoute = { name: 'automations_module-automations', path: '/automations' };
	const addRoute = { name: 'automations_module-automations_add', path: '/automations/add' };
	const editRoute = { name: 'automations_module-automations_edit', path: '/automations/1' };

	const openRoute = (route: { name: string; path: string }, query: Record<string, string> = {}): void => {
		Object.assign(mocks.route, route, { matched: [{ name: listRoute.name }, { name: route.name }], query });
	};

	const closeDrawer = (wrapper: VueWrapper): void => {
		(wrapper.findComponent({ name: 'EditDrawerLayout' }).props('beforeClose') as () => void)();
	};

	it('does not hand the changed state of a form that was left to the next one', async (): Promise<void> => {
		const confirm = vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue('confirm' as never);

		openRoute(editRoute);

		await mountView();

		wrapper.findComponent(DetailView).vm.$emit('update:remote-form-changed', true);

		await flushPromises();

		expect(wrapper.findComponent(DetailView).props('remoteFormChanged')).toBe(true);

		// Discarded from inside the form, or saved: the view goes back to the list on its own
		openRoute(listRoute);

		await flushPromises();

		openRoute(addRoute);

		await flushPromises();

		expect(wrapper.findComponent(DetailView).props('remoteFormChanged')).toBe(false);

		closeDrawer(wrapper);

		await flushPromises();

		expect(confirm).not.toHaveBeenCalled();
		expect(mocks.routerReplace).toHaveBeenCalledTimes(1);

		confirm.mockRestore();
	});

	it('asks before another automation replaces a changed form, and leaves the open one alone', async (): Promise<void> => {
		const confirm = vi
			.spyOn(ElMessageBox, 'confirm')
			.mockRejectedValueOnce('cancel')
			.mockResolvedValueOnce('confirm' as never);

		openRoute(editRoute);

		await mountView();

		wrapper.findComponent(DetailView).vm.$emit('update:remote-form-changed', true);

		await flushPromises();

		// The one already open: nothing to replace, nothing to ask
		mocks.route.path = '/automations/1';
		wrapper.findComponent(ListAutomations).vm.$emit('edit', '1');

		await flushPromises();

		expect(confirm).not.toHaveBeenCalled();

		wrapper.findComponent(ListAutomations).vm.$emit('edit', '2');

		await flushPromises();

		expect(confirm).toHaveBeenCalledTimes(1);
		expect(mocks.routerReplace).not.toHaveBeenCalled();

		wrapper.findComponent(ListAutomations).vm.$emit('edit', '2');

		await flushPromises();

		expect(mocks.routerReplace).toHaveBeenCalledWith(expect.objectContaining({ name: RouteNames.AUTOMATIONS_EDIT, params: { id: '2' } }));

		confirm.mockRestore();
	});

	it('asks before it closes the drawer over a changed form', async (): Promise<void> => {
		const confirm = vi.spyOn(ElMessageBox, 'confirm').mockRejectedValueOnce('cancel');

		openRoute(addRoute);

		await mountView();

		wrapper.findComponent(DetailView).vm.$emit('update:remote-form-changed', true);

		await flushPromises();

		closeDrawer(wrapper);

		await flushPromises();

		expect(confirm).toHaveBeenCalledTimes(1);
		expect(mocks.routerReplace).not.toHaveBeenCalled();

		confirm.mockRestore();
	});

	it('does not close the drawer while the form in it is being saved', async (): Promise<void> => {
		const confirm = vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue('confirm' as never);

		openRoute(editRoute);

		await mountView();

		const detail = wrapper.findComponent(DetailView);

		detail.vm.$emit('update:remote-form-changed', true);
		detail.vm.$emit('update:remote-form-saving', true);

		await flushPromises();

		closeDrawer(wrapper);

		await flushPromises();

		expect(confirm).not.toHaveBeenCalled();
		expect(mocks.routerReplace).not.toHaveBeenCalled();

		detail.vm.$emit('update:remote-form-saving', false);

		await flushPromises();

		closeDrawer(wrapper);

		await flushPromises();

		expect(confirm).toHaveBeenCalledTimes(1);
		expect(mocks.routerReplace).toHaveBeenCalledTimes(1);

		confirm.mockRestore();
	});

	it('hands a failed first load to the list and loads again when asked to', async (): Promise<void> => {
		mocks.fetchAutomations.mockImplementationOnce(async (): Promise<never> => {
			mocks.loadFailed.value = true;

			throw new Error('offline');
		});

		// A rejection nobody handles would fail the test run
		await mountView();

		expect(wrapper.findComponent(ListAutomations).props('loadFailed')).toBe(true);
		expect(mocks.fetchAutomations).toHaveBeenCalledTimes(1);

		wrapper.findComponent(ListAutomations).vm.$emit('retry');

		await flushPromises();

		expect(mocks.fetchAutomations).toHaveBeenCalledTimes(2);
	});

	it('opens the flow editor of an automation as a page of its own', async (): Promise<void> => {
		await mountView();

		wrapper.findComponent(ListAutomations).vm.$emit('flow', 'automation-1');

		await flushPromises();

		// Pushed even on a large screen: the list stays in the history to come back to
		expect(mocks.routerPush).toHaveBeenCalledWith({ name: RouteNames.AUTOMATIONS_FLOW, params: { id: 'automation-1' } });
		expect(mocks.routerReplace).not.toHaveBeenCalled();
	});

	it('opens the template dialog and the add form with the flow it generated', async (): Promise<void> => {
		await mountView();

		const dialog = wrapper.findComponent({ name: 'AutomationTemplateDialog' });

		expect(dialog.props('visible')).toBe(false);

		await wrapper.find('[data-test-id="automations-from-template"]').trigger('click');
		await flushPromises();

		expect(dialog.props('visible')).toBe(true);

		dialog.vm.$emit('generated', 'draft-1');

		await flushPromises();

		expect(mocks.routerReplace).toHaveBeenCalledWith({ name: RouteNames.AUTOMATIONS_ADD, params: undefined, query: { draft: 'draft-1' } });
	});

	describe('suggested by Buddy', (): void => {
		const suggestion = {
			id: 'suggestion-1',
			title: 'Automate this routine?',
			reason: 'You perform 2 actions in Living Room around 7 PM regularly.',
			spaceId: 'space-1',
			draft: { name: 'Living Room Evening', mode: 'single', graph: { version: 1, nodes: [], edges: [] } },
		};

		it('reads the suggestions with the list', async (): Promise<void> => {
			await mountView();

			expect(mocks.fetchSuggestions).toHaveBeenCalledTimes(1);
		});

		it('opens the add form with the suggested draft, creating nothing', async (): Promise<void> => {
			await mountView();

			wrapper.findComponent({ name: 'AutomationSuggestions' }).vm.$emit('open', suggestion);

			await flushPromises();

			const [[to]] = mocks.routerReplace.mock.calls as [[{ name: string; query: { draft: string } }]];

			expect(to.name).toBe(RouteNames.AUTOMATIONS_ADD);
			expect(peekAutomationDraft(to.query.draft)).toEqual({
				name: 'Living Room Evening',
				mode: 'single',
				graph: { version: 1, nodes: [], edges: [] },
				spaceId: 'space-1',
				suggestionId: 'suggestion-1',
			});

			discardAutomationDraft(to.query.draft);
		});

		it('dismisses a suggestion', async (): Promise<void> => {
			await mountView();

			wrapper.findComponent({ name: 'AutomationSuggestions' }).vm.$emit('dismiss', suggestion);

			await flushPromises();

			expect(mocks.dismissSuggestion).toHaveBeenCalledWith('suggestion-1');
			expect(mocks.routerReplace).not.toHaveBeenCalled();
		});
	});

	it('exports an automation of the list as YAML', async (): Promise<void> => {
		await mountView();

		wrapper.findComponent(ListAutomations).vm.$emit('export', 'automation-1');

		await flushPromises();

		expect(mocks.exportAutomation).toHaveBeenCalledWith('automation-1');
	});

	it('opens the import dialog and the editor of the automation it imported', async (): Promise<void> => {
		await mountView();

		const dialog = wrapper.findComponent({ name: 'AutomationImportDialog' });

		expect(dialog.props('visible')).toBe(false);

		await wrapper.find('[data-test-id="automations-import"]').trigger('click');
		await flushPromises();

		expect(dialog.props('visible')).toBe(true);

		dialog.vm.$emit('imported', 'automation-2');

		await flushPromises();

		expect(mocks.routerPush).toHaveBeenCalledWith({ name: RouteNames.AUTOMATIONS_FLOW, params: { id: 'automation-2' } });
	});

	it('opens a new add form when another template is generated while one is open', async (): Promise<void> => {
		openRoute(addRoute, { draft: 'draft-1' });

		await mountView();

		const mounted = mocks.detailMounts;

		openRoute(addRoute, { draft: 'draft-2' });

		await flushPromises();

		// The add form keeps the automation id and the draft from its setup, so it is not reused for another one
		expect(mocks.detailMounts).toBe(mounted + 1);
	});

	describe('over a form in the drawer', (): void => {
		const changedForm = async (): Promise<void> => {
			openRoute(editRoute);

			await mountView();

			wrapper.findComponent(DetailView).vm.$emit('update:remote-form-changed', true);

			await flushPromises();
		};

		it.each([
			['From template', 'automations-from-template'],
			['Add automation', 'automations-add'],
		])('asks before %s replaces a changed form, and leaves the form when the answer is no', async (_label, button): Promise<void> => {
			const confirm = vi.spyOn(ElMessageBox, 'confirm').mockRejectedValueOnce('cancel');

			await changedForm();

			await wrapper.find(`[data-test-id="${button}"]`).trigger('click');
			await flushPromises();

			expect(confirm).toHaveBeenCalledTimes(1);
			expect(wrapper.findComponent({ name: 'AutomationTemplateDialog' }).props('visible')).toBe(false);
			expect(mocks.routerReplace).not.toHaveBeenCalled();
			expect(wrapper.findComponent(DetailView).props('remoteFormChanged')).toBe(true);

			confirm.mockRestore();
		});

		it('starts a new add form when the open one may be discarded', async (): Promise<void> => {
			const confirm = vi.spyOn(ElMessageBox, 'confirm').mockResolvedValueOnce('confirm' as never);

			openRoute(addRoute);

			await mountView();

			wrapper.findComponent(DetailView).vm.$emit('update:remote-form-changed', true);

			await flushPromises();

			const mounted = mocks.detailMounts;

			// The same route again is no navigation at all, so the form would stay with what was typed
			await wrapper.find('[data-test-id="automations-add"]').trigger('click');
			await flushPromises();

			expect(confirm).toHaveBeenCalledTimes(1);
			expect(mocks.detailMounts).toBe(mounted + 1);
			expect(wrapper.findComponent(DetailView).props('remoteFormChanged')).toBe(false);

			confirm.mockRestore();
		});

		it('opens the template dialog once a changed form may be discarded', async (): Promise<void> => {
			const confirm = vi.spyOn(ElMessageBox, 'confirm').mockResolvedValueOnce('confirm' as never);

			await changedForm();

			await wrapper.find('[data-test-id="automations-from-template"]').trigger('click');
			await flushPromises();

			expect(confirm).toHaveBeenCalledTimes(1);
			expect(wrapper.findComponent({ name: 'AutomationTemplateDialog' }).props('visible')).toBe(true);

			confirm.mockRestore();
		});

		it('asks before the import dialog replaces a changed form, and opens it only when the answer is yes', async (): Promise<void> => {
			const confirm = vi
				.spyOn(ElMessageBox, 'confirm')
				.mockRejectedValueOnce('cancel')
				.mockResolvedValueOnce('confirm' as never);

			await changedForm();

			const dialog = wrapper.findComponent({ name: 'AutomationImportDialog' });

			await wrapper.find('[data-test-id="automations-import"]').trigger('click');
			await flushPromises();

			expect(dialog.props('visible')).toBe(false);
			expect(wrapper.findComponent(DetailView).props('remoteFormChanged')).toBe(true);

			await wrapper.find('[data-test-id="automations-import"]').trigger('click');
			await flushPromises();

			expect(confirm).toHaveBeenCalledTimes(2);
			expect(dialog.props('visible')).toBe(true);

			confirm.mockRestore();
		});

		it('does not replace a form while it is being saved', async (): Promise<void> => {
			const confirm = vi.spyOn(ElMessageBox, 'confirm');

			await changedForm();

			wrapper.findComponent(DetailView).vm.$emit('update:remote-form-saving', true);

			await flushPromises();

			await wrapper.find('[data-test-id="automations-from-template"]').trigger('click');
			await wrapper.find('[data-test-id="automations-add"]').trigger('click');
			await flushPromises();

			expect(confirm).not.toHaveBeenCalled();
			expect(wrapper.findComponent({ name: 'AutomationTemplateDialog' }).props('visible')).toBe(false);
			expect(mocks.routerReplace).not.toHaveBeenCalled();

			confirm.mockRestore();
		});
	});

	it('shows the list even when the spaces could not be loaded', async (): Promise<void> => {
		mocks.fetchSpaces.mockRejectedValue(new Error('offline'));

		await mountView();

		expect(wrapper.findComponent(ListAutomations).exists()).toBe(true);
	});
});
