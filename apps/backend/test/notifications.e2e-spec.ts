/*
eslint-disable @typescript-eslint/no-unsafe-argument
*/
import { useContainer } from 'class-validator';
import request from 'supertest';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AppModule } from '../src/app.module';
import { NotificationKind, NotificationSeverity } from '../src/modules/notifications/notifications.constants';
import {
	CreateNotificationInput,
	NotificationsService,
} from '../src/modules/notifications/services/notifications.service';
import { UserRole } from '../src/modules/users/users.constants';

describe('Notifications module (e2e)', () => {
	let app: INestApplication;
	let notificationsService: NotificationsService;
	let ownerToken: string;
	let userToken: string;
	let displayToken: string;

	// Guards run before the route handler even looks the id up, so a well-formed but
	// non-existent id is enough to prove the role denial happens before anything else.
	const placeholderId = '11111111-1111-4111-8111-111111111111';

	beforeAll(async () => {
		const dynamicAppModule = AppModule.register({
			moduleExtensions: [],
			pluginExtensions: [],
		});

		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [dynamicAppModule],
		}).compile();

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

		// Wait for all modules to initialize (especially module mappings)
		await new Promise((resolve) => setTimeout(resolve, 100));

		notificationsService = moduleFixture.get<NotificationsService>(NotificationsService);

		// /auth/register only ever succeeds once - it creates the application owner and
		// 403s on every later call - so the first registered account becomes owner.
		await request(app.getHttpServer())
			.post('/modules/auth/auth/register')
			.send({ data: { username: 'notifowner', password: 'securePassword123!', email: 'notifowner@example.com' } });

		const ownerLogin = await request(app.getHttpServer())
			.post('/modules/auth/auth/login')
			.send({ data: { username: 'notifowner', password: 'securePassword123!' } });

		ownerToken = (ownerLogin.body as { data: { access_token: string } }).data.access_token;

		// A plain USER-role account: self-registration cannot produce one (see above), so
		// the owner creates it through the owner/admin-only users endpoint instead.
		await request(app.getHttpServer())
			.post('/modules/users/users')
			.set('Authorization', `Bearer ${ownerToken}`)
			.send({
				data: {
					username: 'notifuser',
					password: 'securePassword123!',
					email: 'notifuser@example.com',
					role: UserRole.USER,
				},
			});

		const userLogin = await request(app.getHttpServer())
			.post('/modules/auth/auth/login')
			.send({ data: { username: 'notifuser', password: 'securePassword123!' } });

		userToken = (userLogin.body as { data: { access_token: string } }).data.access_token;

		// Displays self-register without any auth and get their own access token back.
		const displayRegister = await request(app.getHttpServer())
			.post('/modules/displays/register')
			.set('User-Agent', 'FastyBird Smart Panel')
			.send({
				data: {
					mac_address: '00:1A:2B:3C:4D:5F',
					version: '1.0.0',
					build: '42',
					screen_width: 1920,
					screen_height: 1080,
					pixel_ratio: 1.5,
				},
			});

		displayToken = (displayRegister.body as { data: { access_token: string } }).data.access_token;
	}, 60_000);

	afterAll(async () => {
		await app.close();
	});

	const createNotification = async (input: CreateNotificationInput) => {
		const notification = await notificationsService.notify(input);

		if (!notification) {
			throw new Error('Test setup failed: notify() refused the notification');
		}

		return notification;
	};

	describe('as owner', () => {
		it('lists active notifications created through the service', async () => {
			const first = await createNotification({
				source: 'system-module',
				kind: NotificationKind.EVENT,
				severity: NotificationSeverity.INFO,
				title: 'e2e list - first',
			});
			const second = await createNotification({
				source: 'system-module',
				kind: NotificationKind.EVENT,
				severity: NotificationSeverity.WARNING,
				title: 'e2e list - second',
			});

			const response = await request(app.getHttpServer())
				.get('/modules/notifications/notifications?source=system-module')
				.set('Authorization', `Bearer ${ownerToken}`)
				.expect(200);

			const body = response.body as { data: Array<{ id: string; title: string }> };
			const ids = body.data.map((row) => row.id);

			expect(ids).toContain(first.id);
			expect(ids).toContain(second.id);
		});

		it('patches read state through PATCH /:id', async () => {
			const notification = await createNotification({
				source: 'system-module',
				kind: NotificationKind.EVENT,
				severity: NotificationSeverity.INFO,
				title: 'e2e patch read',
			});

			const response = await request(app.getHttpServer())
				.patch(`/modules/notifications/notifications/${notification.id}`)
				.set('Authorization', `Bearer ${ownerToken}`)
				.send({ data: { read: true } })
				.expect(200);

			const body = response.body as { data: { id: string; read_at: string | null } };

			expect(body.data.id).toBe(notification.id);
			expect(body.data.read_at).not.toBeNull();
		});

		it('rejects PATCH /:id with a missing data wrapper instead of throwing', async () => {
			const notification = await createNotification({
				source: 'system-module',
				kind: NotificationKind.EVENT,
				severity: NotificationSeverity.INFO,
				title: 'e2e patch missing data',
			});

			// No `data` key at all - ReqUpdateNotificationDto.data must be required, or this
			// reaches the handler as `undefined` and `body.data.read` throws a TypeError that
			// surfaces as a 500 instead of a validation error.
			await request(app.getHttpServer())
				.patch(`/modules/notifications/notifications/${notification.id}`)
				.set('Authorization', `Bearer ${ownerToken}`)
				.send({})
				.expect(400);
		});

		it('accepts PATCH /:id with an empty data object as a no-op', async () => {
			const notification = await createNotification({
				source: 'system-module',
				kind: NotificationKind.EVENT,
				severity: NotificationSeverity.INFO,
				title: 'e2e patch empty data',
			});

			// `data` present but with neither `read` nor `dismissed` set: both fields are
			// optional by design, so this is a no-op rather than a rejection - the row comes
			// back unchanged.
			const response = await request(app.getHttpServer())
				.patch(`/modules/notifications/notifications/${notification.id}`)
				.set('Authorization', `Bearer ${ownerToken}`)
				.send({ data: {} })
				.expect(200);

			const body = response.body as { data: { id: string; read_at: string | null; dismissed_at: string | null } };

			expect(body.data.id).toBe(notification.id);
			expect(body.data.read_at).toBeNull();
			expect(body.data.dismissed_at).toBeNull();
		});

		it('resolves a persistent issue when it is dismissed, surfacing resolved_at over HTTP', async () => {
			const persistentIssue = await createNotification({
				source: 'system-module',
				kind: NotificationKind.ISSUE,
				key: 'e2e-persistent-issue',
				severity: NotificationSeverity.ERROR,
				title: 'e2e persistent issue',
				persistent: true,
			});

			const response = await request(app.getHttpServer())
				.patch(`/modules/notifications/notifications/${persistentIssue.id}`)
				.set('Authorization', `Bearer ${ownerToken}`)
				.send({ data: { dismissed: true } })
				.expect(200);

			const body = response.body as { data: { dismissed_at: string | null; resolved_at: string | null } };

			expect(body.data.dismissed_at).not.toBeNull();
			expect(body.data.resolved_at).not.toBeNull();
			expect(body.data.resolved_at).toBe(body.data.dismissed_at);
		});

		it('bulk dismisses notifications through POST /bulk-update', async () => {
			const a = await createNotification({
				source: 'system-module',
				kind: NotificationKind.EVENT,
				severity: NotificationSeverity.INFO,
				title: 'e2e bulk dismiss a',
			});
			const b = await createNotification({
				source: 'system-module',
				kind: NotificationKind.EVENT,
				severity: NotificationSeverity.INFO,
				title: 'e2e bulk dismiss b',
			});

			const response = await request(app.getHttpServer())
				.post('/modules/notifications/notifications/bulk-update')
				.set('Authorization', `Bearer ${ownerToken}`)
				.send({ data: { ids: [a.id, b.id], dismissed: true } })
				.expect(200);

			const body = response.body as { data: { succeeded: string[]; failed: unknown[] } };

			expect([...body.data.succeeded].sort()).toEqual([a.id, b.id].sort());
			expect(body.data.failed).toEqual([]);

			const stored = await notificationsService.findOne(a.id);

			expect(stored?.dismissedAt).not.toBeNull();
		});

		it('bulk removes notifications through POST /bulk-remove', async () => {
			const a = await createNotification({
				source: 'system-module',
				kind: NotificationKind.EVENT,
				severity: NotificationSeverity.INFO,
				title: 'e2e bulk remove a',
			});
			const b = await createNotification({
				source: 'system-module',
				kind: NotificationKind.EVENT,
				severity: NotificationSeverity.INFO,
				title: 'e2e bulk remove b',
			});

			const response = await request(app.getHttpServer())
				.post('/modules/notifications/notifications/bulk-remove')
				.set('Authorization', `Bearer ${ownerToken}`)
				.send({ data: { ids: [a.id, b.id] } })
				.expect(200);

			const body = response.body as { data: { succeeded: string[]; failed: unknown[] } };

			expect([...body.data.succeeded].sort()).toEqual([a.id, b.id].sort());

			await request(app.getHttpServer())
				.get(`/modules/notifications/notifications/${a.id}`)
				.set('Authorization', `Bearer ${ownerToken}`)
				.expect(404);
		});
	});

	describe('role denial', () => {
		const routesUnderTest = [
			{ method: 'get' as const, path: '/modules/notifications/notifications' },
			{ method: 'get' as const, path: `/modules/notifications/notifications/${placeholderId}` },
			{
				method: 'patch' as const,
				path: `/modules/notifications/notifications/${placeholderId}`,
				body: { data: { read: true } },
			},
			{ method: 'delete' as const, path: `/modules/notifications/notifications/${placeholderId}` },
			{
				method: 'post' as const,
				path: '/modules/notifications/notifications/bulk-update',
				body: { data: { ids: [placeholderId], read: true } },
			},
			{
				method: 'post' as const,
				path: '/modules/notifications/notifications/bulk-remove',
				body: { data: { ids: [placeholderId] } },
			},
		];

		it.each(routesUnderTest)('returns 403 for a USER role token on $method $path', async ({ method, path, body }) => {
			const pending = request(app.getHttpServer())[method](path).set('Authorization', `Bearer ${userToken}`);

			await (body ? pending.send(body) : pending).expect(403);
		});

		it.each(routesUnderTest)('returns 403 for a display token on $method $path', async ({ method, path, body }) => {
			const pending = request(app.getHttpServer())[method](path).set('Authorization', `Bearer ${displayToken}`);

			await (body ? pending.send(body) : pending).expect(403);
		});
	});
});
