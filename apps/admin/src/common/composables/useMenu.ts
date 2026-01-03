import { type RouteRecordRaw, useRouter } from 'vue-router';

import type { IAppUser } from '../../app.types';
import { injectAccountManager } from '../services/account-manager';
import type { RouterGuards } from '../services/router-guards';
import { injectRouterGuard } from '../services/router-guards';

declare type RouteRecord = Omit<RouteRecordRaw, 'children'> & {
	children: { [key: string]: RouteRecord };
};

type MenuMeta = boolean | number | undefined;

const getRouteName = (record: RouteRecordRaw): string => {
	if (typeof record.name === 'string') {
		return record.name;
	} else if (typeof record.name === 'symbol') {
		return record.name.toString();
	}

	return record.path;
};

const isInMenu = (menu: MenuMeta): boolean => {
	if (menu === false || menu === undefined) {
		return false;
	}

	return typeof menu === 'number' || menu === true;
};

const menuWeight = (menu: MenuMeta): number => {
	if (typeof menu === 'number') {
		return menu;
	}

	if (menu === true) {
		return Number.POSITIVE_INFINITY;
	}

	return Number.NEGATIVE_INFINITY;
};

const buildRouteTree = (appUser: IAppUser | undefined, routerGuard: RouterGuards, routes: RouteRecordRaw[]): { [key: string]: RouteRecord } => {
	const routeMap: { [key: string]: RouteRecord } = {};

	for (const route of routes) {
		const menu = route.meta?.menu as MenuMeta;

		if (!isInMenu(menu)) {
			continue;
		}

		if (routerGuard.handle(appUser, route) !== true) {
			continue;
		}

		const name = getRouteName(route);

		routeMap[name] = { ...route, children: {} } as RouteRecord;

		if (Array.isArray(route.children) && route.children.length) {
			const filteredChildren = buildRouteTree(appUser, routerGuard, route.children);

			if (Object.keys(filteredChildren).length) {
				routeMap[name].children = filteredChildren;
			}
		}
	}

	return routeMap;
};

const filterRouteTree = (routes: { [key: string]: RouteRecord }): { [key: string]: RouteRecord } => {
	const routeMap: { [key: string]: RouteRecord } = {};

	mainLoop: for (const search of Object.keys(routes)) {
		for (const name of Object.keys(routes)) {
			const routeChildren = routes[name]?.children;
			if (name !== search && routeChildren && findRoute(search, routeChildren)) {
				continue mainLoop;
			}
		}

		const route = routes[search];
		if (route) {
			routeMap[search] = route;
		}
	}

	return routeMap;
};

const findRoute = (search: string, routes: { [key: string]: RouteRecord }): boolean => {
	for (const route of Object.keys(routes)) {
		if (route === search) {
			return true;
		}

		const children = routes[route]?.children;
		if (children) {
			if (findRoute(search, children)) {
				return true;
			}
		}
	}

	return false;
};

const sortRouteTree = (routes: { [key: string]: RouteRecord }): { [key: string]: RouteRecord } => {
	const withSortedChildren = Object.entries(routes).map(([key, route]) => {
		const sortedChildren = sortRouteTree(route.children ?? {});

		return [key, { ...route, children: sortedChildren } as RouteRecord] as const;
	});

	withSortedChildren.sort((a, b) => {
		const wa = menuWeight(a[1].meta?.menu as MenuMeta);
		const wb = menuWeight(b[1].meta?.menu as MenuMeta);

		return wb - wa;
	});

	return Object.fromEntries(withSortedChildren);
};

export const useMenu = (): {
	mainMenuItems: { [key: string]: RouteRecord };
} => {
	const router = useRouter();
	const routerGuard = injectRouterGuard();
	const accountManager = injectAccountManager();

	const built = buildRouteTree(accountManager?.details.value ?? undefined, routerGuard, router.getRoutes());

	const rootsOnly = filterRouteTree(built);
	const routesTree = sortRouteTree(rootsOnly);

	return {
		mainMenuItems: routesTree,
	};
};
