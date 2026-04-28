import type { App } from 'vue';

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
	};
});

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
	});

	it('registers configure child routes under the spaces plugin parent route', () => {
		const options = createOptions([{ name: SpacesRouteNames.SPACE_PLUGIN }]);

		SpacesHomeControlPlugin.install({} as App, options);

		expect(options.router.addRoute).toHaveBeenCalled();
		expect(options.router.addRoute).toHaveBeenCalledWith(SpacesRouteNames.SPACE_PLUGIN, expect.any(Object));
	});
});
