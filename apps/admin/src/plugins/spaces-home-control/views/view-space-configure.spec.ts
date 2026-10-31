/* eslint-disable vue/one-component-per-file */
import { type Ref, defineComponent, h, nextTick } from 'vue';
import { RouterView, createMemoryHistory, createRouter } from 'vue-router';

import { ElMessageBox, ElSwitch } from 'element-plus';
import createClient from 'openapi-fetch';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount, shallowMount } from '@vue/test-utils';

import { SpaceType } from '../../../modules/spaces/spaces.constants';
import type { paths } from '../../../openapi';
import SpaceModeScheduleSection from '../components/SpaceModeScheduleSection.vue';
import SpaceOccupancySection from '../components/SpaceOccupancySection.vue';
import SpaceActivityModesSection from '../components/space-activity-modes-section.vue';

import ViewSpaceConfigure from './view-space-configure.vue';

const mocks = vi.hoisted(() => ({
	client: null as unknown,
	realRouter: false,
	lgDevice: null as Ref<boolean> | null,
	saveGate: null as Promise<void> | null,
	saveConflict: false,
	displaysLoaded: true,
	fetchDevices: vi.fn(),
	fetchDisplays: vi.fn(),
	fetchScenes: vi.fn(),
	fetchSpaces: vi.fn(),
	devicesLoaded: true,
	isLGDevice: false,
	routeMatched: [] as Array<{ name: string }>,
	routerPush: vi.fn(),
	routerReplace: vi.fn(),
	scenesLoaded: true,
	spacesFirstLoadFinished: false,
}));

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('vue-router', async (importOriginal) => {
	const actual = await importOriginal<typeof import('vue-router')>();
	return {
		...actual,
		onBeforeRouteLeave: (...args: Parameters<typeof actual.onBeforeRouteLeave>) => {
			if (mocks.realRouter) actual.onBeforeRouteLeave(...args);
		},
		onBeforeRouteUpdate: (...args: Parameters<typeof actual.onBeforeRouteUpdate>) => {
			if (mocks.realRouter) actual.onBeforeRouteUpdate(...args);
		},
		useRoute: () =>
			mocks.realRouter
				? actual.useRoute()
				: { matched: mocks.routeMatched, path: '/space/7a1bafdc-8c7d-4d5a-9e2a-4dfdc3c8253d/plugin/spaces-home-control/configure' },
		useRouter: () => (mocks.realRouter ? actual.useRouter() : { push: mocks.routerPush, replace: mocks.routerReplace }),
	};
});

vi.mock('../../../common', async () => {
	const { defineComponent, ref } = await import('vue');

	return {
		AppBar: defineComponent({
			template: '<div><slot /><slot name="button-right" /></div>',
		}),
		AppBarButton: defineComponent({
			template: '<button type="button"><slot /><slot name="icon" /></button>',
		}),
		AppBarButtonAlign: {
			RIGHT: 'right',
		},
		ViewError: defineComponent({
			template: '<div><slot /><slot name="icon" /><slot name="message" /></div>',
		}),
		useBackend: () => ({ client: mocks.client }),
		useBreakpoints: () => ({
			isLGDevice: (mocks.lgDevice = ref(mocks.isLGDevice)),
		}),
	};
});

vi.mock('../../../modules/auth/composables/useSession', async () => {
	const { computed } = await import('vue');
	return { useSession: () => ({ profile: computed(() => ({ role: 'owner' })) }) };
});

vi.mock('../../../modules/devices/composables/useDevices', async () => {
	const { ref } = await import('vue');

	return {
		useDevices: () => ({
			fetchDevices: mocks.fetchDevices,
			loaded: ref(mocks.devicesLoaded),
		}),
	};
});

vi.mock('../../../modules/displays/composables/useDisplays', async () => {
	const { ref } = await import('vue');

	return {
		useDisplays: () => ({
			fetchDisplays: mocks.fetchDisplays,
			isLoaded: ref(mocks.displaysLoaded),
		}),
	};
});

