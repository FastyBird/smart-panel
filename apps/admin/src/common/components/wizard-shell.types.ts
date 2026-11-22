export type WizardShellStep = {
	id: string;
	label: string;
};

export type WizardShellProps = {
	steps: WizardShellStep[];
	/** The current step's `id` */
	current: string;
	canContinue?: boolean;
	/** Shown in the footer ("4 selected") on steps that pick rows */
	selectedCount?: number;
	/** Shows Skip, a tertiary button left of Back */
	skippable?: boolean;
	/** Overrides Next, or Finish on the last step ("Review 4 devices") */
	nextLabel?: string;
	/** The step is saving or loading: Next shows a spinner and the other buttons wait */
	busy?: boolean;
	/** `table` widens the step card from 720 to 960 px, for steps built around a table (Select, Confirm) */
	stepWidth?: 'form' | 'table';
	/** false hides Cancel, for a step with nothing left to cancel (Results) */
	cancellable?: boolean;
	/** Overrides when Back shows; by default from the second step on */
	backable?: boolean;
	/** false hides Next, for a step that finishes from its own actions */
	nextVisible?: boolean;
	/** false when the flow cannot go back to a completed step: the stepper only shows the steps */
	navigable?: boolean;
};
