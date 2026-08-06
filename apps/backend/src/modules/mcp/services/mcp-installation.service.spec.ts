import { Repository } from 'typeorm';

import { McpInstallationEntity } from '../entities/mcp-installation.entity';

import { McpInstallationService } from './mcp-installation.service';

describe('McpInstallationService', () => {
	it('persists and reuses a stable installation-specific audience', async () => {
		let stored: McpInstallationEntity | null = null;
		const repository = {
			findOne: jest.fn().mockImplementation(() => Promise.resolve(stored)),
			create: jest.fn((value: Partial<McpInstallationEntity>) => value),
			save: jest.fn().mockImplementation((value: McpInstallationEntity) => {
				stored = value;
				return Promise.resolve(stored);
			}),
		};
		const service = new McpInstallationService(repository as unknown as Repository<McpInstallationEntity>);

		const first = await service.getAudience();
		const second = await service.getAudience();

		expect(first).toMatch(/^urn:fastybird:smart-panel:[0-9a-f-]+:mcp$/);
		expect(second).toBe(first);
		expect(repository.save).toHaveBeenCalledTimes(1);
	});
});
