import type { Domain } from '../../../common';

export interface IDomainTag {
	label: string;
	type: 'primary' | 'success' | 'warning' | 'info' | 'danger';
	icon: string;
	count: number;
}

export interface ISpaceDomainCardProps {
	/** Shown with the shared domain icon and colour (spec section 4); `icon` and `iconColor` only without it */
	domain?: Domain;
	icon: string;
	iconColor: 'warning' | 'danger' | 'primary' | 'success' | 'info';
	title: string;
	description: string;
	tags: IDomainTag[];
	loading: boolean;
}
