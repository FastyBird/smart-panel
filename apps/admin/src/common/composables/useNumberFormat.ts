import { type ComputedRef, computed } from 'vue';

import { useConfigModule } from '../../modules/config/composables/useConfigModule';
import { SYSTEM_MODULE_NAME } from '../../modules/system/system.constants';
import { formatPercent } from '../utils/format.utils';
import { type NumberFormatSetting, formatNumber } from '../utils/number.utils';

export interface IUseNumberFormat {
	numberFormat: ComputedRef<NumberFormatSetting | undefined>;
	format: (value: number, options?: Intl.NumberFormatOptions) => string;
	formatPct: (value?: number | null, fractionDigits?: number) => string;
}

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
		return formatPercent(value, fractionDigits, numberFormat.value);
	};

	return {
		numberFormat,
		format,
		formatPct,
	};
};
