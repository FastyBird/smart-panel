import { EventEmitter2 } from '@nestjs/event-emitter';

import { SqliteDataSource } from '../../../common/database/sqlite-data-source';
import { SpaceLifecycleRegistryService } from '../../../modules/spaces/services/space-lifecycle-registry.service';
import { RoomSpaceEntity } from '../entities/room-space.entity';

import { SpaceActivityConfigService } from './space-activity-config.service';

/** Real SQLite/TypeORM STI schema; only physical domain boundaries are replaced in tests. */
export async function activityTestDatabase() {
	const database = await new SqliteDataSource({
		type: 'sqlite',
		database: ':memory:',
		synchronize: true,
		entities: [__dirname + '/../../../**/*.entity.ts'],
	}).initialize();
	const events = new EventEmitter2();
	const lifecycle = new SpaceLifecycleRegistryService();
	const configs = new SpaceActivityConfigService(database, lifecycle, events);
	configs.onModuleInit();
	const room = await database
		.getRepository(RoomSpaceEntity)
		.save(database.getRepository(RoomSpaceEntity).create({ name: 'Office' }));
	await database.transaction((manager) => lifecycle.reconcile(room, manager));
	return { database, events, lifecycle, configs, room };
}
export function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}
