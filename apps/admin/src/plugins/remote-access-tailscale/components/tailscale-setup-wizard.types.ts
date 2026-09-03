export type TailscaleWizardStep = 'setup' | 'signin' | 'options' | 'done';

export interface ITailscaleSetupWizardProps {
	visible: boolean;
	/** Which step to land on when the wizard opens - the card decides this from the node's current state/requirements. */
	initialStep?: TailscaleWizardStep;
}
