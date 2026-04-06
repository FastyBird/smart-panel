import { formatTimeAgo } from '@vueuse/core';

import { type NumberFormatSetting, formatNumber } from './number.utils';

export const formatPercent = (n?: number | null, fd: number = 2, numberFormat?: NumberFormatSetting): string => {
	return n == null ? '—' : `${formatNumber(n, { minimumFractionDigits: 0, maximumFractionDigits: fd }, numberFormat)}%`;
};

export const formatRelative = (iso: string | Date): string => {
	return formatTimeAgo(typeof iso === 'string' ? new Date(iso) : iso);
};