vi.mock('../../../modules/scenes/composables/useScenes', async () => {
	const { ref } = await import('vue');

	return {
		useScenes: () => ({
			fetchScenes: mocks.fetchScenes,
			loaded: ref(mocks.scenesLoaded),
		}),
	};
});

vi.mock('../../../modules/spaces', async () => {
	const { ref } = await import('vue');
	const { SpaceType } = await import('../../../modules/spaces/spaces.constants');

	return {
		RouteNames: {
			SPACE_EDIT: 'spaces-plugin-edit',
		},
		SpaceType,
		useSpaces: () => ({
			fetchSpaces: mocks.fetchSpaces,
			firstLoadFinished: ref(mocks.spacesFirstLoadFinished),
		}),
	};
});

vi.mock('../components/components', async () => {
	const { defineComponent, h } = await import('vue');

	const StubComponent = (name: string) =>
		defineComponent({
			name,
			props: {
				space: { type: Object, required: false, default: null },
				spaceId: { type: String, required: false, default: null },
				spaceType: { type: String, required: false, default: null },
				visible: { type: Boolean, required: false },
			},
			setup(_, { slots }) {
				return () => h('div', slots.default?.());
			},
		});

	return {
		SpaceActivityModesSection: (await import('../components/space-activity-modes-section.vue')).default,
		SpaceModeScheduleSection: (await import('../components/SpaceModeScheduleSection.vue')).default,
		SpaceOccupancySection: (await import('../components/SpaceOccupancySection.vue')).default,
		SpaceAddDeviceDialog: StubComponent('SpaceAddDeviceDialog'),
		SpaceAddDisplayDialog: StubComponent('SpaceAddDisplayDialog'),
		SpaceAddSceneDialog: StubComponent('SpaceAddSceneDialog'),
		SpaceDetail: StubComponent('SpaceDetail'),
		SpaceDevicesSection: StubComponent('SpaceDevicesSection'),
		SpaceDisplaysSection: StubComponent('SpaceDisplaysSection'),
		SpaceDomainsSection: StubComponent('SpaceDomainsSection'),
		SpaceParentZoneSection: StubComponent('SpaceParentZoneSection'),
		SpaceScenesSection: StubComponent('SpaceScenesSection'),
	};
});

