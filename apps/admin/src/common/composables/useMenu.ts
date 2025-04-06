import { type RouteRecordRaw, useRouter } from 'vue-router';

import type { IAppUser } from '../../app.types';
import { injectAccountManager } from '../services/account-manager';
import type { RouterGuards } from '../services/router-guards';
import { injectRouterGuard } from '../services/router-guards';

declare type RouteRecord = Omit<RouteRecordRaw, 'children'> & {
	children: { [key: string]: RouteRecord };
};

const getRouteName = (record: RouteRecordRaw): string => {
	if (typeof record.name === 'string') {
		return record.name;
	} else if (typeof record.name === 'symbol') {
		return record.name.toString();
	}

	return record.path;
};

const buildRouteTree = (appUser: IAppUser | undefined, routerGuard: RouterGuards, routes: RouteRecordRaw[]): { [key: string]: RouteRecord } => {
	const routeMap: { [key: string]: RouteRecord } = {};

	for (const route of routes) {
		// Filter out routes that do not have meta.menu: true
		if (!route.meta?.menu) continue;

		if (routerGuard.handle(appUser, route) !== true) continue;

		routeMap[getRouteName(route)] = { ...route, children: {} };

		if (route.children && Array.isArray(route.children)) {
			const filteredChildren = buildRouteTree(appUser, routerGuard, route.children);

			// Only add children if there are valid routes
			if (Object.keys(filteredChildren).length) {
				routeMap[getRouteName(route)].children = filteredChildren;
			}
		}
	}

	return routeMap;
};

const filterRouteTree = (routes: { [key: string]: RouteRecord }): { [key: string]: RouteRecord } => {
	const routeMap: { [key: string]: RouteRecord } = {};

	mainLoop: for (const search of Object.keys(routes)) {
		for (const name of Object.keys(routes)) {
			if (name !== search && routes[name].children && findRoute(search, routes[name].children)) {
				continue mainLoop;
			}
		}

		routeMap[search] = routes[search];
	}

	return routeMap;
};

const findRoute = (search: string, routes: { [key: string]: RouteRecord }): boolean => {
	for (const route of Object.keys(routes)) {
		if (route === search) {
			return true;
		}

		if (routes[route].children) {
			if (findRoute(search, routes[route].children)) {
				return true;
			}
		}
	}

	return false;
};

export const useMenu = (): {
	mainMenuItems: { [key: string]: RouteRecord };
} => {
	const router = useRouter();

	const routerGuard = injectRouterGuard();

	const accountManager = injectAccountManager();

	// Build route tree and filter based on `meta.menu: true`
	const routesTree = filterRouteTree(buildRouteTree(accountManager?.details.value ?? undefined, routerGuard, router.getRoutes()));

	return {
		mainMenuItems: routesTree,
	};
};
