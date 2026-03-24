import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { SendMessageDto } from './send-message.dto';

describe('SendMessageDto', () => {
	function toDto(content: unknown): SendMessageDto {
		return plainToInstance(
			SendMessageDto,
			{ content },
			{ enableImplicitConversion: false, excludeExtraneousValues: true },
		);
	}

	it('should accept a normal message', async () => {
		const dto = toDto('Turn on the lights');
		const errors = await validate(dto, { whitelist: true });

		expect(errors).toHaveLength(0);
		expect(dto.content).toBe('Turn on the lights');
	});

	it('should trim whitespace from message content', async () => {
		const dto = toDto('  hello  ');
		const errors = await validate(dto, { whitelist: true });

		expect(errors).toHaveLength(0);
		expect(dto.content).toBe('hello');
	});

	it('should reject whitespace-only message', async () => {
		const dto = toDto('   ');
		const errors = await validate(dto, { whitelist: true });

		expect(errors.length).toBeGreaterThan(0);
		expect(errors[0].property).toBe('content');
	});

	it('should reject empty string', async () => {
		const dto = toDto('');
		const errors = await validate(dto, { whitelist: true });

		expect(errors.length).toBeGreaterThan(0);
	});

	it('should reject missing content', async () => {
		const dto = toDto(undefined);
		const errors = await validate(dto, { whitelist: true });

		expect(errors.length).toBeGreaterThan(0);
	});
});
