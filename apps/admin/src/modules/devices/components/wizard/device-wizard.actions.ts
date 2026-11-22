import type { IDeviceWizardCapabilities, IWizardAction, IWizardActionControl, IWizardStep } from './device-wizard.types';

export interface IWizardActionsContext {
	t: (key: string) => string;
	capabilities: IDeviceWizardCapabilities;
	canContinue: boolean;
	hasAdoptable: boolean;
	/** At least one device is ticked on the select step */
	hasSelection: boolean;
	/** Devices whose adoption failed, retried from the results step */
	failedCount: number;
	busy: boolean;
	/** The adapter's `action` controls, promoted into the bar on the discover step. */
	actionControls: IWizardActionControl[];
	onCancel: () => void;
	onBack: () => void;
	onNext: () => void | Promise<void>;
	onReview: () => void;
	onBackToSelect: () => void;
	onRetryFailed: () => void | Promise<void>;
	onAdopt: () => void | Promise<void>;
	onAddMore: () => void | Promise<void>;
	onDone: () => void;
}

/**
 * Single source of truth for the shared wizard footer on desktop and mobile.
 * The shell renders the actions; per-step button logic stays here.
 */
// A plugin's discovery action lives in the bar rather than the step body, so the primary thing
// a user does on the discover step ("Scan again", "Pair new device") sits with Cancel and Next
// instead of being buried above the table.
//
// The id is namespaced because it becomes both the `:key` and the `data-test-id` in a bar that
// already contains `cancel` / `next` / `back` / `adopt` / `addMore` / `done` — a plugin action
// called `next` would otherwise collide with the shell's own.
//
// `primary` is demoted so the step keeps exactly one primary action (Next). `warning` survives:
// Zigbee2MQTT flips its button to "Cancel pairing" while a pairing window is open, and that
// state has to stay visually distinct.
const promoteActionControl = (control: IWizardActionControl): IWizardAction => ({
	id: `control-${control.id}`,
	label: control.label,
	variant: control.variant === 'warning' ? 'warning' : 'default',
	icon: control.icon,
	disabled: control.disabled,
	loading: control.loading,
	handler: control.handler,
});

export const buildWizardActions = (step: IWizardStep, context: IWizardActionsContext): IWizardAction[] => {
	const { t } = context;

	if (step === 'discover') {
		return [
			...context.actionControls.map(promoteActionControl),
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

	if (step === 'select') {
		return [
			{ id: 'back', label: t('devicesModule.wizard.actions.back'), variant: 'default', handler: context.onBack },
			{ id: 'cancel', label: t('devicesModule.wizard.actions.cancel'), variant: 'link', handler: context.onCancel },
			{
				id: 'next',
				label: t('devicesModule.wizard.actions.next'),
				variant: 'primary',
				disabled: !context.hasSelection,
				handler: context.onReview,
			},
		];
	}

	if (step === 'confirm') {
		return [
			{ id: 'back', label: t('devicesModule.wizard.actions.back'), variant: 'default', handler: context.onBackToSelect },
			{ id: 'cancel', label: t('devicesModule.wizard.actions.cancel'), variant: 'link', handler: context.onCancel },
			{
				id: 'adopt',
				label: t('devicesModule.wizard.actions.adopt'),
				variant: 'primary',
				disabled: !context.canContinue || !context.hasSelection,
				loading: context.busy,
				handler: context.onAdopt,
			},
		];
	}

	const actions: IWizardAction[] = [];

	if (context.failedCount > 0) {
		actions.push({
			id: 'retryFailed',
			label: t('devicesModule.wizard.actions.retryFailed'),
			variant: 'default',
			loading: context.busy,
			handler: context.onRetryFailed,
		});
	}

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
