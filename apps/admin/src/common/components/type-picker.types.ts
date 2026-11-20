export type TypePickerOption = {
	id: string;
	icon: string;
	name: string;
	description?: string;
	badge?: string;
	disabled?: boolean;
};

export type TypePickerProps = {
	options: TypePickerOption[];
	modelValue?: string | null;
	visible?: boolean;
	title?: string;
};
