/**
 * Checks automation templates, checks the answers to their questions, and generates the graph of an automation
 * from a template and its answers.
 *
 * Framework-free (ADR 0003, decision 15): the device property lookup is handed in, so every rule can be tested
 * without the application.
 */
import { isUUID } from 'class-validator';

import { PermissionType } from '../../devices/devices.constants';
import { AUTOMATION_GRAPH_VERSION } from '../automations.constants';
import {
	DevicePropertyInfo,
	DevicePropertyLookup,
	checkPropertyTarget,
	isWritable,
} from '../nodes/device-property.utils';

import {
	AUTOMATION_TEMPLATE_PLACEHOLDER_KEY,
	AUTOMATION_TEMPLATE_PROPERTY_FIELDS,
	AutomationTemplate,
	AutomationTemplateGraphEdge,
	AutomationTemplateGraphNode,
	AutomationTemplateParameter,
	AutomationTemplateParameterValues,
	AutomationTemplatePropertyField,
	AutomationTemplatePropertyParameter,
	AutomationTemplatePropertyValue,
} from './automation-template.types';

/** One reason the answers to a template were refused */
export interface AutomationTemplateParameterIssue {
	/** `parameters.<id>`, or `parameters.<id>.<field>` for a part of a device property */
	field: string;
	reason: string;
}

/** The graph generated from a template: an ordinary graph document */
export interface AutomationTemplateGraph {
	version: number;
	nodes: AutomationTemplateGraphNode[];
	edges: AutomationTemplateGraphEdge[];
}

/** What generating an automation from a template gives: what a new automation is created with */
export interface AutomationTemplateDraft {
	name: string;
	mode: AutomationTemplate['mode'];
	graph: AutomationTemplateGraph;
}

interface Placeholder {
	parameter: string;
	field: string | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Reads a placeholder: an object whose only key is `$param`. Returns null for any other value, and throws for an
 * object that names `$param` among other keys or with something that is not a text, which is a mistake in the file.
 */
const readPlaceholder = (value: unknown): Placeholder | null => {
	if (!isRecord(value) || !(AUTOMATION_TEMPLATE_PLACEHOLDER_KEY in value)) {
		return null;
	}

	const reference = value[AUTOMATION_TEMPLATE_PLACEHOLDER_KEY];

	if (Object.keys(value).length !== 1 || typeof reference !== 'string' || reference === '') {
		throw new Error(`a placeholder must be { ${AUTOMATION_TEMPLATE_PLACEHOLDER_KEY}: <parameter>[.<field>] } alone`);
	}

	const [parameter, field, ...rest] = reference.split('.');

	if (rest.length > 0) {
		throw new Error(`placeholder ${reference} names more than a parameter and a field`);
	}

	return { parameter, field: field ?? null };
};

/** Calls `visit` for every placeholder in a configuration, with the dot-separated path it sits at */
const forEachPlaceholder = (
	value: unknown,
	path: string,
	visit: (placeholder: Placeholder, path: string) => void,
): void => {
	const placeholder = readPlaceholder(value);

	if (placeholder) {
		visit(placeholder, path);

		return;
	}

	if (Array.isArray(value)) {
		value.forEach((item, index) => forEachPlaceholder(item, path === '' ? `${index}` : `${path}.${index}`, visit));

		return;
	}

	if (isRecord(value)) {
		for (const [key, item] of Object.entries(value)) {
			forEachPlaceholder(item, path === '' ? key : `${path}.${key}`, visit);
		}
	}
};

/** A copy of a configuration with every placeholder replaced by what `resolve` gives for it */
const substitute = (value: unknown, resolve: (placeholder: Placeholder) => unknown): unknown => {
	const placeholder = readPlaceholder(value);

	if (placeholder) {
		return resolve(placeholder);
	}

	if (Array.isArray(value)) {
		return value.map((item) => substitute(item, resolve));
	}

	if (isRecord(value)) {
		return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, substitute(item, resolve)]));
	}

	return value;
};

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : 'unknown error');

