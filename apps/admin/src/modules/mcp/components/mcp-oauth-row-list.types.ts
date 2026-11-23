import type { StatusTagStatus } from '../../../common';

export type McpOAuthRow = {
	id: string;
	title: string;
	caption: string;
	status?: { status: StatusTagStatus; label: string };
};
