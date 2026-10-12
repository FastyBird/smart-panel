import dotenv from 'dotenv';
import * as path from 'path';

import { SqliteDataSource } from './common/database/sqlite-data-source';

const envPaths = [path.resolve(process.cwd(), '.env.local'), path.resolve(process.cwd(), '.env')];

for (const envPath of envPaths) {
	dotenv.config({ path: envPath, override: false, quiet: true });
}

const AppDataSource = new SqliteDataSource({
	type: 'sqlite',
	database:
		process.env.NODE_ENV === 'test'
			? ':memory:'
			: path.resolve(process.env.FB_DB_PATH || path.resolve(__dirname, '../../../var/db'), 'database.sqlite'),
	entities: [__dirname + '/**/*.entity{.ts,.js}'],
	subscribers: [__dirname + '/**/*.subscriber{.ts,.js}'],
	migrations: [__dirname + '/migrations/*{.ts,.js}'],
	migrationsTransactionMode: 'each',
	synchronize: process.env.FB_DB_SYNC === 'true',
	logging: process.env.FB_DB_LOGGING === 'true',
});

export default AppDataSource;
