import type { IMcpOAuthTabFilter } from '../composables/useMcpOAuthTabQuery';

export interface IMcpOAuthTabStatusOption {
	value: string;
	/** Translation key, resolved by the component. */
	label: string;
}

export interface IMcpOAuthTabFilterProps {
	filters: IMcpOAuthTabFilter;
	filtersActive: boolean;
	searchPlaceholder: string;
	/** Empty on tabs with no status axis, which then show search alone. */
	statusOptions: IMcpOAuthTabStatusOption[];
	/** Distinguishes this tab's controls in the DOM. */
	testId: string;
}
