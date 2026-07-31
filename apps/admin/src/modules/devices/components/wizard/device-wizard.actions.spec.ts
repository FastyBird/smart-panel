import { describe, expect, it, vi } from 'vitest';

import { type IWizardActionsContext, buildWizardActions } from './device-wizard.actions';

const context = (overrides: Partial<IWizardActionsContext> = {}): IWizardActionsContext => ({
	t: (key: string) => key,
	capabilities: { addMore: false },
	canContinue: true,
	hasAdoptable: true,
	busy: false,
	onCancel: vi.fn(),
	onBack: vi.fn(),
	onNext: vi.fn(),
	onAdopt: vi.fn(),
	onAddMore: vi.fn(),
	onDone: vi.fn(),
	...overrides,
});

describe('buildWizardActions', () => {
	it('offers cancel and next on the discover step', () => {
		expect(buildWizardActions('discover', context()).map((action) => action.id)).toEqual(['cancel', 'next']);
	});

	it('disables next when there is nothing adoptable', () => {
		const actions = buildWizardActions('discover', context({ hasAdoptable: false }));

		expect(actions.find((action) => action.id === 'next')?.disabled).toBe(true);
	});

	it('offers back, cancel and adopt on the confirm step', () => {
		expect(buildWizardActions('confirm', context()).map((action) => action.id)).toEqual(['back', 'cancel', 'adopt']);
	});

	it('disables adopt unless the selection is complete', () => {
		const actions = buildWizardActions('confirm', context({ canContinue: false }));

		expect(actions.find((action) => action.id === 'adopt')?.disabled).toBe(true);
	});

	it('marks adopt as loading while the adapter is busy', () => {
		const actions = buildWizardActions('confirm', context({ busy: true }));

		expect(actions.find((action) => action.id === 'adopt')?.loading).toBe(true);
	});

	it('offers only done on the results step when addMore is unavailable', () => {
		expect(buildWizardActions('results', context()).map((action) => action.id)).toEqual(['done']);
	});

	it('offers addMore before done when the plugin declares the capability', () => {
		const actions = buildWizardActions('results', context({ capabilities: { addMore: true } }));

		expect(actions.map((action) => action.id)).toEqual(['addMore', 'done']);
	});

	it('wires each action to its handler', () => {
		const onAdopt = vi.fn();
		const actions = buildWizardActions('confirm', context({ onAdopt }));

		actions.find((action) => action.id === 'adopt')?.handler();

		expect(onAdopt).toHaveBeenCalledOnce();
	});
});
