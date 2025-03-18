import { useRouter } from 'vue-router';

import { type Mock, describe, expect, it, vi } from 'vitest';

import { useMenu } from './useMenu';

vi.mock('vue-router', () => ({
	useRouter: vi.fn(),
}));

vi.mock('../services', () => ({
	injectStoresManager: vi.fn(() => ({
		getStore: vi.fn(() => ({})),
	})),
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

		expect(mainMenuItems.Dashboard.children).toHaveProperty('Analytics');
		expect(mainMenuItems.Dashboard.children).toHaveProperty('Reports');
		expect(mainMenuItems.Settings.children).toHaveProperty('Profile');
		expect(mainMenuItems.Settings.children).toHaveProperty('Security');
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
		expect(mainMenuItems.Parent.children).not.toHaveProperty('Child');
	});
});
