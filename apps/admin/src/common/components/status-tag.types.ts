export type StatusTagStatus = 'ok' | 'warn' | 'danger' | 'info' | 'critical' | 'primary';

export type StatusTagProps = {
	status: StatusTagStatus;
	label?: string;
};
