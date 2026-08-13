/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { useContainer } from 'class-validator';
import request from 'supertest';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AppModule } from '../src/app.module';
import { DevicesHomeAssistantValidationException } from '../src/plugins/devices-home-assistant/devices-home-assistant.exceptions';
import { HomeAssistantWizardService } from '../src/plugins/devices-home-assistant/services/wizard.service';

describe('Home Assistant wizard endpoints (e2e)', () => {
	let app: INestApplication;
	let accessToken: string;
	const session = {
		id: 'session-1',
		startedAt: '2026-08-13T00:00:00.000Z',
		candidates: [
			{
				key: 'device:ha-device-1',
				kind: 'device',
				sourceId: 'ha-device-1',
				name: 'Living room lamp',
				manufacturer: 'Philips',
				model: 'Hue',
				status: 'ready',
				suggestedCategory: 'lighting',
				previewChannelCount: 2,
				entityCount: 3,
				warningCount: 0,
				adoptedDeviceId: null,
				error: null,
			},
			{
				key: 'helper:input_text.unsupported',
				kind: 'helper',
				sourceId: 'input_text.unsupported',
				name: 'Unsupported helper',
				manufacturer: 'Home Assistant',
				model: 'Helper (input_text)',
				status: 'unsupported',
				suggestedCategory: null,
				previewChannelCount: 0,
				entityCount: 1,
				warningCount: 1,
				adoptedDeviceId: null,
				error: 'Automatic mapping could not be generated',
			},
		],
	};
	const wizardService = {
		start: jest.fn().mockResolvedValue(session),
		get: jest.fn((id: string) => (id === session.id ? session : null)),
		end: jest.fn(),
		adopt: jest.fn((id: string) =>
			id === session.id
				? Promise.resolve([
						{ key: 'device:ha-device-1', name: 'Living room lamp', status: 'created', error: null },
						{
							key: 'helper:input_text.unsupported',
							name: 'Unsupported helper',
							status: 'failed',
							error: 'Candidate requires manual mapping or is no longer adoptable',
						},
					])
				: Promise.resolve(null),
		),
	};

	beforeAll(async () => {
		const dynamicAppModule = AppModule.register({ moduleExtensions: [], pluginExtensions: [] });
		const moduleFixture = await Test.createTestingModule({ imports: [dynamicAppModule] })
			.overrideProvider(HomeAssistantWizardService)
			.useValue(wizardService)
			.compile();

		app = moduleFixture.createNestApplication();
		app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
		useContainer(moduleFixture, { fallbackOnErrors: true });
		await app.init();

		await request(app.getHttpServer())
			.post('/modules/auth/auth/register')
			.send({
				data: { username: 'hawizardtest', password: 'securePassword123!', email: 'hawizardtest@example.com' },
			});
		const login = await request(app.getHttpServer())
			.post('/modules/auth/auth/login')
			.send({ data: { username: 'hawizardtest', password: 'securePassword123!' } });
		accessToken = (login.body as { data: { access_token: string } }).data.access_token;
	});

	afterAll(async () => {
		await app.close();
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('requires authentication before starting a session', async () => {
		await request(app.getHttpServer()).post('/plugins/devices-home-assistant/wizard').expect(401);

		expect(wizardService.start).not.toHaveBeenCalled();
	});

	it('starts and retrieves an authenticated inventory session', async () => {
		const started = await request(app.getHttpServer())
			.post('/plugins/devices-home-assistant/wizard')
			.set('Authorization', `Bearer ${accessToken}`)
			.expect(201);
		const startedBody = started.body as { data: typeof session };

		expect(startedBody).toEqual(expect.objectContaining({ data: session }));
		expect(startedBody.data.candidates).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ key: 'device:ha-device-1', entityCount: 3, previewChannelCount: 2 }),
				expect.objectContaining({ key: 'helper:input_text.unsupported', status: 'unsupported', entityCount: 1 }),
			]),
		);

		const retrieved = await request(app.getHttpServer())
			.get('/plugins/devices-home-assistant/wizard/session-1')
			.set('Authorization', `Bearer ${accessToken}`)
			.expect(200);

		expect(retrieved.body).toEqual(expect.objectContaining({ data: session }));
	});

	it('validates selected keys and returns partial adoption results with HTTP 200', async () => {
		await request(app.getHttpServer())
			.post('/plugins/devices-home-assistant/wizard/session-1/adopt')
			.set('Authorization', `Bearer ${accessToken}`)
			.send({ data: { keys: [] } })
			.expect(400);

		expect(wizardService.adopt).not.toHaveBeenCalled();

		const adopted = await request(app.getHttpServer())
			.post('/plugins/devices-home-assistant/wizard/session-1/adopt')
			.set('Authorization', `Bearer ${accessToken}`)
			.send({ data: { keys: ['device:ha-device-1', 'helper:input_text.unsupported'] } })
			.expect(200);
		const adoptedBody = adopted.body as { data: { results: Array<{ key: string; status: string }> } };

		expect(adoptedBody.data.results).toEqual([
			expect.objectContaining({ key: 'device:ha-device-1', status: 'created' }),
			expect.objectContaining({ key: 'helper:input_text.unsupported', status: 'failed' }),
		]);
	});

	it('returns not found for unknown sessions', async () => {
		await request(app.getHttpServer())
			.get('/plugins/devices-home-assistant/wizard/missing')
			.set('Authorization', `Bearer ${accessToken}`)
			.expect(404);

		await request(app.getHttpServer())
			.post('/plugins/devices-home-assistant/wizard/missing/adopt')
			.set('Authorization', `Bearer ${accessToken}`)
			.send({ data: { keys: ['device:ha-device-1'] } })
			.expect(404);
	});

	it('ends an authenticated session', async () => {
		await request(app.getHttpServer())
			.delete('/plugins/devices-home-assistant/wizard/session-1')
			.set('Authorization', `Bearer ${accessToken}`)
			.expect(204);

		expect(wizardService.end).toHaveBeenCalledWith('session-1');
	});

	it('translates plugin configuration failures', async () => {
		wizardService.start.mockRejectedValueOnce(
			new DevicesHomeAssistantValidationException('Home Assistant API key is not configured'),
		);

		await request(app.getHttpServer())
			.post('/plugins/devices-home-assistant/wizard')
			.set('Authorization', `Bearer ${accessToken}`)
			.expect(422);
	});
});
