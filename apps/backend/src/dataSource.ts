import dotenv from 'dotenv';
import * as path from 'path';
import { DataSource } from 'typeorm';

const envPaths = [path.resolve(process.cwd(), '.env.local'), path.resolve(process.cwd(), '.env')];

for (const envPath of envPaths) {
	dotenv.config({ path: envPath, override: false });
}

const AppDataSource = new DataSource({
	type: 'sqlite',
	database:
		process.env.NODE_ENV === 'test'
			? ':memory:'
			: path.resolve(process.env.FB_DB_PATH || path.resolve(__dirname, '../../../var/db'), 'database.sqlite'),
	entities: [__dirname + '/**/*.entity{.ts,.js}'],
	subscribers: [__dirname + '/**/*.subscriber{.ts,.js}'],
	migrations: [__dirname + '/migrations/*{.ts,.js}'],
	synchronize: process.env.FB_DB_SYNC === 'true',
	logging: process.env.FB_DB_LOGGING === 'true',
});

module.exports = AppDataSource;
