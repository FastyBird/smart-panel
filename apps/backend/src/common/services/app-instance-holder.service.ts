import { Injectable } from '@nestjs/common';
import { INestApplication } from '@nestjs/common';

@Injectable()
export class AppInstanceHolder {
	private app: INestApplication | null = null;

	setApp(app: INestApplication): void {
		this.app = app;
	}

	getApp(): INestApplication {
		if (!this.app) {
			throw new Error('Nest application instance is not set in AppInstanceHolder');
		}
		return this.app;
	}
}

