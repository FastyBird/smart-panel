import type { RouteLocationRaw } from 'vue-router';

export interface IBreadcrumb {
	label: string;
	route?: RouteLocationRaw;
}

export interface IAppBreadcrumbsProps {
	items: IBreadcrumb[];
}
