import type { RouteRecordRaw } from 'vue-router';

import i18n from '../../../locales';
import { RouteNames } from '../spaces.constants';

export const ModuleRoutes: RouteRecordRaw[] = [
	{
		path: 'spaces',
		name: RouteNames.SPACES,
		component: () => import('../views/view-spaces.vue'),
		meta: {
			guards: { authenticated: true },
			title: () => i18n.global.t('spacesModule.menu.title'),
			icon: 'mdi:home-group',
			menu: 9000,
		},
		children: [
			{
				path: 'add',
				name: RouteNames.SPACES_ADD,
				component: () => import('../views/view-space-add.vue'),
				meta: {
					guards: { authenticated: true },
					title: 'Add space',
				},
			},
			{
				path: ':id',
				name: RouteNames.SPACES_EDIT,
				component: () => import('../views/view-space-edit.vue'),
				props: true,
				meta: {
					guards: { authenticated: true },
					title: 'Edit space',
				},
			},
			{
				path: 'wizard/:type',
				name: RouteNames.SPACES_WIZARD,
				component: () => import('../views/view-spaces-wizard.vue'),
				props: true,
				meta: {
					guards: { authenticated: true },
					title: 'Spaces Wizard',
				},
			},
		],
	},
	{
		path: 'space/:id/plugin',
		name: RouteNames.SPACE_PLUGIN,
		component: () => import('../views/view-space-plugin.vue'),
		props: true,
		meta: {
			guards: { authenticated: true },
			title: 'Space plugin',
			icon: 'mdi:home-group',
		},
	},
];