const checkParameter = (parameter: AutomationTemplateParameter): string[] => {
	const problems: string[] = [];
	const prefix = `parameter ${parameter.id}: `;

	if ((parameter.type === 'duration' || parameter.type === 'number') && parameter.min > parameter.max) {
		problems.push(`${prefix}min must not be greater than max`);
	}

	// A default is used when the question is left unanswered, so it has to pass the rules an answer passes
	if (parameter.type !== 'property' && parameter.default !== undefined) {
		problems.push(
			...checkValueAnswer(parameter, parameter.default).map((issue) => `${prefix}default: ${issue.reason}`),
		);
	}

	return problems;
};

/**
 * The mistakes in a template the schema of the definition files does not catch: parameter bounds, identifiers
 * that are not unique, edges between nodes that do not exist, and placeholders that name no parameter or a field
 * the parameter does not have. Every parameter must be used by the graph. An empty list accepts the template.
 *
 * Whether the graph uses node types and ports that exist is checked against the registry by the caller.
 */
export const checkAutomationTemplate = (template: AutomationTemplate): string[] => {
	const problems: string[] = [];

	const parameters = new Map<string, AutomationTemplateParameter>();

	for (const parameter of template.parameters) {
		if (parameters.has(parameter.id)) {
			problems.push(`parameter ${parameter.id} is declared twice`);

			continue;
		}

		parameters.set(parameter.id, parameter);
		problems.push(...checkParameter(parameter));
	}

	const nodeIds = new Set<string>();

	for (const node of template.graph.nodes) {
		if (nodeIds.has(node.id)) {
			problems.push(`node ${node.id} is declared twice`);
		}

		nodeIds.add(node.id);
	}

	const edgeIds = new Set<string>();

	for (const edge of template.graph.edges) {
		if (edgeIds.has(edge.id)) {
			problems.push(`edge ${edge.id} is declared twice`);
		}

		edgeIds.add(edge.id);

		for (const end of [edge.source, edge.target]) {
			if (!nodeIds.has(end)) {
				problems.push(`edge ${edge.id} refers to node ${end}, which does not exist`);
			}
		}
	}

	const used = new Set<string>();

	for (const node of template.graph.nodes) {
		try {
			forEachPlaceholder(node.config, '', (placeholder, path) => {
				const at = `node ${node.id} config ${path || '(root)'}: `;
				const parameter = parameters.get(placeholder.parameter);

				if (!parameter) {
					problems.push(`${at}placeholder names parameter ${placeholder.parameter}, which is not declared`);

					return;
				}

				used.add(parameter.id);

				if (parameter.type === 'property') {
					if (
						placeholder.field === null ||
						!(AUTOMATION_TEMPLATE_PROPERTY_FIELDS as readonly string[]).includes(placeholder.field)
					) {
						problems.push(
							`${at}placeholder of property parameter ${parameter.id} must name one of ${AUTOMATION_TEMPLATE_PROPERTY_FIELDS.join(', ')}`,
						);
					}
				} else if (placeholder.field !== null) {
					problems.push(`${at}placeholder of ${parameter.type} parameter ${parameter.id} must not name a field`);
				}
			});
		} catch (error) {
			problems.push(`node ${node.id} config: ${errorMessage(error)}`);
		}
	}

	for (const parameter of template.parameters) {
		if (!used.has(parameter.id)) {
			problems.push(`parameter ${parameter.id} is not used by the graph`);
		}
	}

	return problems;
};

const STEP_TOLERANCE = 1e-6;

const isOnStep = (value: number, parameter: { min: number; step?: number }): boolean => {
	if (parameter.step === undefined) {
		return true;
	}

	const steps = (value - parameter.min) / parameter.step;

	return Math.abs(steps - Math.round(steps)) < STEP_TOLERANCE;
};

const readableOrWritable = (property: DevicePropertyInfo, parameter: AutomationTemplatePropertyParameter): boolean =>
	parameter.access === 'writable'
		? isWritable(property)
		: property.permissions.includes(PermissionType.READ_ONLY) ||
			property.permissions.includes(PermissionType.READ_WRITE);

