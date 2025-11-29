import inquirer from 'inquirer';
import { Command, CommandRunner } from 'nest-commander';

import { Injectable } from '@nestjs/common';

import { SeedService } from '../services/seed.service';

@Command({
	name: 'seed:run',
	description: 'Populate the database with sample data',
})
@Injectable()
export class SeedCommand extends CommandRunner {
	constructor(private readonly seedService: SeedService) {
		super();
	}

	async run(_passedParams: string[], _options?: Record<string, any>): Promise<void> {
		const { proceed } = await inquirer.prompt<{ proceed: boolean }>([
			{
				type: 'confirm',
				name: 'proceed',
				message: 'This will populate the application database with demo data. Do you want to proceed?',
				default: true,
			},
		]);

		if (proceed) {
			await this.seedService.seed();
		}
	}
}
