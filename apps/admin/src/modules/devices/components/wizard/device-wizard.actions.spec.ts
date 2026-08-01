import { describe, expect, it, vi } from 'vitest';

import { type IWizardActionsContext, buildWizardActions } from './device-wizard.actions';
import type { IWizardActionControl } from './device-wizard.types';

const context = (overrides: Partial<IWizardActionsContext> = {}): IWizardActionsContext => ({
	t: (key: string) => key,
	capabilities: { addMore: false },
	canContinue: true,
	hasAdoptable: true,
	busy: false,
	actionControls: [],
	onCancel: vi.fn(),
	onBack: vi.fn(),
	onNext: vi.fn(),
	onAdopt: vi.fn(),
	onAddMore: vi.fn(),
	onDone: vi.fn(),
	...overrides,
});

const actionControl = (overrides: Partial<IWizardActionControl> = {}): IWizardActionControl => ({
	type: 'action',
	id: 'restart-scan',
	label: 'Scan again',
	icon: 'mdi:radar',
	handler: vi.fn(),
	...overrides,
});

describe('buildWizardActions', () => {
	it('offers cancel and next on the discover step', () => {
		expect(buildWizardActions('discover', context()).map((action) => action.id)).toEqual(['cancel', 'next']);
	});

	it('promotes plugin action controls ahead of cancel on the discover step', () => {
		const actions = buildWizardActions('discover', context({ actionControls: [actionControl()] }));

		expect(actions.map((action) => action.id)).toEqual(['control-restart-scan', 'cancel', 'next']);
	});

	it('namespaces a promoted id so a plugin cannot collide with a shell action', () => {
		const actions = buildWizardActions('discover', context({ actionControls: [actionControl({ id: 'next' })] }));

		expect(actions.map((action) => action.id)).toEqual(['control-next', 'cancel', 'next']);
	});

	it('carries the promoted control label, icon, disabled and loading through', () => {
		const actions = buildWizardActions('discover', context({ actionControls: [actionControl({ disabled: true, loading: true })] }));
		const promoted = actions.find((action) => action.id === 'control-restart-scan');

		expect(promoted?.label).toBe('Scan again');
		expect(promoted?.icon).toBe('mdi:radar');
		expect(promoted?.disabled).toBe(true);
		expect(promoted?.loading).toBe(true);
	});

	it('demotes a primary control so the step keeps a single primary action', () => {
		const actions = buildWizardActions('discover', context({ actionControls: [actionControl({ variant: 'primary' })] }));

		expect(actions.find((action) => action.id === 'control-restart-scan')?.variant).toBe('default');
		expect(actions.find((action) => action.id === 'next')?.variant).toBe('primary');
	});

	it('preserves the warning variant so an active pairing window stays visually distinct', () => {
		const actions = buildWizardActions('discover', context({ actionControls: [actionControl({ variant: 'warning' })] }));

		expect(actions.find((action) => action.id === 'control-restart-scan')?.variant).toBe('warning');
	});

	it('wires a promoted action to the control handler', () => {
		const handler = vi.fn();
		const actions = buildWizardActions('discover', context({ actionControls: [actionControl({ handler })] }));

		actions.find((action) => action.id === 'control-restart-scan')?.handler();

		expect(handler).toHaveBeenCalledOnce();
	});

	it('ignores plugin action controls on the confirm and results steps', () => {
		const controls = [actionControl()];

		expect(buildWizardActions('confirm', context({ actionControls: controls })).map((action) => action.id)).toEqual(['back', 'cancel', 'adopt']);
		expect(buildWizardActions('results', context({ actionControls: controls })).map((action) => action.id)).toEqual(['done']);
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
