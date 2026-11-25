export interface IStatTileProps {
	icon: string;
	label: string;
	/** The big number, formatted; empty while there is no figure yet: a skeleton while loading, a dash after */
	value: string;
	/** A line under the number: a total, a temperature, a second figure */
	hint?: string;
	/** When the figure was measured: the tooltip says so, and warns once it is stale */
	lastUpdated?: Date | null;
	stale?: boolean;
	/** A usage bar under the figure, 0–100 */
	progress?: number | null;
	loading?: boolean;
}
