import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { DefinitionSource } from '../../../common/definitions/definition-loader';
import { AutomationMode } from '../automations.constants';
import {
	AUTOMATION_TEMPLATE_PARAMETER_TYPES,
	AUTOMATION_TEMPLATE_PROPERTY_ACCESS,
	AutomationTemplateParameter,
	AutomationTemplateParameterType,
	AutomationTemplatePropertyAccess,
} from '../templates/automation-template.types';
import { LoadedAutomationTemplate } from '../templates/automation-templates.service';
import { AutomationTemplateDraft } from '../templates/template-generator';

import { AutomationGraphModel } from './automation-graph.model';

/**
 * One question a template asks. Which of the optional fields are set depends on the type of the question.
 */
@ApiSchema({ name: 'AutomationsModuleDataTemplateParameter' })
export class AutomationTemplateParameterModel {
	@ApiProperty({
		description: 'Parameter identifier, unique within the template; the key of its answer',
		type: 'string',
		example: 'motion',
	})
	@Expose()
	id: string;

	@ApiProperty({
		description:
			'What is asked: `property` a device property, answered with its `device_id`, `channel_id` and `property_id`; `duration` a whole number of seconds; `number` a number; `text` a plain text.',
		enum: AUTOMATION_TEMPLATE_PARAMETER_TYPES,
		example: 'property',
	})
	@Expose()
	type: AutomationTemplateParameterType;

	@ApiProperty({ description: 'The question, in English', type: 'string', example: 'Motion sensor' })
	@Expose()
	label: string;

	@ApiPropertyOptional({
		description: 'A hint shown with the question, in English',
		type: 'string',
		example: 'The sensor that detects motion or presence.',
	})
	@Expose()
	description?: string;

	@ApiPropertyOptional({
		description: 'For `property`: whether the property is watched (`readable`) or set (`writable`)',
		enum: AUTOMATION_TEMPLATE_PROPERTY_ACCESS,
		example: 'readable',
	})
	@Expose()
	access?: AutomationTemplatePropertyAccess;

	@ApiPropertyOptional({
		name: 'channel_categories',
		description: 'For `property`: the channel categories the property may belong to; any when left out',
		type: 'array',
		items: { type: 'string' },
		example: ['motion', 'occupancy'],
	})
	@Expose()
	channel_categories?: string[];

	@ApiPropertyOptional({
		name: 'property_categories',
		description: 'For `property`: the property categories taken; any when left out',
		type: 'array',
		items: { type: 'string' },
		example: ['detected'],
	})
	@Expose()
	property_categories?: string[];

	@ApiPropertyOptional({
		name: 'data_types',
		description: 'For `property`: the data types taken; any when left out',
		type: 'array',
		items: { type: 'string' },
		example: ['bool'],
	})
	@Expose()
	data_types?: string[];

	@ApiPropertyOptional({
		description: 'For `duration` (in seconds) and `number`: the smallest answer taken',
		type: 'number',
		example: 10,
	})
	@Expose()
	min?: number;

	@ApiPropertyOptional({
		description: 'For `duration` (in seconds) and `number`: the largest answer taken',
		type: 'number',
		example: 86400,
	})
	@Expose()
	max?: number;

	@ApiPropertyOptional({
		description: 'For `number`: an answer must be a multiple of the step from `min`',
		type: 'number',
		example: 0.5,
	})
	@Expose()
	step?: number;

	@ApiPropertyOptional({ description: 'For `number`: the unit of the answer', type: 'string', example: '°C' })
	@Expose()
	unit?: string;

	@ApiPropertyOptional({
		name: 'max_length',
		description: 'For `text`: the longest answer taken, in characters',
		type: 'number',
		example: 120,
	})
	@Expose()
	max_length?: number;

	@ApiPropertyOptional({
		description:
			'The answer used when none is given: a number for `duration` and `number`, a text in English for `text`. A question without a default must be answered; a `property` question has none.',
		oneOf: [{ type: 'number' }, { type: 'string' }],
		example: 120,
	})
	@Expose()
	default?: number | string;
}

/**
 * One entry of the template catalogue
 */
@ApiSchema({ name: 'AutomationsModuleDataTemplate' })
export class AutomationTemplateModel {
	@ApiProperty({ description: 'Template identifier', type: 'string', example: 'motion-light' })
	@Expose()
	id: string;

