import { nextTick, ref } from 'vue';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import { AutomationMode, AutomationTemplateParameterType, AutomationTemplateSource } from '../automations.constants';
import { AutomationsApiException, AutomationsGraphInvalidException, AutomationsTemplateParametersException } from '../automations.exceptions';
import type { IAutomationTemplate } from '../store/templates.store.types';

import { useAutomationTemplateForm } from './useAutomationTemplateForm';
import { useAutomationTemplates } from './useAutomationTemplates';

const mockFlash = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
		useFlashMessage: vi.fn(() => mockFlash),
	};
});

// Only the motion light is translated, as a template the admin knows; the other one is a user's own
const messages: Record<string, string> = {
	'automations.templates.items.motion-light.name': 'Pohybové světlo',
	'automations.templates.items.motion-light.parameters.title.label': 'Nadpis',
	'automations.templates.items.motion-light.parameters.title.default': 'Ahoj',
};

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: (key: string) => messages[key] ?? key,
		te: (key: string) => key in messages,
	}),
}));

const DEVICE = 'b5f5f9a2-6a6c-4c0e-9d7f-1c1d3f1b2a01';
const CHANNEL = 'b5f5f9a2-6a6c-4c0e-9d7f-1c1d3f1b2a02';
const PROPERTY = 'b5f5f9a2-6a6c-4c0e-9d7f-1c1d3f1b2a03';

const parameter = (overrides: Partial<IAutomationTemplate['parameters'][number]>): IAutomationTemplate['parameters'][number] => ({
	id: 'x',
	type: AutomationTemplateParameterType.text,
	label: 'X',
	description: null,
	access: null,
	channelCategories: [],
	propertyCategories: [],
	dataTypes: [],
	min: null,
	max: null,
	step: null,
	unit: null,
	maxLength: null,
	default: null,
	...overrides,
});

const motionLight = (): IAutomationTemplate => ({
	id: 'motion-light',
	name: 'Motion light',
	description: 'Turns a light on.',
	icon: null,
	mode: AutomationMode.parallel,
	source: AutomationTemplateSource.builtin,
	parameters: [
		parameter({ id: 'motion', type: AutomationTemplateParameterType.property, label: 'Motion sensor', access: 'readable' }),
		parameter({ id: 'off_after', type: AutomationTemplateParameterType.duration, label: 'Off after', min: 10, max: 600, default: 120 }),
		parameter({ id: 'level', type: AutomationTemplateParameterType.number, label: 'Level', min: 5, max: 30 }),
		parameter({ id: 'title', type: AutomationTemplateParameterType.text, label: 'Title', maxLength: 20, default: 'Hello' }),
	],
});

const userTemplate = (): IAutomationTemplate => ({
	...motionLight(),
	id: 'my-own',
	name: 'My own',
	source: AutomationTemplateSource.user,
	parameters: [parameter({ id: 'title', label: 'Title', maxLength: 20, default: 'Hello' })],
});

const draft = { name: 'Motion light', mode: AutomationMode.parallel, graph: { version: 1, nodes: [], edges: [] } };

describe('useAutomationTemplates', () => {
	beforeEach(() => {
		(injectStoresManager as Mock).mockReturnValue({
			getStore: () => ({ findAll: () => [userTemplate(), motionLight()], fetching: () => false, firstLoadFinished: () => true }),
		});
	});

	it('shows a template the admin knows translated and the others in the English of the backend', () => {
		const { templates, templateName, parameterLabel, parameterDefault } = useAutomationTemplates();

		expect(templates.value.map(templateName)).toEqual(['My own', 'Pohybové světlo']);

		const [mine, known] = templates.value;

		expect(parameterLabel(known, known.parameters[3])).toBe('Nadpis');
		expect(parameterDefault(known, known.parameters[3])).toBe('Ahoj');
		expect(parameterLabel(mine, mine.parameters[0])).toBe('Title');
		expect(parameterDefault(mine, mine.parameters[0])).toBe('Hello');
		expect(parameterDefault(known, known.parameters[1])).toBe(120);
	});

	it('shows a user template that replaces a built-in one as given, not with the texts of the built-in one', () => {
		const replaced: IAutomationTemplate = {
			...motionLight(),
			source: AutomationTemplateSource.user,
			name: 'Hallway light',
			parameters: [parameter({ id: 'title', label: 'Heading', maxLength: 20, default: 'Custom' })],
		};

		(injectStoresManager as Mock).mockReturnValue({
			getStore: () => ({ findAll: () => [replaced], fetching: () => false, firstLoadFinished: () => true }),
		});

		const { templates, templateName, parameterLabel, parameterDefault } = useAutomationTemplates();

		const [template] = templates.value;

		expect(templateName(template)).toBe('Hallway light');
		expect(parameterLabel(template, template.parameters[0])).toBe('Heading');
		expect(parameterDefault(template, template.parameters[0])).toBe('Custom');
	});

	it('says when the catalogue could not be read', async () => {
		(injectStoresManager as Mock).mockReturnValue({
			getStore: () => ({
				findAll: () => [],
				fetching: () => false,
				firstLoadFinished: () => false,
				fetch: vi.fn().mockRejectedValue(new Error('offline')),
			}),
		});

		const { fetchTemplates, loadFailed } = useAutomationTemplates();

		await fetchTemplates();

		expect(loadFailed.value).toBe(true);
	});
});

