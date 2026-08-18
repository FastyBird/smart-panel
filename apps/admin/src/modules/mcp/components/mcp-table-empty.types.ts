export interface IMcpTableEmptyProps {
	/** Glyph identifying the records the table holds, e.g. `mdi:key-chain`. */
	icon: string;
	loading: boolean;
	/** Set when the last load failed, so the slot offers a retry instead of "nothing here". */
	failed?: boolean;
	/** Set when filters are narrowing the list, so the slot offers to clear them. */
	filtersActive?: boolean;
	emptyLabel: string;
}
