export interface ISpaceSelectProps {
	modelValue: string | null | undefined;
	/**
	 * Which space types to show.
	 * 'all' = rooms + zones grouped (and any other space type), 'room' = rooms only, 'zone' = zones only,
	 * 'rooms_and_zones' = rooms + zones grouped, nothing else; a selected space of another type is still
	 * listed, disabled, so its name shows
	 */
	filter?: 'all' | 'room' | 'zone' | 'rooms_and_zones';
	placeholder?: string;
	clearable?: boolean;
	filterable?: boolean;
	disabled?: boolean;
}
