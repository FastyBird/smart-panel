import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { ShellyCoverOrderingEntity } from '../entities/shelly-cover-ordering.entity';

@Injectable()
export class ShellyCoverOrderingService {
	constructor(
		@InjectRepository(ShellyCoverOrderingEntity) private readonly repository: Repository<ShellyCoverOrderingEntity>,
	) {}
	async blocked(physicalIdentity: string): Promise<boolean> {
		return (await this.repository.countBy({ physicalIdentity })) > 0;
	}
	async reserve(physicalIdentity: string): Promise<string | null> {
		const token = randomUUID();
		try {
			await this.repository.insert({ physicalIdentity, token, startedAt: new Date() });
			return token;
		} catch (error) {
			if ((error as { code?: string }).code === 'SQLITE_CONSTRAINT') return null;
			throw error;
		}
	}
	/** Only the owner with a matched successful RPC response may retire a sent operation. */
	async settle(physicalIdentity: string, token: string): Promise<void> {
		await this.repository.delete({ physicalIdentity, token });
	}
}
