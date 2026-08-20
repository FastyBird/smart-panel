export type IConfigSecretInputProps = {
	/**
	 * `undefined` leaves the stored value alone, a string replaces it, and `null` removes it.
	 * Those are the backend's three cases, so the form field carries them directly.
	 */
	modelValue?: string | null;
	/** Whether the backend reports a value is stored - it never sends the value itself. */
	configured?: boolean;
	/** `textarea` for the multi-line credentials; anything else is a masked single line. */
	type?: 'password' | 'textarea';
	rows?: number;
	placeholder?: string;
	name?: string;
	disabled?: boolean;
};
