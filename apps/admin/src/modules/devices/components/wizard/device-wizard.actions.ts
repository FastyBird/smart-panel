import type { IDeviceWizardCapabilities, IWizardAction, IWizardStep } from './device-wizard.types';

export interface IWizardActionsContext {
	t: (key: string) => string;
	capabilities: IDeviceWizardCapabilities;
	canContinue: boolean;
	hasAdoptable: boolean;
	busy: boolean;
	onCancel: () => void;
	onBack: () => void;
	onNext: () => void | Promise<void>;
	onAdopt: () => void | Promise<void>;
	onAddMore: () => void | Promise<void>;
	onDone: () => void;
}

/**
 * Single source of truth for the wizard action bar. Rendered twice — once in the desktop
 * `view-header` `#extra` slot and once in the mobile footer — so the per-step button logic
 * lives here rather than being duplicated in both templates.
 */
export const buildWizardActions = (step: IWizardStep, context: IWizardActionsContext): IWizardAction[] => {
	const { t } = context;

	if (step === 'discover') {
		return [
			{ id: 'cancel', label: t('devicesModule.wizard.actions.cancel'), variant: 'link', handler: context.onCancel },
			{
				id: 'next',
				label: t('devicesModule.wizard.actions.next'),
				variant: 'primary',
				disabled: !context.hasAdoptable,
				handler: context.onNext,
			},
		];
	}

	if (step === 'confirm') {
		return [
			{ id: 'back', label: t('devicesModule.wizard.actions.back'), variant: 'default', handler: context.onBack },
			{ id: 'cancel', label: t('devicesModule.wizard.actions.cancel'), variant: 'link', handler: context.onCancel },
			{
				id: 'adopt',
				label: t('devicesModule.wizard.actions.adopt'),
				variant: 'primary',
				disabled: !context.canContinue,
				loading: context.busy,
				handler: context.onAdopt,
			},
		];
	}

	const actions: IWizardAction[] = [];

	if (context.capabilities.addMore) {
		actions.push({
			id: 'addMore',
			label: t('devicesModule.wizard.actions.addMore'),
			variant: 'default',
			loading: context.busy,
			handler: context.onAddMore,
		});
	}

	actions.push({ id: 'done', label: t('devicesModule.wizard.actions.done'), variant: 'primary', handler: context.onDone });

	return actions;
};
