import type { ComputedRef } from 'vue';

import type { IStats } from '../store/stats.store.types';

export interface IUseStats {
	stats: ComputedRef<IStats | null>;
	isLoading: ComputedRef<boolean>;
	fetchStats: () => Promise<void>;
}
