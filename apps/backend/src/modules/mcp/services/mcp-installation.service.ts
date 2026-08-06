import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { McpInstallationEntity } from '../entities/mcp-installation.entity';

const INSTALLATION_KEY = 'installation';

@Injectable()
export class McpInstallationService {
	private installationId?: string;

	constructor(
		@InjectRepository(McpInstallationEntity)
		private readonly repository: Repository<McpInstallationEntity>,
	) {}

	async getInstallationId(): Promise<string> {
		if (this.installationId) {
			return this.installationId;
		}

		let installation = await this.repository.findOne({ where: { key: INSTALLATION_KEY } });

		if (!installation) {
			try {
				installation = await this.repository.save(
					this.repository.create({ key: INSTALLATION_KEY, installationId: uuid() }),
				);
			} catch {
				// Another process may have created the singleton concurrently.
				installation = await this.repository.findOne({ where: { key: INSTALLATION_KEY } });
			}
		}

		if (!installation) {
			throw new Error('Failed to initialize MCP installation identity');
		}

		this.installationId = installation.installationId;

		return this.installationId;
	}

	async getAudience(): Promise<string> {
		return `urn:fastybird:smart-panel:${await this.getInstallationId()}:mcp`;
	}
}
