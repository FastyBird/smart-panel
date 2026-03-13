import { GenericPlatform } from './generic.platform';

export class DevelopmentPlatform extends GenericPlatform {
	async rebootDevice(): Promise<void> {
		this.logger.log('[SYSTEM] Restarting NestJS process (dev mode)...');
		this.logger.log('[SYSTEM] The dev runner (nodemon/tsx watch) should restart the process automatically');

		// Give logs time to flush before exiting
		setTimeout(() => {
			process.exit(0);
		}, 500);
	}

	async powerOffDevice(): Promise<void> {
		this.logger.log('[SYSTEM] Stopping NestJS process (dev mode)...');

		setTimeout(() => {
			process.exit(0);
		}, 500);
	}
}
