export type ListFilterBarQuickFilterOption = {
	value: string;
	label: string;
};

/** One quick filter: a "Label: All" dropdown in the bar on desktop, a select in the filters drawer below it */
export type ListFilterBarQuickFilter = {
	id: string;
	label: string;
	options: ListFilterBarQuickFilterOption[];
	/** The chosen option's value; empty means All */
	value?: string | null;
};

export type ListFilterBarProps = {
	search?: string;
	searchPlaceholder?: string;
	/** At most three; the rest belong in the `filters` slot */
	quickFilters?: ListFilterBarQuickFilter[];
	/** Number of active filters, quick filters included. Shown on the Filters button; above zero it shows Reset */
	activeCount?: number;
	/** Selected rows. Above zero the bulk bar with the `bulk` slot slides in under the filter row */
	selectedCount?: number;
};
