export type TestConnectionResult = {
	ok: boolean;
	message: string;
};

export type TestConnectionProps = {
	/** Runs the test. A rejection is shown as a failed result with the error's message */
	run: () => Promise<TestConnectionResult>;
	/** Overrides "Test connection" */
	label?: string;
	disabled?: boolean;
};
