import type { RouteLocationRaw } from 'vue-router';

import type { AppBarAction, AppBarLeft, AppBarPrimary } from './app-bar.types';

export type ViewHeaderProps = {
	title: string;
	subtitle?: string;
	icon?: string;
	/** Where the back arrow leads. On phone it is the app bar's left button */
	back?: RouteLocationRaw;
	/** Handles back or close instead of navigating to `back`, for screens that confirm unsaved changes first */
	onBack?: () => void;
	/** The phone app bar's left button. Defaults to back when there is somewhere to go back to, otherwise the menu */
	left?: AppBarLeft;
	/** Phone app bar: up to two icon buttons */
	actions?: AppBarAction[];
	/** Phone app bar: one text button in place of the actions, such as Save */
	primary?: AppBarPrimary;
};
