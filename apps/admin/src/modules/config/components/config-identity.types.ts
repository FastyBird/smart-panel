import type { StatusTagStatus } from '../../../common';

export type ConfigIdentityProps = {
	icon: string;
	name: string;
	/** The line under the name: the plugin family and its version, or what a module does */
	meta?: string;
	/** The connection state of the plugin's services, when it runs any */
	status?: { status: StatusTagStatus; label: string } | null;
	/** Whether the Enabled switch is shown; a module's settings have none */
	toggleable?: boolean;
};
