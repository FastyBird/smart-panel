import type { StatusTagStatus } from '../../../common';

/** The one action of a provider card; the rest go into its ⋯ menu */
export interface IProviderCardAction {
	key: string;
	label: string;
	primary?: boolean;
	loading?: boolean;
	disabled?: boolean;
}

export interface IProviderCardMenuItem {
	key: string;
	label: string;
	disabled?: boolean;
	/** Destructive: shown last, after a divider, in the danger colour */
	danger?: boolean;
}

/** The card's one line: what the provider is doing, or what stops it */
export interface IProviderCardLine {
	text: string;
	status?: 'warn' | 'danger' | 'info';
}

export interface IProviderCardProps {
	icon: string;
	title: string;
	status: StatusTagStatus;
	statusLabel: string;
	line: IProviderCardLine;
	/** At most two are shown */
	endpoints?: string[];
	action?: IProviderCardAction | null;
	menu?: IProviderCardMenuItem[];
}
