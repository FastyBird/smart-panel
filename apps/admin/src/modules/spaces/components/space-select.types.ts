import { SpaceType } from '../spaces.constants';

export interface ISpaceSelectProps {
	modelValue: string | null | undefined;
	/**
	 * Which space types to show.
	 * 'all' = rooms + zones grouped, 'room' = rooms only, 'zone' = zones only
	 */
	filter?: SpaceType | 'all';
	placeholder?: string;
	clearable?: boolean;
	filterable?: boolean;
	disabled?: boolean;
}
