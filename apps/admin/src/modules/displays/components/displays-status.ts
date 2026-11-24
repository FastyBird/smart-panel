import type { StatusTagStatus } from '../../../common';
import type { IDisplay } from '../store/displays.store.types';

// Spec section 4, status-tag: how each connection state reads in the list and on the detail page
export const DISPLAY_STATUS_TAG: Record<NonNullable<IDisplay['status']>, StatusTagStatus> = {
	connected: 'ok',
	disconnected: 'warn',
	lost: 'danger',
	unknown: 'info',
};

export const displayStatus = (display: IDisplay): NonNullable<IDisplay['status']> => display.status ?? 'unknown';

const LOCAL_ADDRESSES = ['localhost', '127.0.0.1', '::1', '0:0:0:0:0:0:0:1'];

/** A loopback address means the display runs on this server */
export const isLocalAddress = (ipAddress: string): boolean => LOCAL_ADDRESSES.includes(ipAddress.toLowerCase().trim());
