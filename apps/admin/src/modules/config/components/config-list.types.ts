import type { StatusTagStatus } from '../../../common';

export type ConfigListItem = {
	/** The module or plugin type, which its settings route takes */
	id: string;
	name: string;
	description?: string;
	icon: string;
	tag?: { status: StatusTagStatus; label: string };
};

export type ConfigListProps = {
	items: ConfigListItem[];
	/** The item whose settings are open */
	activeId?: string | null;
};