const checkPropertyAnswer = async (
	parameter: AutomationTemplatePropertyParameter,
	value: unknown,
	findProperty: DevicePropertyLookup,
): Promise<AutomationTemplateParameterIssue[]> => {
	const field = `parameters.${parameter.id}`;

	if (!isRecord(value)) {
		return [{ field, reason: 'A device, a channel and a property must be chosen.' }];
	}

	const issues: AutomationTemplateParameterIssue[] = [];

	for (const part of AUTOMATION_TEMPLATE_PROPERTY_FIELDS) {
		if (typeof value[part] !== 'string' || !isUUID(value[part], '4')) {
			issues.push({ field: `${field}.${part}`, reason: `A ${part.replace('_id', '')} must be chosen.` });
		}
	}

	const extra = Object.keys(value).filter(
		(key) => !(AUTOMATION_TEMPLATE_PROPERTY_FIELDS as readonly string[]).includes(key),
	);

	if (extra.length > 0) {
		issues.push({ field, reason: 'Only a device, a channel and a property can be given.' });
	}

	if (issues.length > 0) {
		return issues;
	}

	const answer = value as unknown as AutomationTemplatePropertyValue;
	const property = await findProperty(answer.property_id);

	if (!property) {
		return [{ field: `${field}.property_id`, reason: 'The property does not exist.' }];
	}

	for (const problem of checkPropertyTarget(property, answer)) {
		issues.push({ field: `${field}.${problem.field}`, reason: problem.reason });
	}

	if (!readableOrWritable(property, parameter)) {
		issues.push({
			field: `${field}.property_id`,
			reason: parameter.access === 'writable' ? 'This property can not be set.' : 'This property can not be read.',
		});
	}

	if (
		parameter.channel_categories !== undefined &&
		!parameter.channel_categories.includes(property.channelCategory ?? '')
	) {
		issues.push({ field: `${field}.channel_id`, reason: 'This channel is not of a kind this question takes.' });
	}

	if (parameter.property_categories !== undefined && !parameter.property_categories.includes(property.category ?? '')) {
		issues.push({ field: `${field}.property_id`, reason: 'This property is not of a kind this question takes.' });
	}

	if (parameter.data_types !== undefined && !parameter.data_types.includes(property.dataType)) {
		issues.push({
			field: `${field}.property_id`,
			reason: 'This property holds a kind of value this question does not take.',
		});
	}

	return issues;
};

/** Checks the answer to a duration, number or text question; also what a default of one is checked with */
const checkValueAnswer = (
	parameter: Exclude<AutomationTemplateParameter, AutomationTemplatePropertyParameter>,
	value: unknown,
): AutomationTemplateParameterIssue[] => {
	const field = `parameters.${parameter.id}`;

	switch (parameter.type) {
		case 'duration':
			if (typeof value !== 'number' || !Number.isInteger(value)) {
				return [{ field, reason: 'The duration must be a whole number of seconds.' }];
			}

			return value < parameter.min || value > parameter.max
				? [{ field, reason: `The duration must be between ${parameter.min} and ${parameter.max} seconds.` }]
				: [];
		case 'number':
			if (typeof value !== 'number' || !Number.isFinite(value)) {
				return [{ field, reason: 'The answer must be a number.' }];
			}

			if (value < parameter.min || value > parameter.max) {
				return [{ field, reason: `The number must be between ${parameter.min} and ${parameter.max}.` }];
			}

			return isOnStep(value, parameter)
				? []
				: [{ field, reason: `The number must be a multiple of ${parameter.step} from ${parameter.min}.` }];
		case 'text':
			if (typeof value !== 'string' || value.trim() === '') {
				return [{ field, reason: 'A text is needed.' }];
			}

			return value.trim().length > parameter.max_length
				? [{ field, reason: `The text can be at most ${parameter.max_length} characters long.` }]
				: [];
	}
};

const checkAnswer = async (
	parameter: AutomationTemplateParameter,
	value: unknown,
	findProperty: DevicePropertyLookup,
): Promise<AutomationTemplateParameterIssue[]> =>
	parameter.type === 'property'
		? checkPropertyAnswer(parameter, value, findProperty)
		: checkValueAnswer(parameter, value);

const given = (value: unknown): boolean => value !== undefined && value !== null;