describe('useAutomationTemplateForm', () => {
	let generate: Mock;

	beforeEach(() => {
		vi.clearAllMocks();

		generate = vi.fn().mockResolvedValue(draft);

		(injectStoresManager as Mock).mockReturnValue({
			getStore: () => ({ findAll: () => [], fetching: () => false, firstLoadFinished: () => true, generate }),
		});
	});

	const answerProperty = (form: ReturnType<typeof useAutomationTemplateForm>): void => {
		form.setPropertyAnswer('motion', { device_id: DEVICE, channel_id: undefined, property_id: undefined });
		form.setPropertyAnswer('motion', { channel_id: CHANNEL, property_id: undefined });
		form.setPropertyAnswer('motion', { property_id: PROPERTY });
	};

	it('starts from the defaults, translated for a text, and is complete once every question is answered', () => {
		const form = useAutomationTemplateForm({ template: ref(motionLight()) });

		expect(form.answers.value).toEqual({
			motion: { device_id: null, channel_id: null, property_id: null },
			off_after: 120,
			level: undefined,
			title: 'Ahoj',
		});
		expect(form.complete.value).toBe(false);

		answerProperty(form);

		expect(form.propertyAnswer('motion')).toEqual({ device_id: DEVICE, channel_id: CHANNEL, property_id: PROPERTY });
		expect(form.complete.value).toBe(false);

		form.setAnswer('level', 20);

		expect(form.complete.value).toBe(true);

		form.setAnswer('title', '   ');

		expect(form.complete.value).toBe(false);
	});

	it('clears the channel and the property when another device is picked', () => {
		const form = useAutomationTemplateForm({ template: ref(motionLight()) });

		answerProperty(form);

		form.setPropertyAnswer('motion', { device_id: CHANNEL, channel_id: undefined, property_id: undefined });

		expect(form.propertyAnswer('motion')).toEqual({ device_id: CHANNEL, channel_id: null, property_id: null });
	});

	it('starts again when another template is picked', async () => {
		const template = ref<IAutomationTemplate | null>(motionLight());

		const form = useAutomationTemplateForm({ template });

		form.setAnswer('level', 20);

		template.value = userTemplate();

		await nextTick();

		expect(form.answers.value).toEqual({ title: 'Hello' });
	});

	it('generates the draft with the answers given and the name the template is shown with', async () => {
		const form = useAutomationTemplateForm({ template: ref(motionLight()) });

		answerProperty(form);
		form.setAnswer('level', 20);

		const result = await form.submit();

		expect(generate).toHaveBeenCalledWith({
			id: 'motion-light',
			parameters: {
				motion: { device_id: DEVICE, channel_id: CHANNEL, property_id: PROPERTY },
				off_after: 120,
				level: 20,
				title: 'Ahoj',
			},
		});
		expect(result).toEqual({ ...draft, name: 'Pohybové světlo' });
	});

	it('shows refused answers at their questions and forgets them once answered again', async () => {
		generate.mockRejectedValueOnce(
			new AutomationsTemplateParametersException('Refused', [
				{ field: 'parameters.motion.property_id', reason: 'This property is not of a kind this question takes.' },
				{ field: 'parameters.level', reason: 'The number must be between 5 and 30.' },
				{ field: 'parameters.surprise', reason: 'This template asks no such question.' },
			])
		);

		const form = useAutomationTemplateForm({ template: ref(motionLight()) });

		answerProperty(form);
		form.setAnswer('level', 20);

		expect(await form.submit()).toBeNull();

		expect(form.errorsAt('motion')).toEqual(['This property is not of a kind this question takes.']);
		expect(form.errorsAt('level')).toEqual(['The number must be between 5 and 30.']);
		expect(form.otherErrors.value).toEqual(['This template asks no such question.']);
		expect(mockFlash.error).toHaveBeenCalledWith('automations.templates.messages.invalidAnswers');

		form.setAnswer('level', 21);

		expect(form.errorsAt('level')).toEqual([]);
		expect(form.errorsAt('motion')).toHaveLength(1);
	});

	it.each([
		[new AutomationsGraphInvalidException('Invalid', []), 'automations.templates.messages.invalidGraph'],
		[new AutomationsApiException('Offline', null), 'automations.templates.messages.notGenerated'],
	])('says why nothing was generated', async (error, message) => {
		generate.mockRejectedValueOnce(error);

		const form = useAutomationTemplateForm({ template: ref(motionLight()) });

		expect(await form.submit()).toBeNull();
		expect(mockFlash.error).toHaveBeenCalledWith(message);
		expect(form.submitting.value).toBe(false);
	});
});
