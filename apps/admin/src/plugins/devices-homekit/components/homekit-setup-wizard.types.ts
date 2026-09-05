export type HomeKitWizardStep = 'devices' | 'pairing';

export interface IHomeKitSetupWizardProps {
	visible: boolean;
	initialStep?: HomeKitWizardStep;
}
