/* eslint-disable vue/one-component-per-file */
import { nextTick } from 'vue';

import createClient from 'openapi-fetch';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount, shallowMount } from '@vue/test-utils';

import { SpaceType } from '../../../modules/spaces/spaces.constants';
import type { paths } from '../../../openapi';
import SpaceActivityModesSection from '../components/space-activity-modes-section.vue';

import ViewSpaceConfigure from './view-space-configure.vue';

const mocks = vi.hoisted(() => ({
	client: null as unknown,
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

vi.mock('vue-router', () => ({
	useRoute: () => ({
		matched: mocks.routeMatched,
		path: '/space/7a1bafdc-8c7d-4d5a-9e2a-4dfdc3c8253d/plugin/spaces-home-control/configure',
	}),
	useRouter: () => ({
		push: mocks.routerPush,
		replace: mocks.routerReplace,
	}),
}));

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
			isLGDevice: ref(mocks.isLGDevice),
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
	beforeEach(() => {
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
			expect(requests).toHaveLength(supported ? 5 : 0);
			expect(requests.every((request) => request.method === 'GET' && new URL(request.url).pathname.endsWith('/config'))).toBe(true);
			expect(wrapper.findComponent({ name: 'SpaceDomainsSection' }).exists()).toBe(true);
			wrapper.unmount();
		}
	);
	it('unmounts activity controls when a reactive space becomes unsupported and remounts for a zone', async () => {
		const wrapper = render(SpaceType.ROOM);
		await flushPromises();
		expect(requests).toHaveLength(5);
		const original = wrapper.getComponent(SpaceActivityModesSection).vm;
		await wrapper.setProps({ space: space(SpaceType.MASTER) });
		await flushPromises();
		expect(wrapper.findComponent(SpaceActivityModesSection).exists()).toBe(false);
		expect(requests).toHaveLength(5);
		expect(wrapper.findComponent({ name: 'SpaceDomainsSection' }).exists()).toBe(true);
		await wrapper.setProps({ space: space(SpaceType.ZONE) });
		await flushPromises();
		expect(wrapper.getComponent(SpaceActivityModesSection).vm).not.toBe(original);
		expect(requests).toHaveLength(10);
		expect(wrapper.findComponent({ name: 'SpaceDomainsSection' }).exists()).toBe(true);
		wrapper.unmount();
	});
});
