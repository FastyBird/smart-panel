import { FastifyRequest as Request, FastifyReply as Response } from 'fastify';
import * as mimeTypes from 'mime-types';
import fs from 'node:fs';
import path from 'node:path';

import { DiscoveredAdminExtension } from '@fastybird/smart-panel-extension-sdk';
import { Controller, Get, Logger, Param, Query, Req, Res } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config/dist/config.service';
import { ApiExcludeEndpoint, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';

import { MODULES_PREFIX } from '../../../app.constants';
import { getDiscoveredExtensions } from '../../../common/extensions/extensions.discovery-cache';
import { getEnvValue } from '../../../common/utils/config.utils';
import { toInstance } from '../../../common/utils/transform.utils';
import { RawRoute } from '../../api/decorators/raw-route.decorator';
import { Public } from '../../auth/guards/auth.guard';
import {
	ApiBadRequestResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import {
	EXTENSIONS_MODULE_API_TAG_NAME,
	EXTENSIONS_MODULE_PREFIX,
	ExtensionSource,
	ExtensionSurface,
} from '../extensions.constants';
import { DiscoveredExtensionAdminModel, DiscoveredExtensionBackendModel } from '../models/discovered-extension.model';
import { DiscoveredExtensionsResponseModel } from '../models/discovered-extensions-response.model';

interface BundledManifest {
	bundled: Array<{
		name: string;
		version?: string;
		kind: string;
		display_name?: string;
		description?: string;
	}>;
}

@ApiTags(EXTENSIONS_MODULE_API_TAG_NAME)
@Controller('discovered')
export class DiscoveredExtensionsController {
	private readonly logger = new Logger(DiscoveredExtensionsController.name);

	constructor(private readonly configService: NestConfigService) {}

	@ApiOperation({
		tags: [EXTENSIONS_MODULE_API_TAG_NAME],
		summary: 'List all discovered extensions',
		description: 'Retrieve a list of all discovered extensions, optionally filtered by surface',
		operationId: 'get-extensions-module-discovered-extensions',
	})
	@ApiQuery({
		name: 'surface',
		required: false,
		description: 'Filter by extension surface',
		enum: [...Object.values(ExtensionSurface), 'all'],
	})
	@ApiSuccessResponse(DiscoveredExtensionsResponseModel, 'Extensions retrieved successfully')
	@ApiBadRequestResponse('Invalid request parameters')
	@ApiInternalServerErrorResponse('Internal server error')
	@Public()
	@Get()
	async list(@Query('surface') surface: ExtensionSurface | 'all' = 'all'): Promise<DiscoveredExtensionsResponseModel> {
		const { admin, backend } = await getDiscoveredExtensions();

		const bundledSet = this.loadBundledSet();

		const out: (DiscoveredExtensionAdminModel | DiscoveredExtensionBackendModel)[] = [];

		if (surface === ExtensionSurface.ADMIN || surface === 'all') {
			for (const a of admin) {
				if (!a.extensionEntry) continue;

				out.push(
					toInstance(DiscoveredExtensionAdminModel, {
						name: a.pkgName,
						kind: a.kind,
						surface: ExtensionSurface.ADMIN,
						displayName: a.displayName ?? a.pkgName,
						description: a.description ?? undefined,
						version: this.readPkgVersionSafe(a.packageDir),
						source: bundledSet.has(a.pkgName) ? ExtensionSource.BUNDLED : ExtensionSource.RUNTIME,
						remoteUrl: `:baseUrl/${MODULES_PREFIX}/${EXTENSIONS_MODULE_PREFIX}/discovered/assets/${encodeURIComponent(a.pkgName)}/${a.extensionEntry}`,
					}),
				);
			}
		}

		if (surface === ExtensionSurface.BACKEND || surface === 'all') {
			for (const b of backend) {
				out.push(
					toInstance(DiscoveredExtensionBackendModel, {
						name: b.pkgName,
						kind: b.kind,
						surface: ExtensionSurface.BACKEND,
						displayName: b.displayName ?? b.pkgName,
						description: b.description ?? undefined,
						version:
							'packageDir' in (b as unknown as Record<string, unknown>) &&
							typeof (b as unknown as { packageDir?: string }).packageDir === 'string'
								? this.readPkgVersionSafe((b as unknown as { packageDir: string }).packageDir)
								: undefined,
						source: bundledSet.has(b.pkgName) ? ExtensionSource.BUNDLED : ExtensionSource.RUNTIME,
						routePrefix: b.routePrefix,
					}),
				);
			}
		}

		const response = new DiscoveredExtensionsResponseModel();
		response.data = out;

		return response;
	}

	@ApiOperation({
		tags: [EXTENSIONS_MODULE_API_TAG_NAME],
		summary: 'Get discovered extension by name',
		description: 'Retrieve a specific discovered extension by its name',
		operationId: 'get-extensions-module-discovered-extension',
	})
	@ApiParam({ name: 'name', description: 'Extension name', type: 'string' })
	@ApiSuccessResponse(DiscoveredExtensionsResponseModel, 'Extension retrieved successfully')
	@ApiBadRequestResponse('Invalid extension name')
	@ApiNotFoundResponse('Extension not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Public()
	@Get(':name')
	async findOne(@Param('name') name: string): Promise<DiscoveredExtensionsResponseModel> {
		this.logger.debug(`[LOOKUP] Fetching extension name=${name}`);

		const { admin, backend } = await getDiscoveredExtensions();

		const bundledSet = this.loadBundledSet();

		const out: (DiscoveredExtensionAdminModel | DiscoveredExtensionBackendModel)[] = [];

		for (const a of admin) {
			if (!a.extensionEntry || a.pkgName !== name) continue;

			out.push(
				toInstance(DiscoveredExtensionAdminModel, {
					name: a.pkgName,
					kind: a.kind,
					surface: ExtensionSurface.ADMIN,
					displayName: a.displayName ?? a.pkgName,
					description: a.description ?? undefined,
					version: this.readPkgVersionSafe(a.packageDir),
					source: bundledSet.has(a.pkgName) ? ExtensionSource.BUNDLED : ExtensionSource.RUNTIME,
					remoteUrl: `:baseUrl/${MODULES_PREFIX}/${EXTENSIONS_MODULE_PREFIX}/discovered/assets/${encodeURIComponent(a.pkgName)}/${a.extensionEntry}`,
				}),
			);
		}

		for (const b of backend) {
			if (b.pkgName !== name) continue;

			out.push(
				toInstance(DiscoveredExtensionBackendModel, {
					name: b.pkgName,
					kind: b.kind,
					surface: ExtensionSurface.BACKEND,
					displayName: b.displayName ?? b.pkgName,
					description: b.description ?? undefined,
					version:
						'packageDir' in (b as unknown as Record<string, unknown>) &&
						typeof (b as unknown as { packageDir?: string }).packageDir === 'string'
							? this.readPkgVersionSafe((b as unknown as { packageDir: string }).packageDir)
							: undefined,
					source: bundledSet.has(b.pkgName) ? ExtensionSource.BUNDLED : ExtensionSource.RUNTIME,
					routePrefix: b.routePrefix,
				}),
			);
		}

		this.logger.debug(`[LOOKUP] Found extension name=${name}`);

		const response = new DiscoveredExtensionsResponseModel();
		response.data = out;

		return response;
	}

	@ApiExcludeEndpoint()
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
