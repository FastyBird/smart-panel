import { describe, expect, it, vi } from 'vitest';

import { AUTOMATION_NODE_KIND_ICONS, AutomationNodeKind } from '../automations.constants';
import type { IAutomationNodeType } from '../store/node-types.store.types';

import { useAutomationNodePresentation } from './useAutomationNodePresentation';

const translated: Record<string, string> = {
	'automations.editor.kinds.trigger.label': 'When',
	'automations.editor.kinds.unknown.label': 'Unknown',
	'automations.editor.nodeTypes.flow.delay.name': 'Wait a while',
	'automations.editor.nodeTypes.flow.delay.description': 'Waits before the flow continues.',
	'automations.editor.ports.yes': 'yes!',
	'automations.editor.issues.no_trigger': 'Add a trigger.',
	'automations.editor.texts.notConfigured': 'Not configured yet',
	'automations.editor.texts.unknownNodeType': 'No longer available',
};

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: (key: string) => translated[key] ?? key,
		te: (key: string) => key in translated,
	}),
}));

const nodeType = (type: string, kind: AutomationNodeKind, configSchema: Record<string, unknown> = {}): IAutomationNodeType => ({
	type,
	kind,
	name: `Backend name of ${type}`,
	description: `Backend description of ${type}`,
	ports: { inputs: [], outputs: [] },
	configSchema,
});

describe('useAutomationNodePresentation', (): void => {
	const { issueText, kindLabel, nodeTitle, nodeDescription, nodeIcon, nodeSummary, portLabel } = useAutomationNodePresentation();

	const delay = nodeType('flow.delay', AutomationNodeKind.flow, { type: 'object', properties: { seconds: { type: 'integer' } } });
	const plugin = nodeType('plugin.card', AutomationNodeKind.action);

	it('labels the kinds, also the kind of a card that is gone', (): void => {
		expect(kindLabel(AutomationNodeKind.trigger)).toBe('When');
		expect(kindLabel(null)).toBe('Unknown');
	});

	it('names a card by its translation, then by the backend, then by its type', (): void => {
		expect(nodeTitle('flow.delay', delay)).toBe('Wait a while');
		expect(nodeTitle('plugin.card', plugin)).toBe('Backend name of plugin.card');
		expect(nodeTitle('plugin.gone', null)).toBe('plugin.gone');

		expect(nodeDescription('flow.delay', delay)).toBe('Waits before the flow continues.');
		expect(nodeDescription('plugin.card', plugin)).toBe('Backend description of plugin.card');
		expect(nodeDescription('plugin.gone', null)).toBe('');
	});

	it('gives a card its own icon, the icon of its kind, or the one for an unknown card', (): void => {
		expect(nodeIcon('flow.delay', delay)).toBe('mdi:timer-sand');
		expect(nodeIcon('plugin.card', plugin)).toBe(AUTOMATION_NODE_KIND_ICONS[AutomationNodeKind.action]);
		expect(nodeIcon('plugin.gone', null)).toBe('mdi:help-circle-outline');
	});

	it('sums a card up in one line', (): void => {
		expect(nodeSummary({ type: 'flow.delay', config: { seconds: 30 } }, delay)).toBe('seconds: 30');
		// Something to configure, nothing configured
		expect(nodeSummary({ type: 'flow.delay', config: {} }, delay)).toBe('Not configured yet');
		// Nothing to configure: the description says what the card does
		expect(nodeSummary({ type: 'plugin.card', config: {} }, plugin)).toBe('Backend description of plugin.card');
		expect(nodeSummary({ type: 'plugin.gone', config: { a: 1 } }, null)).toBe('No longer available');
	});

	it('words the ports it knows and shows the others as they are', (): void => {
		expect(portLabel('yes')).toBe('yes!');
		expect(portLabel('branch_a')).toBe('branch_a');
	});

	it('words the structural issues and leaves the others to the backend', (): void => {
		expect(issueText({ code: 'no_trigger', message: 'An automation needs at least one trigger to start it.' })).toBe('Add a trigger.');
		expect(issueText({ code: 'invalid_config', message: 'The time must be written as HH:mm.' })).toBe('The time must be written as HH:mm.');
	});
});
