import type { StatusTagStatus } from '../../../common';
import type { IThrottleStatus } from '../store/throttle-status.store.types';

/** "3d 04:12:09", or "04:12:09" under a day; the overview's Uptime tile reads the same */
export const formatUptime = (seconds?: number | null): string | null => {
	if (seconds === null || seconds === undefined || Number.isNaN(seconds)) {
		return null;
	}

	const total = Math.max(0, Math.floor(seconds));
	const days = Math.floor(total / 86400);

	const pad = (value: number): string => value.toString().padStart(2, '0');

	const time = `${pad(Math.floor((total % 86400) / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;

	return days > 0 ? `${days}d ${time}` : time;
};

/** Bytes in the largest unit that keeps the number at one or more: B, KB, MB or GB */
export const formatSize = (bytes: number): string => {
	if (bytes < 1024) {
		return `${bytes} B`;
	}

	if (bytes < 1024 * 1024) {
		return `${(bytes / 1024).toFixed(1)} KB`;
	}

	if (bytes < 1024 * 1024 * 1024) {
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

/** The status-tag colour of a log level: failures red, warnings amber, successes green, the rest neutral */
export const logLevelStatus = (level: string): StatusTagStatus => {
	const value = level.toLowerCase();

	if (value === 'fatal') {
		return 'critical';
	}

	if (['error', 'fail'].includes(value)) {
		return 'danger';
	}

	if (['warn', 'box'].includes(value)) {
		return 'warn';
	}

	if (['success', 'ready', 'start'].includes(value)) {
		return 'ok';
	}

	return 'info';
};

/** The throttle flags that are set; none means the power supply and the temperature are fine */
export const throttleProblems = (status: IThrottleStatus | null): (keyof IThrottleStatus)[] => {
	if (status === null) {
		return [];
	}

	return (['undervoltage', 'frequencyCapping', 'throttling', 'softTempLimit'] as const).filter((key) => status[key]);
};
