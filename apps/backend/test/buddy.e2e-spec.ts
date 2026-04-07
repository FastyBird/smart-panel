/*
eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
*/
import { useContainer } from 'class-validator';
import request from 'supertest';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AppModule } from '../src/app.module';
import { ActionObserverService } from '../src/modules/buddy/services/action-observer.service';
import { LlmProviderService } from '../src/modules/buddy/services/llm-provider.service';
import { SuggestionEngineService } from '../src/modules/buddy/services/suggestion-engine.service';
import { IntentType } from '../src/modules/intents/intents.constants';

describe('Buddy module (e2e)', () => {
	let app: INestApplication;
	let actionObserver: ActionObserverService;
	let suggestionEngine: SuggestionEngineService;
	let accessToken: string;

	beforeAll(async () => {
		const dynamicAppModule = AppModule.register({
			moduleExtensions: [],
			pluginExtensions: [],
		});

		const moduleFixture = await Test.createTestingModule({
			imports: [dynamicAppModule],
		})
			.overrideProvider(LlmProviderService)
			.useValue({
				sendMessage: jest.fn().mockResolvedValue({
					content: 'Mocked buddy response',
					meta: {
						provider: 'mock',
						model: null,
						inputTokens: null,
						outputTokens: null,
						finishReason: null,
					},
				}),
				supportsTools: jest.fn().mockReturnValue(false),
			})
			.compile();

		app = moduleFixture.createNestApplication();

		app.useGlobalPipes(
			new ValidationPipe({
				whitelist: true,
				forbidNonWhitelisted: true,
				transform: true,
			}),
		);

		useContainer(moduleFixture, { fallbackOnErrors: true });

		await app.init();

		// Wait for all modules to initialize
		await new Promise((resolve) => setTimeout(resolve, 100));

		actionObserver = moduleFixture.get<ActionObserverService>(ActionObserverService);
		suggestionEngine = moduleFixture.get<SuggestionEngineService>(SuggestionEngineService);

		// Register and login to obtain an access token
		await request(app.getHttpServer())
			.post('/modules/auth/auth/register')
			.send({
				data: {
					username: 'buddytest',
					password: 'securePassword123!',
					email: 'buddytest@example.com',
				},
			});

		const loginResponse = await request(app.getHttpServer())
			.post('/modules/auth/auth/login')
			.send({
				data: {
					username: 'buddytest',
					password: 'securePassword123!',
				},
			});

		const loginBody = loginResponse.body as { data?: { access_token?: string } };

		if (!loginBody.data?.access_token) {
			throw new Error(
				`E2E setup failed: login returned status ${loginResponse.status} — ${JSON.stringify(loginResponse.body)}`,
			);
		}

		accessToken = loginBody.data.access_token;
	}, 30_000);

	afterAll(async () => {
		await app.close();
	});

	beforeEach(async () => {
		// Clear any existing suggestions from previous tests
		const repo = app.get('BuddySuggestionEntityRepository');

		if (repo?.clear) {
			await repo.clear();
		}
	});

	// Helper to make authenticated requests
	function authGet(path: string) {
		return request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${accessToken}`);
	}

	function authPost(path: string) {
		return request(app.getHttpServer()).post(path).set('Authorization', `Bearer ${accessToken}`);
	}

	function authDelete(path: string) {
		return request(app.getHttpServer()).delete(path).set('Authorization', `Bearer ${accessToken}`);
	}

	// ─── Conversation endpoints ──────────────────────────────────────

	describe('GET /modules/buddy/conversations', () => {
		it('should return an empty list initially', async () => {
			const response = await authGet('/modules/buddy/conversations').expect(200);

			expect(response.body).toHaveProperty('data');
			expect(response.body.data).toBeInstanceOf(Array);
		});
	});

	describe('POST /modules/buddy/conversations', () => {
		it('should create a new conversation', async () => {
			const response = await authPost('/modules/buddy/conversations')
				.send({
					data: {
						title: 'Test chat',
					},
				})
				.expect(201);

			expect(response.body).toHaveProperty('data');
			expect(response.body.data).toHaveProperty('id');
			expect(response.body.data).toHaveProperty('title', 'Test chat');
		});

		it('should create a conversation with no data body', async () => {
			const response = await authPost('/modules/buddy/conversations').send({}).expect(201);

			expect(response.body).toHaveProperty('data');
			expect(response.body.data).toHaveProperty('id');
		});
	});

	describe('GET /modules/buddy/conversations/:id', () => {
		it('should return a conversation by ID', async () => {
			const createResponse = await authPost('/modules/buddy/conversations')
				.send({ data: { title: 'Lookup test' } })
				.expect(201);

			const conversationId = createResponse.body.data.id as string;

			const response = await authGet(`/modules/buddy/conversations/${conversationId}`).expect(200);

			expect(response.body.data.id).toBe(conversationId);
			expect(response.body.data.title).toBe('Lookup test');
		});

		it('should return 404 for non-existent conversation', async () => {
			await authGet('/modules/buddy/conversations/00000000-0000-4000-a000-000000000000').expect(404);
		});

		it('should return 400 for invalid UUID', async () => {
			await authGet('/modules/buddy/conversations/not-a-uuid').expect(400);
		});
	});

	describe('POST /modules/buddy/conversations/:id/messages', () => {
		it('should send a message and return the buddy response', async () => {
			const createResponse = await authPost('/modules/buddy/conversations')
				.send({ data: { title: 'Message test' } })
				.expect(201);

			const conversationId = createResponse.body.data.id as string;

			const msgResponse = await authPost(`/modules/buddy/conversations/${conversationId}/messages`)
				.send({ data: { content: 'Hello buddy!' } })
				.expect(201);

			expect(msgResponse.body).toHaveProperty('data');
			expect(msgResponse.body.data).toHaveProperty('content', 'Mocked buddy response');
			expect(msgResponse.body.data).toHaveProperty('role', 'assistant');
		});

		it('should return 404 when conversation does not exist', async () => {
			await authPost('/modules/buddy/conversations/00000000-0000-4000-a000-000000000000/messages')
				.send({ data: { content: 'Hello' } })
				.expect(404);
		});

		it('should return 400 for empty message content', async () => {
			const createResponse = await authPost('/modules/buddy/conversations')
				.send({ data: { title: 'Validation test' } })
				.expect(201);

			const conversationId = createResponse.body.data.id as string;

			await authPost(`/modules/buddy/conversations/${conversationId}/messages`)
				.send({ data: { content: '' } })
				.expect(400);
		});
	});

	describe('GET /modules/buddy/conversations/:id/messages', () => {
		it('should return messages for a conversation', async () => {
			const createResponse = await authPost('/modules/buddy/conversations')
				.send({ data: { title: 'History test' } })
				.expect(201);

			const conversationId = createResponse.body.data.id as string;

			// Send a message first
			await authPost(`/modules/buddy/conversations/${conversationId}/messages`)
				.send({ data: { content: 'Test message' } })
				.expect(201);

			const response = await authGet(`/modules/buddy/conversations/${conversationId}/messages`).expect(200);

			expect(response.body).toHaveProperty('data');
			expect(response.body.data).toBeInstanceOf(Array);
			// Should have both user message and assistant response
			expect(response.body.data.length).toBeGreaterThanOrEqual(2);

			const roles = (response.body.data as Array<{ role: string }>).map((m) => m.role);

			expect(roles).toContain('user');
			expect(roles).toContain('assistant');
		});
	});

	describe('DELETE /modules/buddy/conversations/:id', () => {
		it('should delete a conversation', async () => {
			const createResponse = await authPost('/modules/buddy/conversations')
				.send({ data: { title: 'Delete test' } })
				.expect(201);

			const conversationId = createResponse.body.data.id as string;

			await authDelete(`/modules/buddy/conversations/${conversationId}`).expect(204);

			// Verify it's gone
			await authGet(`/modules/buddy/conversations/${conversationId}`).expect(404);
		});

		it('should return 404 when deleting non-existent conversation', async () => {
			await authDelete('/modules/buddy/conversations/00000000-0000-4000-a000-000000000000').expect(404);
		});
	});

	// ─── Suggestion endpoints ────────────────────────────────────────

	describe('GET /modules/buddy/suggestions', () => {
		it('should return an empty list when no patterns are detected', async () => {
			const response = await authGet('/modules/buddy/suggestions').expect(200);

			expect(response.body).toHaveProperty('data');
			expect(response.body.data).toBeInstanceOf(Array);
		});

		it('should return suggestions after recording repeated actions', async () => {
			// Record enough actions to trigger pattern detection (3+ same type, same space, similar time)
			for (let i = 1; i <= 4; i++) {
				const ts = new Date();

				ts.setDate(ts.getDate() - i);
				ts.setHours(23, 0, 0, 0);

				actionObserver.recordAction({
					intentId: `e2e-intent-${i}`,
					type: IntentType.LIGHT_TOGGLE,
					spaceId: 'e2e-space-1',
					deviceIds: ['e2e-dev-1'],
					timestamp: ts,
				});
			}

			const response = await authGet('/modules/buddy/suggestions').expect(200);

			expect(response.body).toHaveProperty('data');
			expect(response.body.data.length).toBeGreaterThanOrEqual(1);

			const suggestion = response.body.data[0];

			expect(suggestion).toHaveProperty('id');
			expect(suggestion).toHaveProperty('type');
			expect(suggestion).toHaveProperty('title');
			expect(suggestion).toHaveProperty('reason');
			expect(suggestion).toHaveProperty('space_id', 'e2e-space-1');
		});
	});

	describe('POST /modules/buddy/suggestions/:id/feedback', () => {
		it('should accept feedback for a suggestion', async () => {
			// Ensure we have a suggestion to give feedback on
			for (let i = 1; i <= 4; i++) {
				const ts = new Date();

				ts.setDate(ts.getDate() - i);
				ts.setHours(22, 0, 0, 0);

				actionObserver.recordAction({
					intentId: `e2e-fb-intent-${i}`,
					type: IntentType.SPACE_LIGHTING_OFF,
					spaceId: 'e2e-space-fb',
					deviceIds: ['e2e-dev-fb'],
					timestamp: ts,
				});
			}

			const suggestionsResponse = await authGet('/modules/buddy/suggestions').expect(200);

			// Find a suggestion from our e2e-space-fb
			const suggestions = (suggestionsResponse.body.data as Array<{ id: string; space_id: string }>).filter(
				(s) => s.space_id === 'e2e-space-fb',
			);

			expect(suggestions.length).toBeGreaterThanOrEqual(1);

			const suggestionId = suggestions[0].id;

			const response = await authPost(`/modules/buddy/suggestions/${suggestionId}/feedback`)
				.send({ data: { feedback: 'applied' } })
				.expect(201);

			expect(response.body).toHaveProperty('data');
			expect(response.body.data).toHaveProperty('success', true);
		});

		it('should return 404 for non-existent suggestion', async () => {
			await authPost('/modules/buddy/suggestions/00000000-0000-4000-a000-000000000000/feedback')
				.send({ data: { feedback: 'dismissed' } })
				.expect(404);
		});

		it('should return 400 for invalid feedback value', async () => {
			await authPost('/modules/buddy/suggestions/00000000-0000-4000-a000-000000000000/feedback')
				.send({ data: { feedback: 'invalid' } })
				.expect(400);
		});
	});

	// ─── Auth enforcement ────────────────────────────────────────────

	describe('Authentication', () => {
		it('should return 401 for unauthenticated requests', async () => {
			await request(app.getHttpServer()).get('/modules/buddy/conversations').expect(401);
		});
	});
});
