import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { useBackend } from '../../../common';

import { useAutomationSuggestions } from './useAutomationSuggestions';

const mockFlash = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		useBackend: vi.fn(),
		useFlashMessage: vi.fn(() => mockFlash),
	};
});

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({ t: (key: string) => key }),
}));

// A new one for every test: a suggestion answered in one test stays answered for the page, as in the admin
let counter = 0;
let suggestionId = '';
const SPACE = 'b5f5f9a2-6a6c-4c0e-9d7f-1c1d3f1b2a02';

const graph = {
	version: 1,
	nodes: [
		{ id: 'n1', type: 'time.of-day', position: { x: 0, y: 0 }, config: { time: '19:00' } },
		{
			id: 'n2',
			type: 'device.property.set',
			position: { x: 360, y: 0 },
			config: { writes: [{ device_id: 'd', channel_id: 'c', property_id: 'p', value: true }] },
		},
	],
	edges: [{ id: 'e1', source: 'n1', source_port: 'out', target: 'n2', target_port: 'in' }],
};

const automationSuggestion = (overrides: Record<string, unknown> = {}) => ({
	id: suggestionId,
	type: 'pattern_automation_create',
	title: 'Automate this routine?',
	reason: 'You perform 2 actions in Living Room around 7 PM regularly.',
	space_id: SPACE,
	metadata: { sequenceHash: 'hash', draft: { name: 'Living Room Evening', mode: 'single', graph } },
	created_at: '2026-11-14T10:00:00.000Z',
	expires_at: '2026-11-15T10:00:00.000Z',
	...overrides,
});

describe('useAutomationSuggestions', () => {
	let get: Mock;
	let post: Mock;

	beforeEach(() => {
		vi.clearAllMocks();

		suggestionId = `b5f5f9a2-6a6c-4c0e-9d7f-${String(++counter).padStart(12, '0')}`;

		get = vi.fn().mockResolvedValue({ data: { data: [] } });
		post = vi.fn().mockResolvedValue({ data: { data: { success: true } } });

		(useBackend as Mock).mockReturnValue({ client: { GET: get, POST: post } });
	});

	it('offers only the automation suggestions, with their draft', async () => {
		get.mockResolvedValue({
			data: {
				data: [
					automationSuggestion(),
					{ ...automationSuggestion({ id: 'scene' }), type: 'pattern_scene_create', metadata: { sceneName: 'Evening' } },
					automationSuggestion({ id: 'broken', metadata: { draft: { name: 'No graph' } } }),
				],
			},
		});

		const { suggestions, fetchSuggestions, toDraft } = useAutomationSuggestions();

		await fetchSuggestions();

		expect(get).toHaveBeenCalledWith('/modules/buddy/suggestions');
		expect(suggestions.value).toEqual([
			{
				id: suggestionId,
				title: 'Automate this routine?',
				reason: 'You perform 2 actions in Living Room around 7 PM regularly.',
				spaceId: SPACE,
				draft: { name: 'Living Room Evening', mode: 'single', graph },
			},
		]);

		expect(toDraft(suggestions.value[0])).toEqual({
			name: 'Living Room Evening',
			mode: 'single',
			graph,
			spaceId: SPACE,
			suggestionId: suggestionId,
		});
	});

	it('offers none when the buddy module does not answer', async () => {
		get.mockResolvedValueOnce({ data: { data: [automationSuggestion()] } });

		const { suggestions, fetchSuggestions } = useAutomationSuggestions();

		await fetchSuggestions();

		expect(suggestions.value).toHaveLength(1);

		get.mockRejectedValueOnce(new Error('offline'));

		await fetchSuggestions();

		expect(suggestions.value).toEqual([]);

		get.mockResolvedValueOnce({ data: undefined, error: { error: { message: 'Not found' } } });

		await fetchSuggestions();

		expect(suggestions.value).toEqual([]);
	});

	it('tells Buddy a dismissed suggestion is not wanted and stops offering it', async () => {
		get.mockResolvedValue({ data: { data: [automationSuggestion()] } });

		const { suggestions, fetchSuggestions, dismiss } = useAutomationSuggestions();

		await fetchSuggestions();
		await dismiss(suggestionId);

		expect(post).toHaveBeenCalledWith('/modules/buddy/suggestions/{id}/feedback', {
			params: { path: { id: suggestionId } },
			body: { data: { feedback: 'dismissed' } },
		});
		expect(suggestions.value).toEqual([]);
		expect(mockFlash.error).not.toHaveBeenCalled();
	});

	it('keeps offering a suggestion that could not be dismissed and says so', async () => {
		get.mockResolvedValue({ data: { data: [automationSuggestion()] } });
		post.mockResolvedValue({ error: { error: { message: 'Not found' } } });

		const { suggestions, fetchSuggestions, dismiss, answering } = useAutomationSuggestions();

		await fetchSuggestions();

		const pending = dismiss(suggestionId);

		expect(answering.value).toEqual([suggestionId]);

		await pending;

		expect(answering.value).toEqual([]);
		expect(suggestions.value).toHaveLength(1);
		expect(mockFlash.error).toHaveBeenCalledWith('automations.suggestions.messages.notDismissed');
	});

	it('does not bring back a suggestion answered while the list was being read', async () => {
		get.mockResolvedValueOnce({ data: { data: [automationSuggestion()] } });

		const { suggestions, fetchSuggestions, dismiss } = useAutomationSuggestions();

		await fetchSuggestions();

		// A read on its way captured the suggestion while it was still active
		let answer: (value: unknown) => void = () => {};

		get.mockReturnValueOnce(
			new Promise((resolve) => {
				answer = resolve;
			})
		);

		const reading = fetchSuggestions();

		await dismiss(suggestionId);

		answer({ data: { data: [automationSuggestion(), automationSuggestion({ id: 'other' })] } });

		await reading;

		expect(suggestions.value.map((suggestion) => suggestion.id)).toEqual(['other']);
	});

	it('marks a suggestion applied once its automation is created', async () => {
		get.mockResolvedValue({ data: { data: [automationSuggestion()] } });

		const { suggestions, fetchSuggestions, markApplied } = useAutomationSuggestions();

		await fetchSuggestions();
		await markApplied(suggestionId);

		expect(post).toHaveBeenCalledWith('/modules/buddy/suggestions/{id}/feedback', {
			params: { path: { id: suggestionId } },
			body: { data: { feedback: 'applied' } },
		});
		expect(suggestions.value).toEqual([]);
	});
});
