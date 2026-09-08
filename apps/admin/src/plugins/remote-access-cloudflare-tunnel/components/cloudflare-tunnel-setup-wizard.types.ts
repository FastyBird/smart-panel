export type CloudflareTunnelWizardStep = 'install' | 'config' | 'done';

export interface ICloudflareTunnelSetupWizardProps {
	visible: boolean;
	/** Which step to land on when the wizard opens - the card decides this from the tunnel's current state/requirements. */
	initialStep?: CloudflareTunnelWizardStep;
}
