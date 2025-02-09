import inquirer from 'inquirer';
import { Command } from 'nestjs-command';

import { Injectable } from '@nestjs/common';

import { SeedService } from '../services/seed.service';

@Injectable()
export class SeedCommand {
	constructor(private readonly seedService: SeedService) {}

	@Command({
		command: 'seed:run',
		describe: 'Populate the database with sample data',
	})
	async seed() {
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