export interface AutomationTemplateAnswersCheck {
	/** The answers to use: the ones given, with the defaults of the questions left unanswered and texts trimmed */
	values: AutomationTemplateParameterValues;
	issues: AutomationTemplateParameterIssue[];
}

/**
 * Checks the answers to the questions of a template: every question needs an answer unless it has a default, an
 * answer must be of the kind and inside the bounds of its question, and a device property must exist, belong to
 * the channel and device given and be of the categories, data types and permission the question asks for.
 * Answers to questions the template does not ask are refused.
 */
export const checkAutomationTemplateAnswers = async (
	template: AutomationTemplate,
	answers: AutomationTemplateParameterValues,
	findProperty: DevicePropertyLookup,
): Promise<AutomationTemplateAnswersCheck> => {
	const issues: AutomationTemplateParameterIssue[] = [];
	const values: AutomationTemplateParameterValues = {};

	const declared = new Set(template.parameters.map((parameter) => parameter.id));

	for (const key of Object.keys(answers)) {
		if (!declared.has(key)) {
			issues.push({ field: `parameters.${key}`, reason: 'This template asks no such question.' });
		}
	}

	for (const parameter of template.parameters) {
		let answer: unknown = undefined;

		if (given(answers[parameter.id])) {
			answer = answers[parameter.id];
		} else if ('default' in parameter) {
			answer = parameter.default;
		}

		if (!given(answer)) {
			issues.push({ field: `parameters.${parameter.id}`, reason: 'An answer is needed.' });

			continue;
		}

		const found = await checkAnswer(parameter, answer, findProperty);

		if (found.length > 0) {
			issues.push(...found);

			continue;
		}

		values[parameter.id] = parameter.type === 'text' ? (answer as string).trim() : answer;
	}

	return { values, issues };
};

const SAMPLE_ID_PREFIX = '00000000-0000-4000-8000-';

/**
 * Answers to every question of a template that are of the right kind and inside the bounds, without pointing at
 * a real device: what a template is checked with when it is loaded.
 */
export const sampleAutomationTemplateAnswers = (template: AutomationTemplate): AutomationTemplateParameterValues => {
	const values: AutomationTemplateParameterValues = {};

	template.parameters.forEach((parameter, index) => {
		switch (parameter.type) {
			case 'property': {
				const id = (offset: number): string => `${SAMPLE_ID_PREFIX}${String(index * 3 + offset).padStart(12, '0')}`;

				values[parameter.id] = { device_id: id(1), channel_id: id(2), property_id: id(3) };

				break;
			}
			case 'duration':
			case 'number':
				values[parameter.id] = parameter.default ?? parameter.min;

				break;
			case 'text':
				// Trimmed, as a default is when it is used
				values[parameter.id] = parameter.default?.trim() ?? 'Text';

				break;
		}
	});

	return values;
};

/**
 * Generates the graph of an automation from a template and the answers to its questions (as checked by
 * `checkAutomationTemplateAnswers`). Every placeholder is replaced by its answer; the result names the template
 * nowhere.
 */
export const generateAutomationTemplateGraph = (
	template: AutomationTemplate,
	values: AutomationTemplateParameterValues,
): AutomationTemplateGraph => {
	const resolve = (placeholder: Placeholder): unknown => {
		if (!(placeholder.parameter in values)) {
			throw new Error(`No answer for parameter ${placeholder.parameter}`);
		}

		const value = values[placeholder.parameter];

		if (placeholder.field === null) {
			return value;
		}

		return (value as Record<AutomationTemplatePropertyField, unknown>)[
			placeholder.field as AutomationTemplatePropertyField
		];
	};

	return {
		version: AUTOMATION_GRAPH_VERSION,
		nodes: template.graph.nodes.map((node) => ({
			id: node.id,
			type: node.type,
			position: { x: node.position.x, y: node.position.y },
			config: substitute(node.config, resolve) as Record<string, unknown>,
		})),
		edges: template.graph.edges.map((edge) => ({
			id: edge.id,
			source: edge.source,
			source_port: edge.source_port,
			target: edge.target,
			target_port: edge.target_port,
		})),
	};
};
