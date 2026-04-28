import { describe, expect, it, vi } from 'vitest';

import { RouteNames } from '../spaces-home-control.constants';

import { PluginRoutes } from './index';

vi.mock('../../../modules/spaces', () => ({
	SpaceType: {
		ROOM: 'room',
		ZONE: 'zone',
	},
}));

describe('spaces home-control plugin routes', () => {
	it('registers space edit as a child of the configure route', () => {
		const configureRoute = PluginRoutes.find((route) => route.name === RouteNames.SPACE);

		expect(configureRoute?.children?.some((route) => route.name === RouteNames.SPACE_EDIT)).toBe(true);
	});
});
