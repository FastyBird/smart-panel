import { useRouter } from 'vue-router';

import { type Mock, describe, expect, it, vi } from 'vitest';

import { MENU_GROUPS, type RouteRecord, groupMenuItems, useMenu } from './useMenu';

vi.mock('vue-router', async () => {
	const actual = await vi.importActual('vue-router');

	return {
		...actual,
		useRouter: vi.fn(),
	};
});

vi.mock('../services/store', () => ({
	injectStoresManager: vi.fn(() => ({
		getStore: vi.fn(() => ({})),
	})),
}));
vi.mock('../services/router-guards', () => ({
	injectRouterGuard: vi.fn(() => ({
		handle: vi.fn(() => ({})).mockReturnValue(true),
	})),
}));

describe('useMenu', () => {
	it('should return the filtered route tree', () => {
		const mockRoutes = [
			{
				path: '/dashboard',
				name: 'Dashboard',
				meta: {
					title: 'Dashboard',
					icon: 'icon-name',
					menu: true,
				},
				children: [
					{
						path: 'analytics',
						name: 'Analytics',
						meta: {
							title: 'Analytics',
							icon: 'icon-name',
							menu: true,
						},
					},
					{
						path: 'reports',
						name: 'Reports',
						meta: {
							title: 'Reports',
							icon: 'icon-name',
							menu: true,
						},
					},
				],
			},
			{
				path: '/settings',
				name: 'Settings',
				meta: {
					title: 'Settings',
					icon: 'icon-name',
					menu: true,
				},
				children: [
					{
						path: 'profile',
						name: 'Profile',
						meta: {
							title: 'Profile',
							icon: 'icon-name',
							menu: true,
						},
					},
					{
						path: 'security',
						name: 'Security',
						meta: {
							title: 'Security',
							icon: 'icon-name',
							menu: true,
						},
					},
				],
			},
			{
				path: '/logout',
				name: 'Logout',
				meta: {
					title: 'Logout',
					icon: 'icon-name',
					menu: true,
				},
			},
		];

		// Mock router.getRoutes to return mockRoutes
		(useRouter as Mock).mockReturnValue({
			getRoutes: () => mockRoutes,
		});

		const { mainMenuItems } = useMenu();

		expect(mainMenuItems).toBeDefined();
		expect(Object.keys(mainMenuItems)).toContain('Dashboard');
		expect(Object.keys(mainMenuItems)).toContain('Settings');
		expect(Object.keys(mainMenuItems)).toContain('Logout');

		expect(mainMenuItems.Dashboard?.children).toHaveProperty('Analytics');
		expect(mainMenuItems.Dashboard?.children).toHaveProperty('Reports');
		expect(mainMenuItems.Settings?.children).toHaveProperty('Profile');
		expect(mainMenuItems.Settings?.children).toHaveProperty('Security');
	});

	it('should correctly filter out nested routes', () => {
		const mockRoutes = [
			{
				path: '/parent',
				name: 'Parent',
				meta: {
					title: 'Parent',
					icon: 'icon-name',
					menu: true,
				},
				children: [{ path: 'child', name: 'Child' }],
			},
		];

		(useRouter as Mock).mockReturnValue({
			getRoutes: () => mockRoutes,
		});

		const { mainMenuItems } = useMenu();

		expect(mainMenuItems).toBeDefined();
		expect(mainMenuItems).toHaveProperty('Parent');
		expect(mainMenuItems.Parent?.children).not.toHaveProperty('Child');
	});
});

describe('groupMenuItems', () => {
	const item = (name: string, menuGroup?: string): RouteRecord =>
		({ name, path: `/${name}`, meta: { menuGroup }, children: {} }) as unknown as RouteRecord;

	it('puts ungrouped items first, then the groups in the sidebar order', () => {
		const sections = groupMenuItems({
			users: item('users', 'system'),
			overview: item('overview'),
			pages: item('pages', 'wall-displays'),
			devices: item('devices', 'home'),
			extensions: item('extensions', 'integrations'),
			buddy: item('buddy'),
			spaces: item('spaces', 'home'),
		});

		expect(sections.map((section) => section.group)).toEqual([null, 'home', 'wall-displays', 'integrations', 'system']);
		expect(sections.map((section) => section.items.map((entry) => entry.name))).toEqual([
			['overview', 'buddy'],
			['devices', 'spaces'],
			['pages'],
			['extensions'],
			['users'],
		]);
	});

	it('leaves out empty groups and treats an unknown group as ungrouped', () => {
		const sections = groupMenuItems({ devices: item('devices', 'home'), extra: item('extra', 'cameras-and-more') });

		expect(sections.map((section) => section.group)).toEqual([null, 'home']);
		expect(sections[0].items.map((entry) => entry.name)).toEqual(['extra']);
	});

	it('defines the four sidebar groups of the spec', () => {
		expect(MENU_GROUPS).toEqual(['home', 'wall-displays', 'integrations', 'system']);
	});
});
