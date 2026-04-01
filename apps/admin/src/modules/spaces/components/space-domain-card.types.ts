export interface IDomainTag {
	label: string;
	type: 'primary' | 'success' | 'warning' | 'info' | 'danger';
	icon: string;
	count: number;
}

export interface ISpaceDomainCardProps {
	icon: string;
	iconColor: 'warning' | 'danger' | 'primary' | 'success' | 'info';
	title: string;
	description: string;
	tags: IDomainTag[];
	loading: boolean;
}
