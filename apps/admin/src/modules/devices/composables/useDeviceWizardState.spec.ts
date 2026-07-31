import { describe, expect, it } from 'vitest';

import { DevicesModuleDeviceCategory } from '../../../openapi.constants';
import type { IWizardRow } from '../components/wizard/device-wizard.types';

import { useDeviceWizardState } from './useDeviceWizardState';

const row = (overrides: Partial<IWizardRow> = {}): IWizardRow => ({
	key: 'shelly-1.local',
	label: 'Living room switch',
	subLabel: 'Shelly Plus 1',
	identifier: 'shelly-1.local',
	status: 'ready',
	adoptable: true,
	willUpdate: false,
	suggestedName: 'Living room switch',
	suggestedCategory: DevicesModuleDeviceCategory.lighting,
	categoryOptions: [{ value: DevicesModuleDeviceCategory.lighting, label: 'Lighting' }],
	...overrides,
});

describe('useDeviceWizardState — reconciliation', () => {
	it('pre-selects a ready row on first sight', () => {
		const state = useDeviceWizardState();

		state.reconcile([row()]);

		expect(state.selected['shelly-1.local']).toBe(true);
	});

	it('does not pre-select a non-ready row on first sight', () => {
		const state = useDeviceWizardState();

		state.reconcile([row({ status: 'already_registered', willUpdate: true })]);

		expect(state.selected['shelly-1.local']).toBe(false);
	});

	it('selects a row on its first transition to ready', () => {
		const state = useDeviceWizardState();

		state.reconcile([row({ status: 'checking', adoptable: false })]);
		expect(state.selected['shelly-1.local']).toBe(false);

		state.reconcile([row({ status: 'ready' })]);
		expect(state.selected['shelly-1.local']).toBe(true);
	});

	it('never re-selects a row the user deselected', () => {
		const state = useDeviceWizardState();

		state.reconcile([row()]);
		state.selected['shelly-1.local'] = false;
		state.reconcile([row()]);

		expect(state.selected['shelly-1.local']).toBe(false);
	});

	it('deselects a row that becomes already_registered', () => {
		const state = useDeviceWizardState();

		state.reconcile([row()]);
		state.reconcile([row({ status: 'already_registered', willUpdate: true })]);

		expect(state.selected['shelly-1.local']).toBe(false);
	});

	it('fills the name from the adapter suggestion on first sight', () => {
		const state = useDeviceWizardState();

		state.reconcile([row({ suggestedName: 'Kitchen dimmer' })]);

		expect(state.nameByKey['shelly-1.local']).toBe('Kitchen dimmer');
	});

	it('preserves a name the user typed', () => {
		const state = useDeviceWizardState();

		state.reconcile([row({ status: 'checking', adoptable: false })]);
		state.nameByKey['shelly-1.local'] = 'My name';
		state.reconcile([row({ status: 'ready', suggestedName: 'Suggested' })]);

		expect(state.nameByKey['shelly-1.local']).toBe('My name');
	});

	it('refreshes a name still showing the raw identifier once the row becomes adoptable', () => {
		const state = useDeviceWizardState();

		state.reconcile([row({ status: 'checking', adoptable: false, suggestedName: 'shelly-1.local' })]);
		expect(state.nameByKey['shelly-1.local']).toBe('shelly-1.local');

		state.reconcile([row({ status: 'ready', adoptable: true, suggestedName: 'Living room switch' })]);
		expect(state.nameByKey['shelly-1.local']).toBe('Living room switch');
	});

	it('fills a null category from a late-arriving suggestion', () => {
		const state = useDeviceWizardState();

		state.reconcile([row({ suggestedCategory: null })]);
		expect(state.categoryByKey['shelly-1.local']).toBeNull();

		state.reconcile([row({ suggestedCategory: DevicesModuleDeviceCategory.switcher })]);
		expect(state.categoryByKey['shelly-1.local']).toBe(DevicesModuleDeviceCategory.switcher);
	});

	it('never overwrites a category the user chose', () => {
		const state = useDeviceWizardState();

		state.reconcile([row({ suggestedCategory: null })]);
		state.categoryByKey['shelly-1.local'] = DevicesModuleDeviceCategory.lighting;
		state.reconcile([row({ suggestedCategory: DevicesModuleDeviceCategory.switcher })]);

		expect(state.categoryByKey['shelly-1.local']).toBe(DevicesModuleDeviceCategory.lighting);
	});

	it('reset clears every map', () => {
		const state = useDeviceWizardState();

		state.reconcile([row()]);
		state.reset();

		expect(state.selected).toEqual({});
		expect(state.nameByKey).toEqual({});
		expect(state.categoryByKey).toEqual({});
	});

	it('reset lets a previously-deselected row be pre-selected again', () => {
		const state = useDeviceWizardState();

		state.reconcile([row()]);
		state.selected['shelly-1.local'] = false;
		state.reset();
		state.reconcile([row()]);

		expect(state.selected['shelly-1.local']).toBe(true);
	});
});
