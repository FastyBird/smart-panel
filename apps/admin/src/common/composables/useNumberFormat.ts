import { computed, type ComputedRef } from 'vue';

import { useConfigModule } from '../../modules/config';
import type { NumberFormatSetting } from '../utils/number.utils';
import { formatNumber } from '../utils/number.utils';

const SYSTEM_MODULE_NAME = 'system-module';

interface IUseNumberFormat {
	numberFormat: ComputedRef<NumberFormatSetting>;
	formatNum: (value: number, options?: Intl.NumberFormatOptions) => string;
}

export const useNumberFormat = (): IUseNumberFormat => {
	const { configModule: systemConfig } = useConfigModule({ type: SYSTEM_MODULE_NAME });

	const numberFormat = computed<NumberFormatSetting>(() => {
		const config = systemConfig.value as { numberFormat?: string } | null;
		const format = config?.numberFormat;

		if (format === 'comma_dot' || format === 'dot_comma' || format === 'space_comma' || format === 'none') {
			return format;
		}

		return 'comma_dot';
	});

	const formatNum = (value: number, options: Intl.NumberFormatOptions = {}): string => {
		return formatNumber(value, options, numberFormat.value);
	};

	return {
		numberFormat,
		formatNum,
	};
};
