import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { CryptoService } from './crypto.service';

describe('CryptoService', () => {
	let service: CryptoService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [CryptoService],
		}).compile();

		service = module.get<CryptoService>(CryptoService);

		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	it('should generate a secure secret of length 64 (32 bytes in hex)', () => {
		const secret = service.generateSecureSecret();

		// Ensure it returns a string
		expect(typeof secret).toBe('string');

		// Ensure it has the correct length (32 bytes -> 64 hex characters)
		expect(secret.length).toBe(64);

		// Ensure it only contains valid hex characters
		expect(secret).toMatch(/^[a-f0-9]+$/i);
	});

	it('should generate unique secrets each time', () => {
		const secret1 = service.generateSecureSecret();
		const secret2 = service.generateSecureSecret();

		// Ensure they are different
		expect(secret1).not.toBe(secret2);
	});
});
