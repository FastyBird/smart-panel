export type AppBarLeft = 'menu' | 'back' | 'close';

/** An icon button in the app bar; at most two are shown */
export type AppBarAction = {
	icon: string;
	/** Accessible name and tooltip */
	label: string;
	handler: () => void;
	disabled?: boolean;
};

/** The single text button that replaces the icon actions, such as Save on an edit screen */
export type AppBarPrimary = {
	label: string;
	handler: () => void;
	loading?: boolean;
	disabled?: boolean;
};

export type AppBarProps = {
	title?: string;
	subtitle?: string;
	/** No left button when omitted */
	left?: AppBarLeft | null;
	actions?: AppBarAction[];
	/** Shown instead of the actions */
	primary?: AppBarPrimary;
};
