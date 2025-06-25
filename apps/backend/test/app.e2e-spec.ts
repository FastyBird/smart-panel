/*
eslint-disable @typescript-eslint/no-unsafe-argument
*/
/*
Reason: The test setup involves dynamic assignment and interaction with Jest mocks,
which TypeScript cannot strictly type-check. These cases require flexible handling
that ESLint flags as unsafe, but they are necessary for effective testing.
*/
import { useContainer } from 'class-validator';
import request from 'supertest';
import { v4 as uuid } from 'uuid';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AppModule } from '../src/app.module';

describe('FastyBird Smart Panel (e2e)', () => {
	let app: INestApplication;
	let accessToken: string;

	beforeAll(async () => {
		const moduleFixture = await Test.createTestingModule({
			imports: [AppModule],
		}).compile();

		app = moduleFixture.createNestApplication();

		// Global Pipes (as in main.ts)
		app.useGlobalPipes(
			new ValidationPipe({
				whitelist: true,
				forbidNonWhitelisted: true,
				transform: true,
			}),
		);

		useContainer(app.select(AppModule), { fallbackOnErrors: true });

		await app.init();
	});

	afterAll(async () => {
		await app.close();
	});

	// ✅ User Registration
	it('/auth-module/auth/register (POST) - should register a new user', async () => {
		await request(app.getHttpServer())
			.post('/auth-module/auth/register')
			.send({
				data: {
					username: 'testuser',
					password: 'securePassword123!',
					email: 'test@example.com',
				},
			})
			.expect(204);
	});

	// ✅ User Login
	it('/auth-module/auth/login (POST) - should log in an existing user', async () => {
		const response = await request(app.getHttpServer())
			.post('/auth-module/auth/login')
			.send({
				data: {
					username: 'testuser',
					password: 'securePassword123!',
				},
			})
			.expect(201);

		const responseBody = response.body as { accessToken: string };

		expect(responseBody).toHaveProperty('accessToken');
		accessToken = responseBody.accessToken; // Save token for later tests
	});

	// ✅ Fetch Profile
	it('/auth-module/auth/profile (GET) - should fetch user profile', async () => {
		const response = await request(app.getHttpServer())
			.get('/auth-module/auth/profile')
			.set('Authorization', `Bearer ${accessToken}`)
			.expect(200);

		const responseBody = response.body as { username: string };

		expect(responseBody).toHaveProperty('username', 'testuser');
	});

	// ✅ Fetch All Users (Requires Admin Role)
	it('/users-module/users (GET) - should fetch all users (admin only)', async () => {
		const response = await request(app.getHttpServer())
			.get('/users-module/users')
			.set('Authorization', `Bearer ${accessToken}`)
			.expect(200);

		const users = response.body as Array<{ id: string }>;

		expect(users).toBeInstanceOf(Array);
	});

	// ✅ Delete User
	it('/users-module/users/:id (DELETE) - should delete a user', async () => {
		// Fetch user to delete
		const usersResponse = await request(app.getHttpServer())
			.get('/users-module/users')
			.set('Authorization', `Bearer ${accessToken}`)
			.expect(200);

		const users = usersResponse.body as Array<{ id: string }>;

		if (users.length > 0) {
			const userId = users[0].id;

			await request(app.getHttpServer())
				.delete(`/users-module/users/${userId}`)
				.set('Authorization', `Bearer ${accessToken}`)
				.expect(422);
		}
	});

	// ✅ Register Display Device
	it('/auth-module/auth/register-display (POST) - should register a display device', async () => {
		const response = await request(app.getHttpServer())
			.post('/auth-module/auth/register-display')
			.set('User-Agent', 'FlutterApp')
			.send({
				data: {
					uid: uuid(),
					mac: '00:1A:2B:3C:4D:5E',
					version: '1.0.0',
					build: '42',
				},
			})
      .expect(201);

    const responseBody = response.body as { secret: string };

    expect(responseBody).toHaveProperty('secret');
  });

	// ✅ Unauthorized Access Test
	it('/auth-module/auth/profile (GET) - should fail without token', async () => {
		await request(app.getHttpServer()).get('/auth-module/auth/profile').expect(401);
	});
});
