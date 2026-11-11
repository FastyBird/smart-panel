import type { IChannelProperty } from '../../store/channels.properties.store.types';

export type IPropertyValueInputValue = string | number | boolean | null | undefined;

export type IPropertyValueInputType = 'string' | 'number' | 'boolean' | 'enum';

export interface IPropertyValueInputProps {
	modelValue: IPropertyValueInputValue;
	// The property the value is edited for; without it a plain text input is rendered
	property?: Pick<IChannelProperty, 'dataType' | 'format' | 'step'> | null;
	// Predicate an enum value has to pass to be offered
	optionFilter?: (value: string) => boolean;
	placeholder?: string;
	name?: string;
}