describe('ViewSpaceConfigure', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		mocks.devicesLoaded = true;
		mocks.scenesLoaded = true;
		mocks.displaysLoaded = true;
		mocks.isLGDevice = false;
		mocks.realRouter = false;
		mocks.saveGate = null;
		mocks.saveConflict = false;
		mocks.routeMatched = [];
		mocks.spacesFirstLoadFinished = false;
	});

	it('loads spaces collection before rendering when it has not been loaded yet', () => {
		shallowMount(ViewSpaceConfigure, {
			props: {
				space: {
					id: '7a1bafdc-8c7d-4d5a-9e2a-4dfdc3c8253d',
					name: 'Living room',
					category: null,
					description: null,
					type: SpaceType.ROOM,
					icon: null,
					displayOrder: 0,
					parentId: null,
					suggestionsEnabled: false,
					statusWidgets: null,
					createdAt: new Date(),
					updatedAt: null,
					draft: false,
				},
			},
			global: {
				renderStubDefaultSlot: true,
				stubs: {
					RouterView: true,
					teleport: true,
				},
			},
		});

		expect(mocks.fetchSpaces).toHaveBeenCalledTimes(1);
	});

	it('opens space edit inside the configure route', async () => {
		const wrapper = shallowMount(ViewSpaceConfigure, {
			props: {
				space: {
					id: '7a1bafdc-8c7d-4d5a-9e2a-4dfdc3c8253d',
					name: 'Living room',
					category: null,
					description: null,
					type: SpaceType.ROOM,
					icon: null,
					displayOrder: 0,
					parentId: null,
					suggestionsEnabled: false,
					statusWidgets: null,
					createdAt: new Date(),
					updatedAt: null,
					draft: false,
				},
			},
			global: {
				renderStubDefaultSlot: true,
				stubs: {
					RouterView: true,
					teleport: true,
				},
			},
		});

		await nextTick();

		await wrapper.find('[data-test-id="edit-space"]').trigger('click');

		expect(mocks.routerPush).toHaveBeenCalledWith({
			name: 'spaces_home_control_plugin-space_edit',
			params: {
				id: '7a1bafdc-8c7d-4d5a-9e2a-4dfdc3c8253d',
			},
		});
	});

	it('renders the edit child route on non-large screens', () => {
		mocks.routeMatched = [{ name: 'spaces_home_control_plugin-space_edit' }];

		const wrapper = shallowMount(ViewSpaceConfigure, {
			props: {
				space: {
					id: '7a1bafdc-8c7d-4d5a-9e2a-4dfdc3c8253d',
					name: 'Living room',
					category: null,
					description: null,
					type: SpaceType.ROOM,
					icon: null,
					displayOrder: 0,
					parentId: null,
					suggestionsEnabled: false,
					statusWidgets: null,
					createdAt: new Date(),
					updatedAt: null,
					draft: false,
				},
			},
			global: {
				stubs: {
					RouterView: true,
					teleport: true,
				},
			},
		});

		expect(wrapper.find('[data-test-id="space-configure-edit-route"]').exists()).toBe(true);
	});

	it('renders the floor selector and activity modes before domain controls', () => {
		const wrapper = shallowMount(ViewSpaceConfigure, {
			props: {
				space: {
					id: '7a1bafdc-8c7d-4d5a-9e2a-4dfdc3c8253d',
					name: 'Living room',
					category: null,
					description: null,
					type: SpaceType.ROOM,
					icon: null,
					displayOrder: 0,
					parentId: null,
					suggestionsEnabled: false,
					statusWidgets: null,
					createdAt: new Date(),
					updatedAt: null,
					draft: false,
				},
			},
			global: {
				renderStubDefaultSlot: true,
				stubs: {
					RouterView: true,
					teleport: true,
				},
			},
		});

		const detail = wrapper.findComponent({ name: 'SpaceDetail' });

		expect(detail.findComponent({ name: 'SpaceParentZoneSection' }).exists()).toBe(true);
		const modes = wrapper.findComponent({ name: 'SpaceActivityModesSection' });
		const domains = wrapper.findComponent({ name: 'SpaceDomainsSection' });
		expect(modes.props('spaceId')).toBe('7a1bafdc-8c7d-4d5a-9e2a-4dfdc3c8253d');
		expect(modes.element.compareDocumentPosition(domains.element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	});
});