	@ApiProperty({ description: 'Human-facing name in English', type: 'string', example: 'Motion light' })
	@Expose()
	name: string;

	@ApiProperty({
		description: 'Human-facing description in English',
		type: 'string',
		example: 'Turns a light on when motion is detected and off again once no motion was seen for a while.',
	})
	@Expose()
	description: string;

	@ApiProperty({ description: 'Icon of the template', type: 'string', nullable: true, example: 'mdi:motion-sensor' })
	@Expose()
	icon: string | null;

	@ApiProperty({
		description: 'The run mode of the automation the template creates',
		enum: AutomationMode,
		example: AutomationMode.PARALLEL,
	})
	@Expose()
	mode: AutomationMode;

	@ApiProperty({
		description:
			'Where the template comes from: `builtin` is shipped with the backend, `user` is a file of the configuration directory, which may replace a built-in template with the same identifier. Only a built-in template is the one a client may know and translate by its identifier; the texts of a user template are shown as given.',
		enum: ['builtin', 'user'],
		example: 'builtin',
	})
	@Expose()
	source: DefinitionSource;

	@ApiProperty({
		description: 'The questions the template asks, in the order they are asked',
		type: 'array',
		items: { $ref: getSchemaPath(AutomationTemplateParameterModel) },
	})
	@Expose()
	@Type(() => AutomationTemplateParameterModel)
	parameters: AutomationTemplateParameterModel[];
}

/**
 * The draft of a new automation generated from a template. It is not stored: an automation is created from it
 * the ordinary way, and nothing in it refers back to the template.
 */
@ApiSchema({ name: 'AutomationsModuleDataTemplateDraft' })
export class AutomationTemplateDraftModel {
	@ApiProperty({
		description: 'Suggested name of the automation, in English',
		type: 'string',
		example: 'Motion light',
	})
	@Expose()
	name: string;

	@ApiProperty({
		description: 'The run mode the automation should be created with',
		enum: AutomationMode,
		example: AutomationMode.PARALLEL,
	})
	@Expose()
	mode: AutomationMode;

	@ApiProperty({
		description: 'The generated graph, with every answer in place',
		type: () => AutomationGraphModel,
	})
	@Expose()
	@Type(() => AutomationGraphModel)
	graph: AutomationGraphModel;
}

const createParameterModel = (parameter: AutomationTemplateParameter): AutomationTemplateParameterModel => {
	const model = new AutomationTemplateParameterModel();

	model.id = parameter.id;
	model.type = parameter.type;
	model.label = parameter.label;

	if (parameter.description !== undefined) model.description = parameter.description;

	switch (parameter.type) {
		case 'property':
			model.access = parameter.access;

			if (parameter.channel_categories) model.channel_categories = [...parameter.channel_categories];
			if (parameter.property_categories) model.property_categories = [...parameter.property_categories];
			if (parameter.data_types) model.data_types = [...parameter.data_types];

			break;
		case 'duration':
			model.min = parameter.min;
			model.max = parameter.max;

			if (parameter.default !== undefined) model.default = parameter.default;

			break;
		case 'number':
			model.min = parameter.min;
			model.max = parameter.max;

			if (parameter.step !== undefined) model.step = parameter.step;
			if (parameter.unit !== undefined) model.unit = parameter.unit;
			if (parameter.default !== undefined) model.default = parameter.default;

			break;
		case 'text':
			model.max_length = parameter.max_length;

			if (parameter.default !== undefined) model.default = parameter.default;

			break;
	}

	return model;
};

export const createAutomationTemplateModel = ({
	template,
	source,
}: LoadedAutomationTemplate): AutomationTemplateModel => {
	const model = new AutomationTemplateModel();

	model.id = template.id;
	model.name = template.name;
	model.description = template.description;
	model.icon = template.icon ?? null;
	model.mode = template.mode as AutomationMode;
	model.source = source;
	model.parameters = template.parameters.map(createParameterModel);

	return model;
};

export const createAutomationTemplateDraftModel = (draft: AutomationTemplateDraft): AutomationTemplateDraftModel => {
	const model = new AutomationTemplateDraftModel();

	model.name = draft.name;
	model.mode = draft.mode as AutomationMode;
	model.graph = draft.graph;

	return model;
};
