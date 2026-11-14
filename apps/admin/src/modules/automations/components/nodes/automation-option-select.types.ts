export interface IAutomationOption {
	value: string;
	label: string;
}

export interface IAutomationOptionSelectProps {
	// A value that is not one of the options is shown as it is, so a stored value is not hidden
	modelValue: unknown;
	options: IAutomationOption[];
	// Offered first, for a field that may be left out ("any change"); picking it leaves the key out
	emptyLabel?: string;
	placeholder?: string;
	name?: string;
	disabled?: boolean;
}

export interface IAutomationOptionCheckboxesProps {
	modelValue: unknown;
	options: IAutomationOption[];
	label?: string;
	disabled?: boolean;
}
