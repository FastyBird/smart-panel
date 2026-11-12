export interface IAutomationDurationInputProps {
	// Seconds
	modelValue: number | undefined;
	// The longest duration taken, in seconds
	max: number;
	name?: string;
	disabled?: boolean;
}
