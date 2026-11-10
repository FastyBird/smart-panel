import { plainToInstance } from 'class-transformer';
import { ValidationError, validateSync } from 'class-validator';
import { readFileSync } from 'fs';

import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

import {
	DefinitionFileResult,
	DefinitionLoader,
	DefinitionSource,
} from '../../../common/definitions/definition-loader';
import { resolveUserDefinitionsDirectory } from '../../../common/definitions/user-definitions-directory';
import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { getEnvValue } from '../../../common/utils/config.utils';
import { DeviceValidationService } from '../../../modules/devices/services/device-validation.service';
import { DEVICES_MODBUS_PLUGIN_NAME } from '../devices-modbus.constants';
import { ModbusTemplateNotFoundException, ModbusValidationException } from '../devices-modbus.exceptions';
import { CreateModbusDeviceStructureDto } from '../dto/create-device-structure.dto';
import { validateModbusStructure, withDeviceInformation } from '../lib/structure-validation';
import {
	ModbusTemplateExpansion,
	ModbusTemplateExpansionError,
	ModbusTemplateOverrides,
	expandModbusTemplate,
} from '../lib/template-expander';
import { modbusTemplateRevision } from '../lib/template-revision';
import { ModbusTemplate } from '../templates/modbus-template.types';

export const MODBUS_TEMPLATES_LOCATIONS = 'MODBUS_TEMPLATES_LOCATIONS';

const USER_FILE_PREFIX = 'plugin.devices-modbus.';
const PLACEHOLDER_ENDPOINT_ID = '00000000-0000-4000-8000-000000000000';

export interface ModbusTemplatesLocations {
	builtinDirectory: string;
	schemaPath: string;
}

export interface LoadedModbusTemplate {
	template: ModbusTemplate;
	revision: string;
	source: DefinitionSource;
	path: string;
	overridesBuiltin: boolean;
	/** Counted on the default expansion. */
	channelCount: number;
	/** Properties with a read or write binding, counted on the default expansion. */
	pointCount: number;
}

export interface ModbusTemplateCatalog {
	templates: LoadedModbusTemplate[];
	files: DefinitionFileResult[];
}

/** Flattens class-validator errors; the DTO messages are JSON-encoded `{ field, reason }` lists. */
function flattenValidationErrors(errors: ValidationError[], parent = ''): string[] {
	return errors.flatMap((error) => {
		const path = parent ? `${parent}.${error.property}` : error.property;
		const own = Object.values(error.constraints ?? {}).map((message) => {
			try {
				const parsed = JSON.parse(message) as { reason?: unknown }[];

				if (Array.isArray(parsed) && parsed.every((entry) => typeof entry?.reason === 'string')) {
					return `${path}: ${parsed.map((entry: { reason: string }) => entry.reason).join(' ')}`;
				}
			} catch {
				// plain-text message
			}

			return `${path}: ${message}`;
		});

		return [...own, ...flattenValidationErrors(error.children ?? [], path)];
	});
}

/**
 * Loads Modbus device templates from the built-in directory and the user locations, validates every template by
 * expanding it and judging the result like `POST devices` does, and serves the resulting catalog. A template that
 * fails is reported on its file and never offered.
 */
@Injectable()
export class ModbusTemplatesService implements OnModuleInit {
	private readonly logger = createExtensionLogger(DEVICES_MODBUS_PLUGIN_NAME, 'ModbusTemplatesService');

	private current: ModbusTemplateCatalog = { templates: [], files: [] };
	private byId = new Map<string, LoadedModbusTemplate>();
	private readonly counts = new WeakMap<ModbusTemplate, { channelCount: number; pointCount: number }>();

	constructor(
		private readonly config: NestConfigService,
		private readonly deviceValidation: DeviceValidationService,
		@Inject(MODBUS_TEMPLATES_LOCATIONS) private readonly locations: ModbusTemplatesLocations,
	) {}

