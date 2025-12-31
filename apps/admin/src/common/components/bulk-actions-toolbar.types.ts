export interface IBulkAction {
	key: string;
	label: string;
	icon: string;
	type?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
}

export interface IBulkActionsToolbarProps {
	selectedCount: number;
	actions: IBulkAction[];
}
