export const BREADCRUMBS_TARGET = 'app-breadcrumbs';

/** What the menu button does: collapse the desktop sidebar, or open the menu drawer on tablets */
export type AppTopBarMenuButton = 'collapse' | 'expand' | 'open';

export type AppTopBarProps = {
	menuCollapsed?: boolean;
	menuButton?: AppTopBarMenuButton;
};
