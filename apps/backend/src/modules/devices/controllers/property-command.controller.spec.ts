import request from 'supertest';

import { INestApplication, PipeTransform } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AuthenticatedRequest } from '../../auth/guards/auth.guard';
import { UserRole } from '../../users/users.constants';
import { PropertyCommandEntryInterceptor } from '../interceptors/property-command-entry.interceptor';
import { PropertyCommandEntrySnapshot } from '../services/property-command-entry-snapshot';
import { PropertyCommandWindowService } from '../services/property-command-window.service';
import { PropertyCommandService } from '../services/property-command.service';

import { PropertyCommandController } from './property-command.controller';

class ExpireEntryDuringBodyValidationPipe implements PipeTransform {
	constructor(private readonly entry: PropertyCommandEntrySnapshot) {}

	async transform(value: unknown): Promise<unknown> {
		await Promise.resolve();
		this.entry.dispose();
		return value;
	}
}

describe('PropertyCommandController', () => {
	let app: INestApplication;

	afterEach(async () => {
		await app?.close();
	});

	it('forwards the entry captured before async target validation and releases it afterward', async () => {
		const entry = PropertyCommandEntrySnapshot.capture(new PropertyCommandWindowService(), jest.fn());
		const captureCommandEntry = jest.fn(() => entry);
		const releaseCommandEntry = jest.fn((captured: PropertyCommandEntrySnapshot) => captured.release());
		const executePropertyCommands = jest.fn().mockResolvedValue({ success: true, results: [] });
		const commands = {
			captureCommandEntry,
			releaseCommandEntry,
			executePropertyCommands,
		} as unknown as PropertyCommandService;
		const testingModule = await Test.createTestingModule({
			controllers: [PropertyCommandController],
			providers: [PropertyCommandEntryInterceptor, { provide: PropertyCommandService, useValue: commands }],
		}).compile();
		app = testingModule.createNestApplication();
		app.use((req: AuthenticatedRequest, _res: unknown, next: () => void) => {
			req.auth = { type: 'user', id: 'admin', role: UserRole.ADMIN };
			next();
		});
		app.useGlobalPipes(new ExpireEntryDuringBodyValidationPipe(entry));
		await app.init();

		const server = app.getHttpServer() as Parameters<typeof request>[0];
		await request(server).post('/property-commands').send({ request_id: 'request', properties: [] }).expect(200);

		expect(captureCommandEntry).toHaveBeenCalledTimes(1);
		expect(entry.isActive()).toBe(false);
		expect(executePropertyCommands).toHaveBeenCalledWith([], expect.objectContaining({ commandEntry: entry }));
		expect(releaseCommandEntry).toHaveBeenCalledWith(entry);
	});
});
