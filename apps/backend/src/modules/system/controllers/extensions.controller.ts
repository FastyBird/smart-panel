import { FastifyRequest as Request, FastifyReply as Response } from 'fastify';
import * as mimeTypes from 'mime-types';
import fs from 'node:fs';
import path from 'node:path';

import { DiscoveredAdminExtension } from '@fastybird/smart-panel-extension-sdk';
import { Controller, Get, Logger, Param, Query, Req, Res } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config/dist/config.service';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import {
	ApiInternalServerErrorResponse,
	ApiSuccessUnionResponse,
} from '../../../common/decorators/api-documentation.decorator';
import { getDiscoveredExtensions } from '../../../common/extensions/extensions.discovery-cache';
import { getEnvValue } from '../../../common/utils/config.utils';
import { toInstance } from '../../../common/utils/transform.utils';
import { RawRoute } from '../../api/decorators/raw-route.decorator';
import { Public } from '../../auth/guards/auth.guard';
import { ExtensionAdminModel, ExtensionBackendModel } from '../models/system.model';
import {
	ExtensionKindType,
	ExtensionSourceType,
	ExtensionSurfaceType,
	SYSTEM_MODULE_PREFIX,
} from '../system.constants';

interface BundledManifest {
	bundled: Array<{
		name: string;
		version?: string;
		kind: ExtensionKindType;
		display_name?: string;
		description?: string;
	}>;
}

@ApiTags('system-module')
@Controller('extensions')
export class ExtensionsController {
	private readonly logger = new Logger(ExtensionsController.name);

	constructor(private readonly configService: NestConfigService) {}

	@Public()
	@Get()
	@ApiOperation({
		summary: 'List all extensions',
		description: 'Retrieve a list of all registered extensions, optionally filtered by surface',
	})
	@ApiQuery({
		name: 'surface',
		required: false,
		description: 'Filter by extension surface',
		enum: [...Object.values(ExtensionSurfaceType), 'all'],
	})
	@ApiSuccessUnionResponse([ExtensionAdminModel, ExtensionBackendModel], 'Extensions retrieved successfully')
	@ApiInternalServerErrorResponse()
	async list(
		@Query('surface') surface: ExtensionSurfaceType | 'all' = 'all',
	): Promise<(ExtensionAdminModel | ExtensionBackendModel)[]> {
		const { admin, backend } = await getDiscoveredExtensions();

		const bundledSet = this.loadBundledSet();

		const out: (ExtensionAdminModel | ExtensionBackendModel)[] = [];

		if (surface === ExtensionSurfaceType.ADMIN || surface === 'all') {
			for (const a of admin) {
				if (!a.extensionEntry) continue;

				out.push(
					toInstance(ExtensionAdminModel, {
						name: a.pkgName,
						kind: a.kind,
						surface: ExtensionSurfaceType.ADMIN,
						displayName: a.displayName ?? a.pkgName,
						description: a.description ?? undefined,
						version: this.readPkgVersionSafe(a.packageDir),
						source: bundledSet.has(a.pkgName) ? ExtensionSourceType.BUNDLED : ExtensionSourceType.RUNTIME,
						// We’ll serve files under /api/system-module/extensions/assets/<pkg>/<...>
						remoteUrl: `:baseUrl/${SYSTEM_MODULE_PREFIX}/extensions/assets/${encodeURIComponent(a.pkgName)}/${a.extensionEntry}`,
					}),
				);
			}
		}

		if (surface === ExtensionSurfaceType.BACKEND || surface === 'all') {
			for (const b of backend) {
				out.push(
					toInstance(ExtensionBackendModel, {
						name: b.pkgName,
						kind: b.kind,
						surface: ExtensionSurfaceType.BACKEND,
						displayName: b.displayName ?? b.pkgName,
						description: b.description ?? undefined,
						// version may be undefined if discovery didn’t attach packageDir for backend
						version:
							'packageDir' in (b as unknown as Record<string, unknown>) &&
							typeof (b as unknown as { packageDir?: string }).packageDir === 'string'
								? this.readPkgVersionSafe((b as unknown as { packageDir: string }).packageDir)
								: undefined,
						source: bundledSet.has(b.pkgName) ? ExtensionSourceType.BUNDLED : ExtensionSourceType.RUNTIME,
						// Backend entries expose where the Nest module is mounted
						routePrefix: b.routePrefix,
					}),
				);
			}
		}

		return out;
	}

