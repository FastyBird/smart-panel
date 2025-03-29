import type { RouteRecordRaw } from 'vue-router';

import { UsersUserRole } from '../../../openapi';
import { RouteNames } from '../devices.constants';

export const ModuleRoutes: RouteRecordRaw[] = [
	{
		path: 'devices',
		name: RouteNames.DEVICES,
		component: () => import('../views/view-devices.vue'),
		props: true,
		meta: {
			guards: {
				authenticated: true,
				roles: [UsersUserRole.admin, UsersUserRole.owner],
			},
			title: 'Devices',
			icon: 'mdi:power-plug',
			menu: true,
		},
		children: [
			{
				path: 'add',
				name: RouteNames.DEVICES_ADD,
				component: () => import('../views/view-device-add.vue'),
				props: true,
				meta: {
					guards: {
						authenticated: true,
						roles: [UsersUserRole.admin, UsersUserRole.owner],
					},
					title: 'Add new device',
					icon: 'mdi:add-circle',
				},
			},
			{
				path: ':id',
				name: RouteNames.DEVICES_EDIT,
				component: () => import('../views/view-device-edit.vue'),
				props: true,
				meta: {
					guards: {
						authenticated: true,
						roles: [UsersUserRole.admin, UsersUserRole.owner],
					},
					title: 'Edit device',
					icon: 'mdi:pencil-circle',
				},
			},
		],
	},
	{
		path: 'device/:id',
		name: RouteNames.DEVICE,
		component: () => import('../views/view-device.vue'),
		props: true,
		meta: {
			guards: {
				authenticated: true,
				roles: [UsersUserRole.admin, UsersUserRole.owner],
			},
			title: 'Device detail',
			icon: 'mdi:power-plug',
		},
		children: [
			{
				path: 'edit',
				name: RouteNames.DEVICE_EDIT,
				component: () => import('../views/view-device-edit.vue'),
				props: true,
				meta: {
					guards: {
						authenticated: true,
						roles: [UsersUserRole.admin, UsersUserRole.owner],
					},
					title: 'Edit device',
					icon: 'mdi:pencil-circle',
				},
			},
			{
				path: 'channel/add',
				name: RouteNames.DEVICE_ADD_CHANEL,
				component: () => import('../views/view-channel-add.vue'),
				props: false,
				meta: {
					guards: {
						authenticated: true,
						roles: [UsersUserRole.admin, UsersUserRole.owner],
					},
					title: 'Add new channel',
					icon: 'mdi:plus-circle',
				},
			},
			{
				path: 'channel/:channelId',
				name: RouteNames.DEVICE_EDIT_CHANEL,
				component: () => import('../views/view-channel-edit.vue'),
				props: (route) => ({ id: route.params.channelId }),
				meta: {
					guards: {
						authenticated: true,
						roles: [UsersUserRole.admin, UsersUserRole.owner],
					},
					title: 'Edit channel',
					icon: 'mdi:pencil-circle',
				},
			},
			{
				path: 'channel/:channelId/property/add',
				name: RouteNames.DEVICE_CHANEL_ADD_PROPERTY,
				component: () => import('../views/view-channel-property-add.vue'),
				props: (route) => ({ channelId: route.params.channelId }),
				meta: {
					guards: {
						authenticated: true,
						roles: [UsersUserRole.admin, UsersUserRole.owner],
					},
					title: 'Add new channel property',
					icon: 'mdi:plus-circle',
				},
			},
			{
				path: 'channel/:channelId/property/:propertyId',
				name: RouteNames.DEVICE_CHANEL_EDIT_PROPERTY,
				component: () => import('../views/view-channel-property-edit.vue'),
				props: (route) => ({ id: route.params.propertyId, channelId: route.params.channelId }),
				meta: {
					guards: {
						authenticated: true,
						roles: [UsersUserRole.admin, UsersUserRole.owner],
					},
					title: 'Edit channel property',
					icon: 'mdi:pencil-circle',
				},
			},
		],
	},
	{
		path: 'channels',
		name: RouteNames.CHANNELS,
		component: () => import('../views/view-channels.vue'),
		props: true,
		meta: {
			guards: {
				authenticated: true,
				roles: [UsersUserRole.admin, UsersUserRole.owner],
			},
			title: 'Channels',
			icon: 'mdi:chip',
			menu: true,
		},
		children: [
			{
				path: 'add',
				name: RouteNames.CHANNELS_ADD,
				component: () => import('../views/view-channel-add.vue'),
				props: false,
				meta: {
					guards: {
						authenticated: true,
						roles: [UsersUserRole.admin, UsersUserRole.owner],
					},
					title: 'Add new channel',
					icon: 'mdi:add-circle',
				},
			},
			{
				path: ':id',
				name: RouteNames.CHANNELS_EDIT,
				component: () => import('../views/view-channel-edit.vue'),
				props: true,
				meta: {
					guards: {
						authenticated: true,
						roles: [UsersUserRole.admin, UsersUserRole.owner],
					},
					title: 'Edit channel',
					icon: 'mdi:pencil-circle',
				},
			},
		],
	},
	{
		path: 'channel/:id',
		name: RouteNames.CHANNEL,
		component: () => import('../views/view-channel.vue'),
		props: true,
		meta: {
			guards: {
				authenticated: true,
				roles: [UsersUserRole.admin, UsersUserRole.owner],
			},
			title: 'Channel detail',
			icon: 'mdi:chip',
		},
		children: [
			{
				path: 'edit',
				name: RouteNames.CHANNEL_EDIT,
				component: () => import('../views/view-channel-edit.vue'),
				props: true,
				meta: {
					guards: {
						authenticated: true,
						roles: [UsersUserRole.admin, UsersUserRole.owner],
					},
					title: 'Edit channel',
					icon: 'mdi:pencil-circle',
				},
			},
			{
				path: 'property/add',
				name: RouteNames.CHANNEL_ADD_PROPERTY,
				component: () => import('../views/view-channel-property-add.vue'),
				props: (route) => ({ channelId: route.params.id }),
				meta: {
					guards: {
						authenticated: true,
						roles: [UsersUserRole.admin, UsersUserRole.owner],
					},
					title: 'Add new channel property',
					icon: 'mdi:plus-circle',
				},
			},
			{
				path: 'property/:propertyId',
				name: RouteNames.CHANNEL_EDIT_PROPERTY,
				component: () => import('../views/view-channel-property-edit.vue'),
				props: (route) => ({ id: route.params.propertyId, channelId: route.params.id }),
				meta: {
					guards: {
						authenticated: true,
						roles: [UsersUserRole.admin, UsersUserRole.owner],
					},
					title: 'Edit channel property',
					icon: 'mdi:pencil-circle',
				},
			},
		],
	},
];
