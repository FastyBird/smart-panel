import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import {
	AUTOMATION_GRAPH_INVALID_ERROR_CODE,
	AUTOMATION_TEMPLATE_PARAMETERS_INVALID_ERROR_CODE,
} from '../automations.constants';
import {
	AutomationsGraphValidationException,
	AutomationsTemplateNotFoundException,
	AutomationsTemplateParametersException,
} from '../automations.exceptions';
import { AutomationTemplate } from '../templates/automation-template.types';
import { AutomationTemplatesService } from '../templates/automation-templates.service';

import { AutomationTemplatesController } from './templates.controller';

const TEMPLATE: AutomationTemplate = {
	id: 'leak-alarm',
	name: 'Leak alarm',
	description: 'Sends a notification when water is detected.',
	icon: 'mdi:water-alert',
	mode: 'restart',
	parameters: [
		{
			id: 'leak',
			type: 'property',
			label: 'Leak sensor',
			access: 'readable',
			channel_categories: ['leak'],
			property_categories: ['detected'],
		},
		{ id: 'wait', type: 'duration', label: 'Wait', min: 10, max: 600, default: 60 },
		{ id: 'level', type: 'number', label: 'Level', min: 5, max: 30, step: 0.5, unit: '°C' },
		{ id: 'title', type: 'text', label: 'Title', description: 'Shown first.', max_length: 120, default: 'Leak' },
	],
	graph: { nodes: [], edges: [] },
};

const GRAPH = { version: 1, nodes: [], edges: [] };

describe('AutomationTemplatesController', () => {
	let generate: jest.Mock;
	let catalog: { template: AutomationTemplate; source: string; path: string; overridesBuiltin: boolean }[];
	let controller: AutomationTemplatesController;

	beforeEach(() => {
		generate = jest.fn(() => Promise.resolve({ name: 'Leak alarm', mode: 'restart', graph: GRAPH }));

		catalog = [{ template: TEMPLATE, source: 'builtin', path: 'x.yaml', overridesBuiltin: false }];

		const templates = {
			catalog: () => ({ templates: catalog }),
			generate,
		};

		controller = new AutomationTemplatesController(templates as unknown as AutomationTemplatesService);
	});

	it('lists the templates with the fields of each kind of question and without the graph', () => {
		const [template] = controller.findAll().data;

		expect(template).toEqual({
			id: 'leak-alarm',
			name: 'Leak alarm',
			description: 'Sends a notification when water is detected.',
			icon: 'mdi:water-alert',
			mode: 'restart',
			source: 'builtin',
			parameters: [
				{
					id: 'leak',
					type: 'property',
					label: 'Leak sensor',
					access: 'readable',
					channel_categories: ['leak'],
					property_categories: ['detected'],
				},
				{ id: 'wait', type: 'duration', label: 'Wait', min: 10, max: 600, default: 60 },
				{ id: 'level', type: 'number', label: 'Level', min: 5, max: 30, step: 0.5, unit: '°C' },
				{ id: 'title', type: 'text', label: 'Title', description: 'Shown first.', max_length: 120, default: 'Leak' },
			],
		});
		expect(template).not.toHaveProperty('graph');
	});

	it('says a template replaced from the configuration directory is not the built-in one', () => {
		catalog = [{ template: TEMPLATE, source: 'user', path: 'module.automations.x.yaml', overridesBuiltin: true }];

		expect(controller.findAll().data[0].source).toBe('user');
	});

	it('answers the generated draft', async () => {
		const response = await controller.generate('leak-alarm', { data: { parameters: { wait: 60 } } });

		expect(generate).toHaveBeenCalledWith('leak-alarm', { wait: 60 });
		expect(response.data).toEqual({ name: 'Leak alarm', mode: 'restart', graph: GRAPH });
	});

	it('answers 404 for a template that does not exist', async () => {
		generate.mockRejectedValueOnce(new AutomationsTemplateNotFoundException('missing'));

		await expect(controller.generate('missing', { data: { parameters: {} } })).rejects.toBeInstanceOf(
			NotFoundException,
		);
	});

	it('answers 422 with the issues of refused answers', async () => {
		const issues = [{ field: 'parameters.leak', reason: 'An answer is needed.' }];

		generate.mockRejectedValueOnce(new AutomationsTemplateParametersException('refused', issues));

		const error = (await controller
			.generate('leak-alarm', { data: { parameters: {} } })
			.catch((e: unknown) => e)) as UnprocessableEntityException;

		expect(error).toBeInstanceOf(UnprocessableEntityException);
		expect(error.getResponse()).toEqual({
			code: AUTOMATION_TEMPLATE_PARAMETERS_INVALID_ERROR_CODE,
			message: 'refused',
			issues,
		});
	});

	it('answers 422 with the graph issues of a graph that could not be saved', async () => {
		const issues = [
			{ severity: 'error' as const, code: 'invalid_config' as const, message: 'No.', node_id: 'n1', blocking: true },
		];

		generate.mockRejectedValueOnce(new AutomationsGraphValidationException('invalid', issues));

		const error = (await controller
			.generate('leak-alarm', { data: { parameters: {} } })
			.catch((e: unknown) => e)) as UnprocessableEntityException;

		expect(error.getResponse()).toEqual({ code: AUTOMATION_GRAPH_INVALID_ERROR_CODE, message: 'invalid', issues });
	});
});
