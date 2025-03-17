import type { RouteLocationRaw } from 'vue-router';

export interface IAppBreadcrumbsProps {
	items: { label: string; route: RouteLocationRaw }[];
}
