import { describe, expect, it, vi } from 'vitest';

import { RouteNames } from '../spaces.constants';

import { ModuleRoutes } from './index';

vi.mock('../../../locales', () => ({
	default: {
		global: {
			t: (key: string) => key,
		},
	},
}));

vi.mock('../spaces.constants', () => ({
	RouteNames: {
		SPACES: 'spaces',
		SPACES_ADD: 'spaces-add',
		SPACES_EDIT: 'spaces-edit',
		SPACE: 'space',
		SPACE_EDIT: 'space-edit',
		SPACE_PLUGIN: 'space-plugin',
		SPACES_ONBOARDING: 'spaces-onboarding',
	},
}));

describe('spaces module routes', () => {
	it('does not register the core space detail route', () => {
		expect(ModuleRoutes.some((route) => route.name === RouteNames.SPACE)).toBe(false);
	});

	it('keeps the plugin detail host route for space plugin configuration', () => {
		expect(ModuleRoutes.some((route) => route.name === RouteNames.SPACE_PLUGIN)).toBe(true);
	});

	it('requires a plugin type for the spaces wizard route', () => {
		const spacesRoute = ModuleRoutes.find((route) => route.name === RouteNames.SPACES);
		const onboardingRoute = spacesRoute?.children?.find((route) => route.name === RouteNames.SPACES_ONBOARDING);

		expect(onboardingRoute?.path).toBe('wizard/:type');
		expect(onboardingRoute?.props).toBe(true);
	});
});
