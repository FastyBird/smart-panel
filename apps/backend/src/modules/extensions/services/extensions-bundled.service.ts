import fs from 'node:fs';
import path from 'node:path';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config/dist/config.service';

import { getEnvValue } from '../../../common/utils/config.utils';

interface BundledManifestEntry {
	name: string;
	version?: string;
	kind: 'module' | 'plugin';
	display_name?: string;
	description?: string;
}

interface BundledManifest {
	bundled: BundledManifestEntry[];
}

/**
 * Service for managing bundled extensions manifest.
 *
 * "Core" extensions are those that are bundled with the application (part of this repository).
 * "Non-core" extensions are those loaded at runtime from external packages.
 *
 * The bundled manifest is generated at build time by the generate-admin-extensions command.
 */
@Injectable()
export class ExtensionsBundledService {
	private readonly logger = new Logger(ExtensionsBundledService.name);

	private bundledSet: Set<string> | null = null;
	private manifest: BundledManifest | null = null;

	constructor(private readonly configService: NestConfigService) {}

	/**
	 * Check if an extension is bundled (core) with the application.
	 *
	 * If no manifest file exists, all extensions are considered core since they
	 * are bundled with the application. When third-party extension loading is
	 * implemented, only those would be non-core.
	 *
	 * @param extensionName - The package name of the extension
	 * @returns true if the extension is bundled, false otherwise
	 */
	isCore(extensionName: string): boolean {
		const bundledSet = this.getBundledSet();

		// If no manifest exists (empty set), assume all registered extensions are core
		// since third-party dynamic loading isn't implemented yet
		if (bundledSet.size === 0) {
			return true;
		}

		return bundledSet.has(extensionName);
	}

	/**
	 * Get all bundled extension names.
	 *
	 * @returns Array of bundled extension package names
	 */
	getBundledExtensionNames(): string[] {
		return Array.from(this.getBundledSet());
	}

	/**
	 * Get all bundled module names.
	 *
	 * @returns Array of bundled module package names
	 */
	getBundledModuleNames(): string[] {
		const manifest = this.loadManifest();

		return manifest?.bundled.filter((e) => e.kind === 'module').map((e) => e.name) ?? [];
	}

	/**
	 * Get all bundled plugin names.
	 *
	 * @returns Array of bundled plugin package names
	 */
	getBundledPluginNames(): string[] {
		const manifest = this.loadManifest();

		return manifest?.bundled.filter((e) => e.kind === 'plugin').map((e) => e.name) ?? [];
	}

	/**
	 * Get detailed information about bundled extensions.
	 *
	 * @returns Array of bundled extension entries with metadata
	 */
	getBundledExtensions(): BundledManifestEntry[] {
		const manifest = this.loadManifest();

		return manifest?.bundled ?? [];
	}

	/**
	 * Clear the cached manifest data. Useful for testing or when manifest changes.
	 */
	clearCache(): void {
		this.bundledSet = null;
		this.manifest = null;
	}

	private getBundledSet(): Set<string> {
		if (this.bundledSet) {
			return this.bundledSet;
		}

		const manifest = this.loadManifest();
		this.bundledSet = new Set<string>();

		for (const entry of manifest?.bundled ?? []) {
			this.bundledSet.add(entry.name);
		}

		return this.bundledSet;
	}

	private loadManifest(): BundledManifest | null {
		if (this.manifest !== null) {
			return this.manifest;
		}

		try {
			const manifestPath = path.resolve(this.configPath, 'extensions.manifest.json');

			if (!fs.existsSync(manifestPath)) {
				this.logger.debug(`Bundled manifest not found at ${manifestPath}`);

				return null;
			}

			this.manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as BundledManifest;

			this.logger.debug(`Loaded bundled manifest with ${this.manifest.bundled.length} extensions`);

			return this.manifest;
		} catch (error) {
			this.logger.warn(`Failed to load bundled manifest: ${error instanceof Error ? error.message : 'Unknown error'}`);

			return null;
		}
	}

	private get configPath(): string {
		return getEnvValue<string>(
			this.configService,
			'FB_CONFIG_PATH',
			path.resolve(__dirname, '../../../../../../var/data'),
		);
	}
}
