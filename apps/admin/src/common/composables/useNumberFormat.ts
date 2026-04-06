import { computed } from 'vue';

import { configModulesStoreKey } from '../../modules/config/store/keys';
import { formatPercent } from '../utils/format.utils';
import { type NumberFormatSetting, formatNumber } from '../utils/number.utils';
import { injectStoresManager } from '../services/store';

import type { IUseNumberFormat } from './types';

export const useNumberFormat = (): IUseNumberFormat => {
	const storesManager = injectStoresManager();
	const configModuleStore = storesManager.getStore(configModulesStoreKey);

	const numberFormat = computed<NumberFormatSetting | undefined>((): NumberFormatSetting | undefined => {
		const mod = configModuleStore.findByType('system-module');

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
