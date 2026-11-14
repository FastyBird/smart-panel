/*
eslint-disable @typescript-eslint/no-unsafe-argument
*/
import { useContainer } from 'class-validator';
import request from 'supertest';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AppModule } from '../src/app.module';
import { ValidationExceptionFactory } from '../src/common/validation/validation-exception-factory';

interface TileBody {
	data: { id: string; type: string; row: number; col: number; parent: { type: string; id: string } };
}

describe('Dashboard tiles update (e2e)', () => {
	let app: INestApplication;
	let token: string;
	let pageId: string;
	let tileId: string;

	beforeAll(async () => {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule.register({ moduleExtensions: [], pluginExtensions: [] })],
		}).compile();

		app = moduleFixture.createNestApplication();

		// The same pipe as src/main.ts
		app.useGlobalPipes(
			new ValidationPipe({
				whitelist: true,
				forbidNonWhitelisted: true,
				transform: true,
				transformOptions: { enableImplicitConversion: true },
				exceptionFactory: (validationErrors) => ValidationExceptionFactory.createException(validationErrors),
			}),
		);

		useContainer(moduleFixture, { fallbackOnErrors: true });

		await app.init();

		// Wait for all modules to initialize (especially module mappings)
		await new Promise((resolve) => setTimeout(resolve, 100));

		// The first registered account becomes the owner
		await request(app.getHttpServer())
			.post('/modules/auth/auth/register')
			.send({ data: { username: 'tilesowner', password: 'securePassword123!', email: 'tilesowner@example.com' } })
			.expect(204);

		const login = await request(app.getHttpServer())
			.post('/modules/auth/auth/login')
			.send({ data: { username: 'tilesowner', password: 'securePassword123!' } })
			.expect(201);

		token = (login.body as { data: { access_token: string } }).data.access_token;

		const page = await request(app.getHttpServer())
			.post('/modules/dashboard/pages')
			.set('Authorization', `Bearer ${token}`)
			.send({ data: { type: 'pages-tiles', title: 'Tiles update fixture', order: 1 } })
			.expect(201);

		pageId = (page.body as { data: { id: string } }).data.id;

		const tile = await request(app.getHttpServer())
			.post('/modules/dashboard/tiles')
			.set('Authorization', `Bearer ${token}`)
			.send({ data: { type: 'tiles-time', parent: { type: 'page', id: pageId }, row: 1, col: 1 } })
			.expect(201);

		tileId = (tile.body as TileBody).data.id;
	}, 60_000);

	afterAll(async () => {
		await app.close();
	});

	it('PATCH /modules/dashboard/tiles/:id updates a tile without a parent and keeps its current parent', async () => {
		const response = await request(app.getHttpServer())
			.patch(`/modules/dashboard/tiles/${tileId}`)
			.set('Authorization', `Bearer ${token}`)
			.send({ data: { type: 'tiles-time', row: 2 } })
			.expect(200);

		const body = response.body as TileBody;

		expect(body.data.id).toBe(tileId);
		expect(body.data.row).toBe(2);
		expect(body.data.col).toBe(1);
		expect(body.data.parent).toEqual({ type: 'page', id: pageId });

		const stored = await request(app.getHttpServer())
			.get(`/modules/dashboard/tiles/${tileId}`)
			.set('Authorization', `Bearer ${token}`)
			.expect(200);

		expect((stored.body as TileBody).data.row).toBe(2);
		expect((stored.body as TileBody).data.parent).toEqual({ type: 'page', id: pageId });
	});
});