describe('mounted configure activity mode support', () => {
	afterEach(() => {
		document.getElementById('space-manage-actions')?.remove();
	});
	const space = (type: SpaceType) => ({
		id: '7a1bafdc-8c7d-4d5a-9e2a-4dfdc3c8253d',
		name: 'Space',
		category: null,
		description: null,
		type,
		icon: null,
		displayOrder: 0,
		parentId: null,
		suggestionsEnabled: false,
		statusWidgets: null,
		createdAt: new Date(),
		updatedAt: null,
		draft: false,
	});
	let requests: Request[];
	const waitForSaveGate = async (request: Request) => {
		if (!mocks.saveGate) return;
		const gate = mocks.saveGate;
		await new Promise<void>((resolve, reject) => {
			request.signal.throwIfAborted();
			const abort = () => reject(new DOMException('Aborted', 'AbortError'));
			request.signal.addEventListener('abort', abort, { once: true });
			void gate.then(() => {
				request.signal.removeEventListener('abort', abort);
				resolve();
			});
		});
	};
	beforeEach(() => {
		mocks.realRouter = false;
		mocks.saveGate = null;
		mocks.saveConflict = false;
		mocks.routeMatched = [];
		mocks.spacesFirstLoadFinished = true;
		requests = [];
		const target = document.createElement('div');
		target.id = 'space-manage-actions';
		document.body.appendChild(target);
		mocks.client = createClient<paths>({
			baseUrl: 'http://localhost/api/v1',
			fetch: async (request: Request) => {
				requests.push(request);
				const occupancySpace = new URL(request.url).pathname.match(/\/spaces\/([^/]+)\/occupancy/)?.[1];
				if (request.method === 'GET' && occupancySpace) {
					const pathname = new URL(request.url).pathname;
					const data = pathname.endsWith('/sensors')
						? []
						: pathname.endsWith('/state')
							? {
									space_id: occupancySpace,
									status: 'unknown',
									enabled: false,
									running: true,
									manual_override: false,
									vacancy_remaining_seconds: null,
									last_attempt_status: null,
								}
							: {
									id: 'occupancy',
									space_id: occupancySpace,
									created_at: '2026-11-02T00:00:00Z',
									revision: 1,
									enabled: false,
									vacancy_timeout_seconds: 900,
									maximum_age_seconds: 3600,
									sensor_property_ids: [],
									occupied_mode: null,
									vacant_mode: null,
								};
					return new Response(JSON.stringify({ data }), { headers: { 'Content-Type': 'application/json' } });
				}

				if (request.method === 'PUT') {
					const body = await request.json();
					if (mocks.saveConflict) return new Response(JSON.stringify({ data: null }), { status: 409 });
					await waitForSaveGate(request);
					return new Response(
						JSON.stringify({
							data: { id: 'schedule', space_id: space(SpaceType.ROOM).id, created_at: '2026-11-02T00:00:00Z', ...body.data, revision: 2 },
						}),
						{ headers: { 'Content-Type': 'application/json' } }
					);
				}
				if (new URL(request.url).pathname.endsWith('/schedules')) {
					if (mocks.saveConflict && requests.some((request) => request.method === 'PUT')) await waitForSaveGate(request);
					return new Response(
						JSON.stringify({
							data: {
								id: 'schedule',
								space_id: space(SpaceType.ROOM).id,
								created_at: '2026-11-02T00:00:00Z',
								enabled: false,
								timezone: null,
								entries: [],
								revision: 1,
							},
						}),
						{ headers: { 'Content-Type': 'application/json' } }
					);
				}
				const mode = new URL(request.url).pathname.split('/')[8];
				return new Response(
					JSON.stringify({
						data: {
							id: mode,
							space_id: space(SpaceType.ROOM).id,
							created_at: '2026-10-16T00:00:00Z',
							type: 'activity_config',
							activity_mode: mode,
							activity_enabled: true,
							activity_order: 0,
							activity_revision: 1,
							activity_configuration: {
								lighting: { enabled: true, mode: 'work' },
								climate: { enabled: false },
								covers: { enabled: true, position: 50 },
								media: { enabled: false, activity: 'off' },
								security: { enabled: false },
							},
						},
					}),
					{ headers: { 'Content-Type': 'application/json' } }
				);
			},
		});
	});
	const render = (type: SpaceType) =>
		mount(ViewSpaceConfigure, {
			props: { space: space(type) },
			global: { stubs: { RouterView: true, teleport: false } },
		});
	it.each([SpaceType.ROOM, SpaceType.ZONE, SpaceType.MASTER, SpaceType.ENTRY, SpaceType.SIGNAGE_INFO_PANEL])(
		'only requests activity configuration for supported space type %s',
		async (type) => {
			const wrapper = render(type);
			await flushPromises();
			const supported = type === SpaceType.ROOM || type === SpaceType.ZONE;
			expect(wrapper.findComponent(SpaceActivityModesSection).exists()).toBe(supported);
			expect(wrapper.findComponent(SpaceModeScheduleSection).exists()).toBe(supported);
			expect(requests).toHaveLength(supported ? 9 : 0);
			const scheduleRequests = requests.filter((request) => new URL(request.url).pathname.endsWith('/schedules'));
			expect(scheduleRequests).toHaveLength(supported ? 1 : 0);
			if (supported) {
				expect(scheduleRequests[0]!.method).toBe('GET');
				expect(new URL(scheduleRequests[0]!.url).pathname).toBe(`/api/v1/modules/spaces/spaces/${space(type).id}/schedules`);
			}
			expect(requests.filter((request) => new URL(request.url).pathname.endsWith('/config'))).toHaveLength(supported ? 5 : 0);
			expect(
				requests.every(
					(request) =>
						request.method === 'GET' &&
						(new URL(request.url).pathname.endsWith('/config') ||
							new URL(request.url).pathname.endsWith('/schedules') ||
							new URL(request.url).pathname.includes('/occupancy'))
				)
			).toBe(true);
			expect(wrapper.findComponent({ name: 'SpaceDomainsSection' }).exists()).toBe(true);
			wrapper.unmount();
		}
	);
	it.each(['schedule', 'occupancy'])('guards keyed replacement and departure before discarding unsaved %s settings', async (target) => {
		const Selected = target === 'schedule' ? SpaceModeScheduleSection : SpaceOccupancySection;
		mocks.realRouter = true;
		const initial = space(SpaceType.ROOM).id;
		const router = createRouter({
			history: createMemoryHistory(),
			routes: [
				{
					path: '/space/:id/plugin',
					component: defineComponent({ template: '<router-view :key="$route.params.id" />' }),
					children: [
						{ path: 'configure', component: ViewSpaceConfigure, props: (route) => ({ space: { ...space(SpaceType.ROOM), id: route.params.id } }) },
					],
				},
				{ path: '/elsewhere', component: defineComponent({ template: '<p>Elsewhere</p>' }) },
			],
		});
		await router.push(`/space/${initial}/plugin/configure`);
		const wrapper = mount(defineComponent({ render: () => h(RouterView) }), {
			attachTo: document.body,
			global: { plugins: [router], stubs: { teleport: false } },
		});
		const confirm = vi.spyOn(ElMessageBox, 'confirm').mockRejectedValue('cancel');
		try {
			await flushPromises();
			const section = wrapper.getComponent(Selected);
			section.getComponent(ElSwitch).vm.$emit('update:modelValue', true);
			await flushPromises();
			await router.push('/space/other/plugin/configure');
			expect(router.currentRoute.value.params.id).toBe(initial);
			expect(wrapper.getComponent(Selected).vm.$.uid).toBe(section.vm.$.uid);
			expect(section.vm.hasUnsavedChanges).toBe(true);
			await router.push('/elsewhere');
			expect(router.currentRoute.value.params.id).toBe(initial);
			expect(confirm).toHaveBeenCalledTimes(2);
			confirm.mockResolvedValue('confirm' as Awaited<ReturnType<typeof ElMessageBox.confirm>>);
			await router.push('/space/other/plugin/configure');
			await flushPromises();
			expect(router.currentRoute.value.params.id).toBe('other');
			expect(wrapper.getComponent(Selected).vm.$.uid).not.toBe(section.vm.$.uid);
		} finally {
			wrapper.unmount();
			confirm.mockRestore();
			mocks.realRouter = false;
		}
	});
	it('retains the draft across same-space edit navigation and a desktop-to-mobile resize', async () => {
		mocks.realRouter = true;
		mocks.isLGDevice = true;
		const initial = space(SpaceType.ROOM).id;
		const router = createRouter({
			history: createMemoryHistory(),
			routes: [
				{
					path: '/space/:id/plugin',
					component: defineComponent({ template: '<router-view :key="$route.params.id" />' }),
					children: [
						{
							path: 'configure',
							component: ViewSpaceConfigure,
							props: (route) => ({ space: { ...space(SpaceType.ROOM), id: route.params.id } }),
							children: [
								{ path: 'edit', name: 'spaces_home_control_plugin-space_edit', component: defineComponent({ template: '<p>Edit space</p>' }) },
							],
						},
					],
				},
			],
		});
		await router.push(`/space/${initial}/plugin/configure`);
		const wrapper = mount(defineComponent({ render: () => h(RouterView) }), {
			attachTo: document.body,
			global: { plugins: [router], stubs: { teleport: false } },
		});
		const confirm = vi.spyOn(ElMessageBox, 'confirm').mockRejectedValue('cancel');
		try {
			await flushPromises();
			const section = wrapper.getComponent(SpaceModeScheduleSection);
			section.getComponent(ElSwitch).vm.$emit('update:modelValue', true);
			await flushPromises();
			await router.push(`/space/${initial}/plugin/configure/edit`);
			await flushPromises();
			mocks.lgDevice!.value = false;
			await flushPromises();
			expect(wrapper.getComponent(SpaceModeScheduleSection).vm.$.uid).toBe(section.vm.$.uid);
			expect(section.vm.hasUnsavedChanges).toBe(true);
			expect(section.get('.el-card').isVisible()).toBe(false);
			await router.push(`/space/${initial}/plugin/configure`);
			await flushPromises();
			expect(section.get('.el-card').isVisible()).toBe(true);
			expect(section.get('[data-testid="schedule-save"]').attributes('disabled')).toBeUndefined();
			await router.push(`/space/${initial}/plugin/configure/edit`);
			await flushPromises();
			expect(wrapper.getComponent(SpaceModeScheduleSection).vm.$.uid).toBe(section.vm.$.uid);
			expect(section.vm.hasUnsavedChanges).toBe(true);
			expect(confirm).not.toHaveBeenCalled();
		} finally {
			wrapper.unmount();
			confirm.mockRestore();
			mocks.realRouter = false;
			mocks.isLGDevice = false;
		}
	});
	it('waits for the original in-flight schedule save before completing navigation', async () => {
		mocks.realRouter = true;
		const initial = space(SpaceType.ROOM).id;
		const router = createRouter({
			history: createMemoryHistory(),
			routes: [
				{ path: '/space/:id/plugin/configure', component: ViewSpaceConfigure, props: { space: space(SpaceType.ROOM) } },
				{ path: '/elsewhere', component: defineComponent({ template: '<p>Elsewhere</p>' }) },
			],
		});
		await router.push(`/space/${initial}/plugin/configure`);
		const wrapper = mount(defineComponent({ render: () => h(RouterView) }), {
			attachTo: document.body,
			global: { plugins: [router], stubs: { teleport: false } },
		});
		const confirm = vi.spyOn(ElMessageBox, 'confirm').mockRejectedValue('cancel');
		let release!: () => void;
		mocks.saveGate = new Promise<void>((resolve) => {
			release = resolve;
		});
		try {
			await flushPromises();
			const section = wrapper.getComponent(SpaceModeScheduleSection);
			section.getComponent(ElSwitch).vm.$emit('update:modelValue', true);
			await flushPromises();
			await section.get('[data-testid="schedule-save"]').trigger('click');
			await flushPromises();
			expect(requests.filter((request) => request.method === 'PUT')).toHaveLength(1);
			let navigated = false;
			const navigation = router.push('/elsewhere').then(() => {
				navigated = true;
			});
			await flushPromises();
			expect(navigated).toBe(false);
			expect(confirm).not.toHaveBeenCalled();
			release();
			await flushPromises();
			await navigation;
			expect(router.currentRoute.value.path).toBe('/elsewhere');
			expect(confirm).not.toHaveBeenCalled();
		} finally {
			release();
			wrapper.unmount();
			confirm.mockRestore();
			mocks.realRouter = false;
			mocks.saveGate = null;
		}
	});
	it.each(['PUT', 'conflict reload'])('aborts a stalled %s within 30 seconds and preserves the discard choice during navigation', async (phase) => {
		mocks.realRouter = true;
		const initial = space(SpaceType.ROOM).id;
		const router = createRouter({
			history: createMemoryHistory(),
			routes: [
				{ path: '/space/:id/plugin/configure', component: ViewSpaceConfigure, props: { space: space(SpaceType.ROOM) } },
				{ path: '/elsewhere', component: defineComponent({ template: '<p>Elsewhere</p>' }) },
			],
		});
		await router.push(`/space/${initial}/plugin/configure`);
		const wrapper = mount(defineComponent({ render: () => h(RouterView) }), {
			attachTo: document.body,
			global: { plugins: [router], stubs: { teleport: false } },
		});
		const confirm = vi.spyOn(ElMessageBox, 'confirm').mockRejectedValue('cancel');
		let release!: () => void;
		mocks.saveGate = new Promise<void>((resolve) => {
			release = resolve;
		});
		try {
			await flushPromises();
			const section = wrapper.getComponent(SpaceModeScheduleSection);
			section.getComponent(ElSwitch).vm.$emit('update:modelValue', true);
			await flushPromises();
			vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
			mocks.saveConflict = phase === 'conflict reload';
			await section.get('[data-testid="schedule-save"]').trigger('click');
			await flushPromises();
			const request = phase === 'PUT' ? requests.find((request) => request.method === 'PUT')! : requests.at(-1)!;
			expect(request.method).toBe(phase === 'PUT' ? 'PUT' : 'GET');
			let settled = false;
			const navigation = router.push('/elsewhere').then(() => {
				settled = true;
			});
			await vi.advanceTimersByTimeAsync(29_999);
			expect(request.signal.aborted).toBe(false);
			expect(settled).toBe(false);
			expect(confirm).not.toHaveBeenCalled();
			await vi.advanceTimersByTimeAsync(1);
			await flushPromises();
			await navigation;
			expect(request.signal.aborted).toBe(true);
			expect(settled).toBe(true);
			expect(router.currentRoute.value.params.id).toBe(initial);
			expect(section.vm.hasUnsavedChanges).toBe(true);
			expect(section.text()).toContain(`spacesHomeControlPlugin.schedules.${phase === 'PUT' ? 'saveUnconfirmed' : 'loadFailed'}`);
			expect(confirm).toHaveBeenCalledTimes(1);
			confirm.mockResolvedValue('confirm' as Awaited<ReturnType<typeof ElMessageBox.confirm>>);
			await router.push('/elsewhere');
			expect(router.currentRoute.value.path).toBe('/elsewhere');
			expect(requests.filter((request) => request.method === 'PUT')).toHaveLength(1);
		} finally {
			release();
			wrapper.unmount();
			vi.useRealTimers();
			confirm.mockRestore();
			mocks.realRouter = false;
			mocks.saveGate = null;
		}
	});
	it('unmounts activity controls when a reactive space becomes unsupported and remounts for a zone', async () => {
		const wrapper = render(SpaceType.ROOM);
		await flushPromises();
		expect(requests).toHaveLength(9);
		const original = wrapper.getComponent(SpaceActivityModesSection).vm;
		await wrapper.setProps({ space: space(SpaceType.MASTER) });
		await flushPromises();
		expect(wrapper.findComponent(SpaceActivityModesSection).exists()).toBe(false);
		expect(requests).toHaveLength(9);
		expect(wrapper.findComponent({ name: 'SpaceDomainsSection' }).exists()).toBe(true);
		await wrapper.setProps({ space: space(SpaceType.ZONE) });
		await flushPromises();
		expect(wrapper.getComponent(SpaceActivityModesSection).vm).not.toBe(original);
		expect(requests).toHaveLength(18);
		expect(wrapper.findComponent({ name: 'SpaceDomainsSection' }).exists()).toBe(true);
		wrapper.unmount();
	});
});