	onModuleInit(): void {
		try {
			this.reload();
		} catch (error) {
			const message = errorMessage(error);

			this.logger.error(
				`Modbus templates could not be loaded: ${message}`,
				error instanceof Error ? error.stack : undefined,
			);

			this.current = {
				templates: [],
				files: [{ source: 'builtin', path: '.', loaded: 0, errors: [message], warnings: [] }],
			};
			this.byId = new Map();
		}
	}

	reload(): ModbusTemplateCatalog {
		const overrideDirectory = getEnvValue<string | undefined>(this.config, 'FB_MODBUS_TEMPLATES_PATH', undefined);

		const loader = new DefinitionLoader<ModbusTemplate>({
			builtinDirectory: this.locations.builtinDirectory,
			userDirectory: resolveUserDefinitionsDirectory(this.config),
			userFilePrefix: USER_FILE_PREFIX,
			overrideDirectory: overrideDirectory ? overrideDirectory : null,
			schema: JSON.parse(readFileSync(this.locations.schemaPath, 'utf8')) as object,
			collectionKey: 'templates',
			idOf: (template) => template.id,
			validateItem: (template) => this.validateItem(template),
		});

		const result = loader.load();

		const templates = result.definitions.map((definition): LoadedModbusTemplate => {
			const counts = this.counts.get(definition.item) ?? { channelCount: 0, pointCount: 0 };

			return {
				template: definition.item,
				revision: modbusTemplateRevision(definition.item),
				source: definition.source,
				path: definition.path,
				overridesBuiltin: definition.overridesBuiltin,
				...counts,
			};
		});

		this.current = { templates, files: result.files };
		this.byId = new Map(templates.map((entry) => [entry.template.id, entry]));

		this.logger.log(
			`Loaded ${templates.length} Modbus templates from ${result.files.length} files (${
				result.files.filter((file) => file.errors.length > 0).length
			} with errors)`,
		);

		return this.current;
	}

	catalog(): ModbusTemplateCatalog {
		return this.current;
	}

	get(id: string): LoadedModbusTemplate {
		const entry = this.byId.get(id);

		if (!entry) {
			throw new ModbusTemplateNotFoundException(id);
		}

		return entry;
	}

	has(id: string): boolean {
		return this.byId.has(id);
	}

	preview(id: string, overrides: ModbusTemplateOverrides): ModbusTemplateExpansion {
		const entry = this.get(id);

		try {
			return expandModbusTemplate(entry.template, entry.revision, overrides);
		} catch (error) {
			if (error instanceof ModbusTemplateExpansionError) {
				throw new ModbusValidationException(error.issues.map((issue) => JSON.stringify(issue)));
			}

			throw error;
		}
	}

	private validateItem(template: ModbusTemplate): string[] {
		const prefix = `template ${template.id}: `;

		try {
			const expansion = expandModbusTemplate(template, modbusTemplateRevision(template));

			const dto = plainToInstance(CreateModbusDeviceStructureDto, {
				...expansion,
				name: template.name,
				endpoint_id: PLACEHOLDER_ENDPOINT_ID,
			});

			this.counts.set(template, {
				channelCount: expansion.channels.length,
				pointCount: expansion.channels.reduce(
					(total, channel) => total + channel.properties.filter((property) => property.read || property.write).length,
					0,
				),
			});

			const dtoIssues = flattenValidationErrors(validateSync(dto));

			if (dtoIssues.length > 0) {
				return dtoIssues.map((message) => prefix + message);
			}

			return validateModbusStructure(
				withDeviceInformation(dto, 'template'),
				(input) => this.deviceValidation.validateDeviceStructure(input).issues,
			).map((issue) => `${prefix}${issue.field}: ${issue.reason}`);
		} catch (error) {
			if (error instanceof ModbusTemplateExpansionError) {
				return error.issues.map((issue) => `${prefix}${issue.field}: ${issue.reason}`);
			}

			this.logger.error(
				`Validation of template ${template.id} failed: ${errorMessage(error)}`,
				error instanceof Error ? error.stack : undefined,
			);

			return [`${prefix}validation failed: ${errorMessage(error)}`];
		}
	}
}

function errorMessage(error: unknown): string {
	const message = (error as { message?: unknown } | null)?.message;

	return typeof message === 'string' ? message : 'unknown error';
}
