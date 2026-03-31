export interface ISpaceSelectProps {
	modelValue: string | null | undefined;
	/**
	 * Which space types to show.
	 * 'all' = rooms + zones grouped, 'room' = rooms only, 'zone' = zones only
	 */
	filter?: 'all' | 'room' | 'zone';
	placeholder?: string;
	clearable?: boolean;
	filterable?: boolean;
	disabled?: boolean;
}
