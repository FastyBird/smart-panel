// THROWAWAY SPIKE (AU-0). Static stand-in for the `GET /node-types` catalogue of the design.
import type { AutomationNodeKind, IAutomationNodeTypeDefinition } from './automations-spike.types';

export const PROPERTY_LABELS: Record<string, { label: string; unit: string }> = {
	occupancy: { label: 'Occupancy', unit: '' },
	illuminance: { label: 'Illuminance', unit: 'lx' },
	temperature: { label: 'Temperature', unit: '°C' },
};

export const OPERATOR_LABELS: Record<string, string> = {
	lt: '<',
	lte: '≤',
	eq: '=',
	gte: '≥',
	gt: '>',
};

export const KIND_LABELS: Record<AutomationNodeKind, string> = {
	trigger: 'When',
	condition: 'And',
	action: 'Then',
	flow: 'Flow',
};

export const KIND_ORDER: AutomationNodeKind[] = ['trigger', 'condition', 'action', 'flow'];

const propertyLabel = (id: unknown): string => PROPERTY_LABELS[String(id)]?.label ?? String(id);

export const NODE_TYPES: IAutomationNodeTypeDefinition[] = [
	{
		type: 'device.property.changed',
		kind: 'trigger',
		label: 'Device value changes',
		icon: 'mdi:motion-sensor',
		inputs: [],
		outputs: ['out'],
		defaultConfig: { property: 'occupancy', to: 'detected', for_minutes: 0 },
		summary: (config): string => {
			const forMinutes = Number(config.for_minutes ?? 0);

			return forMinutes > 0
				? `${propertyLabel(config.property)} ${String(config.to)} for ${forMinutes} min`
				: `${propertyLabel(config.property)} becomes ${String(config.to)}`;
		},
	},
	{
		type: 'device.property.compare',
		kind: 'condition',
		label: 'Device value comparison',
		icon: 'mdi:scale-balance',
		inputs: ['in'],
		outputs: ['yes', 'no'],
		defaultConfig: { property: 'illuminance', operator: 'lt', value: 50 },
		summary: (config): string => {
			const unit = PROPERTY_LABELS[String(config.property)]?.unit ?? '';

			return `${propertyLabel(config.property)} ${OPERATOR_LABELS[String(config.operator)] ?? '?'} ${String(config.value)}${unit ? ` ${unit}` : ''}`;
		},
	},
	{
		type: 'time.window',
		kind: 'condition',
		label: 'Time window',
		icon: 'mdi:clock-outline',
		inputs: ['in'],
		outputs: ['yes', 'no'],
		defaultConfig: { from: '22:00', to: '06:00' },
		summary: (config): string => `Time is ${String(config.from)}–${String(config.to)}`,
	},
	{
		type: 'light.set',
		kind: 'action',
		label: 'Set light',
		icon: 'mdi:lightbulb-on-outline',
		inputs: ['in'],
		outputs: ['done', 'error'],
		defaultConfig: { on: true, brightness: 100 },
		summary: (config): string => (config.on ? `Light on, brightness ${String(config.brightness)} %` : 'Light off'),
	},
	{
		type: 'flow.delay',
		kind: 'flow',
		label: 'Delay',
		icon: 'mdi:timer-sand',
		inputs: ['in'],
		outputs: ['out'],
		defaultConfig: { seconds: 30 },
		summary: (config): string => `Wait ${String(config.seconds)} s`,
	},
];

export const getNodeType = (type: string): IAutomationNodeTypeDefinition | undefined => NODE_TYPES.find((def) => def.type === type);