	@Public()
	@Get(':name')
	async findOne(@Param('name') name: string): Promise<(ExtensionAdminModel | ExtensionBackendModel)[]> {
		this.logger.debug(`[LOOKUP] Fetching extension name=${name}`);

		const { admin, backend } = await getDiscoveredExtensions();

		const bundledSet = this.loadBundledSet();

		const out: (ExtensionAdminModel | ExtensionBackendModel)[] = [];

		for (const a of admin) {
			if (!a.extensionEntry || a.pkgName !== name) continue;

			out.push(
				toInstance(ExtensionAdminModel, {
					name: a.pkgName,
					kind: a.kind,
					surface: ExtensionSurfaceType.ADMIN,
					displayName: a.displayName ?? a.pkgName,
					description: a.description ?? undefined,
					version: this.readPkgVersionSafe(a.packageDir),
					source: bundledSet.has(a.pkgName) ? ExtensionSourceType.BUNDLED : ExtensionSourceType.RUNTIME,
					// We’ll serve files under /api/system-module/extensions/assets/<pkg>/<...>
					remoteUrl: `:baseUrl/${SYSTEM_MODULE_PREFIX}/extensions/assets/${encodeURIComponent(a.pkgName)}/${a.extensionEntry}`,
				}),
			);
		}

		for (const b of backend) {
			if (b.pkgName !== name) continue;

			out.push(
				toInstance(ExtensionBackendModel, {
					name: b.pkgName,
					kind: b.kind,
					surface: ExtensionSurfaceType.BACKEND,
					displayName: b.displayName ?? b.pkgName,
					description: b.description ?? undefined,
					// version may be undefined if discovery didn’t attach packageDir for backend
					version:
						'packageDir' in (b as unknown as Record<string, unknown>) &&
						typeof (b as unknown as { packageDir?: string }).packageDir === 'string'
							? this.readPkgVersionSafe((b as unknown as { packageDir: string }).packageDir)
							: undefined,
					source: bundledSet.has(b.pkgName) ? ExtensionSourceType.BUNDLED : ExtensionSourceType.RUNTIME,
					// Backend entries expose where the Nest module is mounted
					routePrefix: b.routePrefix,
				}),
			);
		}

		this.logger.debug(`[LOOKUP] Found extension name=${name}`);

		return out;
	}

	@RawRoute()
	@Public()
	@Get('assets/:pkg/*')
	async asset(@Param('pkg') pkg: string, @Req() req: Request, @Res() res: Response) {
		const { admin } = await getDiscoveredExtensions();

		const ext: DiscoveredAdminExtension | undefined = admin
			.filter((a) => !!a.extensionEntry)
			.find((a) => a.pkgName === pkg);

		if (!ext) {
			return res.status(404).send('Admin extension not found or has no runtime entry');
		}

		const wildcard =
			typeof req.params === 'object' && '*' in req.params && typeof req.params['*'] === 'string'
				? req.params['*']
				: undefined;
		const suffix = decodeURIComponent(wildcard ?? '').replace(/^\/+/, '');

		if (!suffix) {
			return res.status(400).send('Missing asset path');
		}

		let filePath: string;

		try {
			filePath = this.safeJoin(ext.packageDir, suffix);
		} catch (err: unknown) {
			if (err instanceof Error) {
				this.logger.error(`Invalid path: ${err.message}`, err.stack);
			} else {
				this.logger.error('Invalid path');
			}

			return res.status(400).send('Invalid path');
		}

		if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
			return res.status(404).send('Asset not found');
		}

		res.header('Content-Type', this.getContentType(filePath));
		res.header('Cache-Control', 'public, max-age=600');

		return res.send(fs.createReadStream(filePath));
	}

	private safeJoin = (root: string, p: string): string => {
		const resolved = path.resolve(root, p);

		if (!resolved.startsWith(root)) {
			throw new Error('Path traversal attempt');
		}

		return resolved;
	};

	private readPkgVersionSafe(dir?: string): string | undefined {
		if (!dir) {
			return undefined;
		}

		const pkgJson = path.join(dir, 'package.json');

		if (!fs.existsSync(pkgJson)) {
			return undefined;
		}

		try {
			const parsed = JSON.parse(fs.readFileSync(pkgJson, 'utf8')) as { version?: string };

			return parsed.version;
		} catch {
			return undefined;
		}
	}

	private loadBundledSet(): Set<string> {
		try {
			const manifestPath = path.resolve(this.configPath, 'extensions.manifest.json');

			if (!fs.existsSync(manifestPath)) {
				return new Set<string>();
			}

			const json = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as BundledManifest;

			const set = new Set<string>();

			for (const e of json.bundled ?? []) {
				set.add(e.name);
			}

			return set;
		} catch {
			return new Set<string>();
		}
	}

	private getContentType(p: string): string {
		const v = mimeTypes.lookup(p);

		return typeof v === 'string' ? v : 'application/octet-stream';
	}

	private get configPath(): string {
		return getEnvValue<string>(
			this.configService,
			'FB_CONFIG_PATH',
			path.resolve(__dirname, '../../../../../../var/data'),
		);
	}
}
