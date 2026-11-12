import type { IChannelProperty } from '../../../devices/store/channels.properties.store.types';
import type { IAutomationSafetyTarget } from '../../nodes/nodes.safety';
import type { AutomationPropertyValue } from '../../nodes/nodes.values';

export interface IAutomationPropertyValueInputProps {
	modelValue: AutomationPropertyValue | undefined;
	// The property the value is for; without it the value is typed as text
	property?: Pick<IChannelProperty, 'dataType' | 'format' | 'step'> | null;
	// Given for a value that is written: what would unlock, disarm or open the target is not offered
	safetyTarget?: IAutomationSafetyTarget | null;
	// For a threshold: a number whatever the property holds
	numeric?: boolean;
	name?: string;
	disabled?: boolean;
}
