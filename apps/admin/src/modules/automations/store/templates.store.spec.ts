import { createPinia, setActivePinia } from 'pinia';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AutomationMode, AutomationTemplateParameterType } from '../automations.constants';
import {
	AutomationsApiException,
	AutomationsGraphInvalidException,
	AutomationsTemplateParametersException,
	AutomationsValidationException,
} from '../automations.exceptions';

import { useAutomationTemplatesStore } from './templates.store';
import type { IAutomationTemplateRes } from './templates.store.types';

const mockBackendClient = {
	GET: vi.fn(),
	POST: vi.fn(),
};

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	const silent = { error: vi.fn(), info: vi.fn(), warning: vi.fn(), log: vi.fn(), debug: vi.fn() };

	return {
		...actual,
		useBackend: vi.fn(() => ({ client: mockBackendClient })),
		useLogger: vi.fn(() => silent),
		logger: silent,
	};
});

const DEVICE = 'b5f5f9a2-6a6c-4c0e-9d7f-1c1d3f1b2a01';
const CHANNEL = 'b5f5f9a2-6a6c-4c0e-9d7f-1c1d3f1b2a02';
const PROPERTY = 'b5f5f9a2-6a6c-4c0e-9d7f-1c1d3f1b2a03';

const templateRes = (): IAutomationTemplateRes => ({
	id: 'motion-light',
	name: 'Motion light',
	description: 'Turns a light on when motion is detected.',
	icon: 'mdi:motion-sensor',
	mode: AutomationMode.parallel,
	parameters: [
		{
			id: 'motion',
			type: AutomationTemplateParameterType.property,
			label: 'Motion sensor',
			access: 'readable' as IAutomationTemplateRes['parameters'][number]['access'],
			channel_categories: ['motion', 'occupancy'],
			property_categories: ['detected'],
			data_types: ['bool'],
		},
		{ id: 'off_after', type: AutomationTemplateParameterType.duration, label: 'Off after', min: 10, max: 86400, default: 120 },
		{ id: 'title', type: AutomationTemplateParameterType.text, label: 'Title', max_length: 120, default: 'Hello' },
	],
});

const draftRes = {
	name: 'Motion light',
	mode: AutomationMode.parallel,
	graph: {
		version: 1,
		nodes: [{ id: 'n1', type: 'device.property.changed', position: { x: 0, y: 0 }, config: { property_id: PROPERTY, for_seconds: 120 } }],
		edges: [],
	},
};

const refused = (code: string, issues: unknown[]) => ({
	data: undefined,
	error: { error: { code: 'UnprocessableEntity', message: 'Refused', details: { reason: 'Refused', code, issues } } },
	response: { status: 422 },
});

describe('useAutomationTemplatesStore', () => {
	let store: ReturnType<typeof useAutomationTemplatesStore>;

	beforeEach(() => {
		vi.clearAllMocks();

		setActivePinia(createPinia());

		store = useAutomationTemplatesStore();
	});

	describe('fetch', () => {
		it('reads the catalogue and keeps each question with its fields in camel case', async () => {
			mockBackendClient.GET.mockResolvedValue({ data: { data: [templateRes()] }, response: { status: 200 } });

			const templates = await store.fetch();

			expect(mockBackendClient.GET).toHaveBeenCalledWith('/modules/automations/templates');
			expect(store.firstLoadFinished()).toBe(true);
			expect(templates).toHaveLength(1);
			expect(store.findById('motion-light')?.parameters).toEqual([
				expect.objectContaining({
					id: 'motion',
					type: 'property',
					access: 'readable',
					channelCategories: ['motion', 'occupancy'],
					propertyCategories: ['detected'],
					dataTypes: ['bool'],
					default: null,
				}),
				expect.objectContaining({ id: 'off_after', min: 10, max: 86400, default: 120, channelCategories: [] }),
				expect.objectContaining({ id: 'title', maxLength: 120, default: 'Hello' }),
			]);
		});

		it('shares one read between callers', async () => {
			mockBackendClient.GET.mockResolvedValue({ data: { data: [] }, response: { status: 200 } });

			await Promise.all([store.fetch(), store.fetch()]);

			expect(mockBackendClient.GET).toHaveBeenCalledTimes(1);
		});

		it('fails with an API exception when the backend refuses', async () => {
			mockBackendClient.GET.mockResolvedValue({ data: undefined, error: { error: { code: 'Forbidden', message: 'No' } }, response: { status: 403 } });

			await expect(store.fetch()).rejects.toBeInstanceOf(AutomationsApiException);
			expect(store.firstLoadFinished()).toBe(false);
		});
	});

	describe('generate', () => {
		const parameters = { motion: { device_id: DEVICE, channel_id: CHANNEL, property_id: PROPERTY }, off_after: 120 };

		it('sends the answers as given and returns the draft with its graph untouched', async () => {
			mockBackendClient.POST.mockResolvedValue({ data: { data: draftRes }, response: { status: 200 } });

			const draft = await store.generate({ id: 'motion-light', parameters });

			expect(mockBackendClient.POST).toHaveBeenCalledWith('/modules/automations/templates/{id}/generate', {
				params: { path: { id: 'motion-light' } },
				body: { data: { parameters } },
			});
			expect(draft).toEqual(draftRes);
			expect(store.generating('motion-light')).toBe(false);
		});

		it('tells refused answers apart, with an issue per question', async () => {
			const issues = [{ field: 'parameters.off_after', reason: 'The duration must be between 10 and 86400 seconds.' }];

			mockBackendClient.POST.mockResolvedValue(refused('automation-template-parameters-invalid', issues));

			const error = await store.generate({ id: 'motion-light', parameters }).catch((e: unknown) => e);

			expect(error).toBeInstanceOf(AutomationsTemplateParametersException);
			expect((error as AutomationsTemplateParametersException).issues).toEqual(issues);
		});

		it('tells a generated graph the backend would not save apart', async () => {
			mockBackendClient.POST.mockResolvedValue(
				refused('automation-graph-invalid', [{ severity: 'error', code: 'invalid_config', message: 'No.', node_id: 'n1', blocking: true }])
			);

			const error = await store.generate({ id: 'motion-light', parameters }).catch((e: unknown) => e);

			expect(error).toBeInstanceOf(AutomationsGraphInvalidException);
			expect((error as AutomationsGraphInvalidException).issues).toHaveLength(1);
		});

		it('fails with a plain API exception for a template that does not exist', async () => {
			mockBackendClient.POST.mockResolvedValue({
				data: undefined,
				error: { error: { code: 'NotFound', message: 'Not found' } },
				response: { status: 404 },
			});

			const error = await store.generate({ id: 'missing', parameters: {} }).catch((e: unknown) => e);

			expect(error).toBeInstanceOf(AutomationsApiException);
			expect((error as AutomationsApiException).code).toBe(404);
		});

		it('refuses a payload without a template', async () => {
			await expect(store.generate({ id: '', parameters: {} })).rejects.toBeInstanceOf(AutomationsValidationException);
			expect(mockBackendClient.POST).not.toHaveBeenCalled();
		});
	});
});
