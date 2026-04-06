import { computed } from 'vue';

import { useConfigModule } from '../../modules/config/composables/useConfigModule';
import { SYSTEM_MODULE_NAME } from '../../modules/system/system.constants';
import { type NumberFormatSetting, formatNumber } from '../utils/number.utils';

import type { IUseNumberFormat } from './types';

export const useNumberFormat = (): IUseNumberFormat => {
	const { configModule } = useConfigModule({ type: SYSTEM_MODULE_NAME });

	const numberFormat = computed<NumberFormatSetting | undefined>((): NumberFormatSetting | undefined => {
		const mod = configModule.value;

		if (mod && 'numberFormat' in mod) {
			return (mod as { numberFormat: NumberFormatSetting }).numberFormat;
		}

		return undefined;
	});

	const format = (value: number, options?: Intl.NumberFormatOptions): string => {
		return formatNumber(value, options ?? {}, numberFormat.value);
	};

	const formatPct = (value?: number | null, fractionDigits?: number): string => {
		if (value == null) {
			return '—';
		}

		return `${formatNumber(value, { minimumFractionDigits: 0, maximumFractionDigits: fractionDigits ?? 2 }, numberFormat.value)}%`;
	};

	return {
		numberFormat,
		format,
		formatPct,
	};
};
