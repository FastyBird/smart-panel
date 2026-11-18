export interface IWizardReviewCheck {
	id: string;
	label: string;
	value?: string;
	status: 'success' | 'error' | 'info';
	detail?: string;
}
