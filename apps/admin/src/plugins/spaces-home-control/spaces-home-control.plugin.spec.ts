import type { App } from 'vue';

import { get } from 'lodash';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IPluginOptions } from '../../app.types';
import { RouteNames as SpacesRouteNames } from '../../modules/spaces';

import SpacesHomeControlPlugin from './spaces-home-control.plugin';

const mocks = vi.hoisted(() => ({
	addPlugin: vi.fn(),
}));

vi.mock('../../common', () => ({
	injectPluginsManager: () => ({
		addPlugin: mocks.addPlugin,
	}),
}));

vi.mock('../../modules/spaces', () => ({
	RouteNames: {
		SPACE_PLUGIN: 'space-plugin',
	},
	SpaceType: {
		ROOM: 'room',
		ZONE: 'zone',
	},
	SPACES_MODULE_NAME: 'spaces-module',
	SpaceAddFormSchema: {},
	SpaceEditFormSchema: {},
}));

vi.mock('../../modules/spaces/store/spaces.store.schemas', () => ({
	SpaceCreateSchema: {},
	SpaceEditSchema: {},
	SpaceSchema: {},
}));

vi.mock('./components/components', async () => {
	const { defineComponent } = await import('vue');

	const StubComponent = defineComponent({
		template: '<div />',
	});

	return {
		SpaceAddForm: StubComponent,
		SpaceDetail: StubComponent,
		SpaceEditForm: StubComponent,
		SpacesWizard: StubComponent,
	};
});

vi.mock('./automations/space-automations.elements', () => ({
	SPACE_AUTOMATION_NODE_ELEMENTS: [
		{ type: 'space.mode.set', components: { automationNodeForm: {}, automationNodeCard: {} }, schemas: {}, modules: ['automations-module'] },
	],
}));

const createOptions = (routes: Array<{ name: string }>) =>
	({
		i18n: {
			global: {
				getLocaleMessage: vi.fn(() => ({})),
				setLocaleMessage: vi.fn(),
			},
		},
		router: {
			getRoutes: vi.fn(() => routes),
			addRoute: vi.fn(),
			resolve: vi.fn((route) => route),
		},
	}) as unknown as IPluginOptions;

describe('spacesHomeControlPlugin', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('does not register configure child routes when the spaces plugin parent route is missing', () => {
		const options = createOptions([{ name: 'root' }]);

		SpacesHomeControlPlugin.install({} as App, options);

		expect(options.router.addRoute).not.toHaveBeenCalled();
		expect(mocks.addPlugin).toHaveBeenCalledWith(
			expect.any(Symbol),
			expect.not.objectContaining({
				routes: expect.any(Object),
			})
		);
	});

	it('registers configure child routes under the spaces plugin parent route', () => {
		const options = createOptions([{ name: SpacesRouteNames.SPACE_PLUGIN }]);

		SpacesHomeControlPlugin.install({} as App, options);

		expect(options.router.addRoute).toHaveBeenCalled();
		expect(options.router.addRoute).toHaveBeenCalledWith(SpacesRouteNames.SPACE_PLUGIN, expect.any(Object));
		expect(mocks.addPlugin).toHaveBeenCalledWith(
			expect.any(Symbol),
			expect.objectContaining({
				routes: {
					configure: expect.any(Function),
				},
			})
		);
	});

	it('registers the home-control setup wizard component for each space type', () => {
		const options = createOptions([{ name: SpacesRouteNames.SPACE_PLUGIN }]);

		SpacesHomeControlPlugin.install({} as App, options);

		expect(mocks.addPlugin).toHaveBeenCalledWith(
			expect.any(Symbol),
			expect.objectContaining({
				elements: expect.arrayContaining([
					expect.objectContaining({
						components: expect.objectContaining({
							spaceWizard: expect.any(Object),
						}),
					}),
				]),
			})
		);
	});

	it('registers the forms of its automation cards with the automations editor', () => {
		const options = createOptions([{ name: SpacesRouteNames.SPACE_PLUGIN }]);

		SpacesHomeControlPlugin.install({} as App, options);

		expect(mocks.addPlugin).toHaveBeenCalledWith(
			expect.any(Symbol),
			expect.objectContaining({
				modules: expect.arrayContaining(['spaces-module', 'automations-module']),
				elements: expect.arrayContaining([
					expect.objectContaining({
						type: 'space.mode.set',
						modules: ['automations-module'],
						components: expect.objectContaining({ automationNodeForm: expect.any(Object), automationNodeCard: expect.any(Object) }),
					}),
				]),
			})
		);
	});

	it('puts the names of its automation cards where the automations editor looks them up', () => {
		const options = createOptions([{ name: SpacesRouteNames.SPACE_PLUGIN }]);

		SpacesHomeControlPlugin.install({} as App, options);

		const calls = vi.mocked(options.i18n.global.setLocaleMessage).mock.calls as unknown as [string, Record<string, unknown>][];
		const english = calls.find(([locale]) => locale === 'en-US')?.[1];

		expect(get(english, 'automations.editor.nodeTypes.space.mode.set.name')).toBe('Set space mode');
		expect(get(english, 'spacesHomeControlPlugin.automations.fields.space.title')).toBe('Room or zone');
	});
});
