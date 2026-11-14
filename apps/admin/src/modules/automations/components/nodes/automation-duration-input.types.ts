export interface IAutomationDurationInputProps {
	// Seconds
	modelValue: number | undefined;
	// The longest duration taken, in seconds
	max: number;
	// The shortest duration taken, in seconds; one second when left out
	min?: number;
	name?: string;
	disabled?: boolean;
}
