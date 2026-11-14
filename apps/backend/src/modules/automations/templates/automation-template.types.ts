/**
 * The shape of an automation template as it is written in a YAML definition file.
 *
 * A template asks a few questions (its parameters) and holds a graph whose node configurations may put a
 * placeholder - `{ $param: <parameter id> }`, or `{ $param: <parameter id>.<field> }` for a part of a device
 * property - where an answer goes. Generating an automation from a template replaces every placeholder with the
 * answer and gives back an ordinary graph: nothing in it, and nothing stored with the automation, refers back to
 * the template (design § Templates).
 *
 * Framework-free (ADR 0003, decision 15).
 */

export const AUTOMATION_TEMPLATE_PARAMETER_TYPES = ['property', 'duration', 'number', 'text'] as const;

export type AutomationTemplateParameterType = (typeof AUTOMATION_TEMPLATE_PARAMETER_TYPES)[number];

export const AUTOMATION_TEMPLATE_PROPERTY_ACCESS = ['readable', 'writable'] as const;

export type AutomationTemplatePropertyAccess = (typeof AUTOMATION_TEMPLATE_PROPERTY_ACCESS)[number];

/** The parts of a device property answer a placeholder can take */
export const AUTOMATION_TEMPLATE_PROPERTY_FIELDS = ['device_id', 'channel_id', 'property_id'] as const;

export type AutomationTemplatePropertyField = (typeof AUTOMATION_TEMPLATE_PROPERTY_FIELDS)[number];

/** The key of a placeholder object */
export const AUTOMATION_TEMPLATE_PLACEHOLDER_KEY = '$param';

interface AutomationTemplateParameterBase {
	/** Unique within the template; the key of the answer */
	id: string;
	/** The question, in plain English; translating it is the job of the admin */
	label: string;
	/** A hint shown with the question, in plain English */
	description?: string;
}

/** Pick a device property: the answer is its device, channel and property ids */
export interface AutomationTemplatePropertyParameter extends AutomationTemplateParameterBase {
	type: 'property';
	/** `readable` for what is watched, `writable` for what is set */
	access: AutomationTemplatePropertyAccess;
	/** Channel categories the property may belong to; any when left out */
	channel_categories?: string[];
	/** Property categories offered; any when left out */
	property_categories?: string[];
	/** Data types offered; any when left out */
	data_types?: string[];
}

/** A duration in whole seconds */
export interface AutomationTemplateDurationParameter extends AutomationTemplateParameterBase {
	type: 'duration';
	min: number;
	max: number;
	default?: number;
}

/** A number, such as a temperature */
export interface AutomationTemplateNumberParameter extends AutomationTemplateParameterBase {
	type: 'number';
	min: number;
	max: number;
	step?: number;
	unit?: string;
	default?: number;
}

/** A plain text, such as the title of a notification */
export interface AutomationTemplateTextParameter extends AutomationTemplateParameterBase {
	type: 'text';
	max_length: number;
	default?: string;
}

export type AutomationTemplateParameter =
	| AutomationTemplatePropertyParameter
	| AutomationTemplateDurationParameter
	| AutomationTemplateNumberParameter
	| AutomationTemplateTextParameter;

export interface AutomationTemplateGraphNode {
	id: string;
	type: string;
	position: { x: number; y: number };
	config: Record<string, unknown>;
}

export interface AutomationTemplateGraphEdge {
	id: string;
	source: string;
	source_port: string;
	target: string;
	target_port: string;
}

export interface AutomationTemplate {
	id: string;
	/** In plain English; translating it is the job of the admin */
	name: string;
	description: string;
	icon?: string;
	/** The run mode of the automation the template creates */
	mode: 'single' | 'restart' | 'parallel';
	parameters: AutomationTemplateParameter[];
	graph: {
		nodes: AutomationTemplateGraphNode[];
		edges: AutomationTemplateGraphEdge[];
	};
}

/** The answers to the questions of a template, by parameter id */
export type AutomationTemplateParameterValues = Record<string, unknown>;

/** The answer to a device property question */
export interface AutomationTemplatePropertyValue {
	device_id: string;
	channel_id: string;
	property_id: string;
}
