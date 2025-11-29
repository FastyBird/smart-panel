import { Injectable, OnModuleInit } from '@nestjs/common';
import { INestApplication } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

// Global reference to the app instance (set before CommandFactory.run)
let globalAppInstance: INestApplication | null = null;

export function setGlobalAppInstance(app: INestApplication): void {
	globalAppInstance = app;
}

@Injectable()
export class AppInstanceHolder implements OnModuleInit {
	private app: INestApplication | null = null;

	constructor(private readonly moduleRef: ModuleRef) {}

	onModuleInit(): void {
		// If global app instance is set, use it
		if (globalAppInstance) {
			this.app = globalAppInstance;
		}
	}

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
