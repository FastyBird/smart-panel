import { type ComputedRef, type InjectionKey, computed, inject, provide, shallowRef } from 'vue';

import type { AppBarAction, AppBarLeft, AppBarPrimary } from '../components/app-bar.types';

/** What one `view-header` hands to the app bar */
export interface IAppBarHeading {
	title: string;
	subtitle?: string;
	/** Phone only; `null` inside a drawer, whose bar has its own Close */
	left: AppBarLeft | null;
	onLeft?: () => void;
	leftDisabled?: boolean;
	actions: AppBarAction[];
	primary?: AppBarPrimary;
}

export interface IAppBarHost {
	/** While true, view headers below this host draw into its app bar instead of rendering the page header */
	active: ComputedRef<boolean>;
	/** The most recently mounted heading: a child route's header covers its parent's, as the teleports used to */
	heading: ComputedRef<IAppBarHeading | null>;
	register: (heading: () => IAppBarHeading) => () => void;
}

export const APP_BAR_HOST: InjectionKey<IAppBarHost> = Symbol('fb-app-bar-host');

export const createAppBarHost = (active: () => boolean): IAppBarHost => {
	const stack = shallowRef<{ id: number; heading: () => IAppBarHeading }[]>([]);

	let nextId = 0;

	return {
		active: computed<boolean>(active),
		heading: computed<IAppBarHeading | null>(() => {
			const top = stack.value.at(-1);

			return top ? top.heading() : null;
		}),
		register: (heading) => {
			const id = nextId++;

			stack.value = [...stack.value, { id, heading }];

			return (): void => {
				stack.value = stack.value.filter((entry) => entry.id !== id);
			};
		},
	};
};

/** The layout provides one host for the phone app bar; every drawer that shows a routed view provides its own */
export const provideAppBarHost = (active: () => boolean): IAppBarHost => {
	const host = createAppBarHost(active);

	provide(APP_BAR_HOST, host);

	return host;
};

export const useAppBarHost = (): IAppBarHost | null => inject(APP_BAR_HOST, null);
