import { readFileSync } from 'fs';

import { Inject, Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

import {
	DefinitionFileResult,
	DefinitionLoader,
	DefinitionSource,
} from '../../../common/definitions/definition-loader';
import { resolveUserDefinitionsDirectory } from '../../../common/definitions/user-definitions-directory';
import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { getEnvValue } from '../../../common/utils/config.utils';
import { ChannelsPropertiesService } from '../../devices/services/channels.properties.service';
import { AUTOMATIONS_MODULE_NAME } from '../automations.constants';
import {
	AutomationsGraphValidationException,
	AutomationsTemplateNotFoundException,
	AutomationsTemplateParametersException,
} from '../automations.exceptions';
import { checkGraphForSave } from '../graph/save-policy';
import { toDevicePropertyInfo } from '../nodes/built-in-node-types.service';
import { DevicePropertyLookup } from '../nodes/device-property.utils';
import { AutomationsService } from '../services/automations.service';
import { AutomationNodeTypeRegistryService } from '../services/node-type-registry.service';

import { AutomationTemplate, AutomationTemplateParameterValues } from './automation-template.types';
import {
	AutomationTemplateDraft,
	checkAutomationTemplate,
	checkAutomationTemplateAnswers,
	generateAutomationTemplateGraph,
	sampleAutomationTemplateAnswers,
} from './template-generator';

export const AUTOMATION_TEMPLATES_LOCATIONS = 'AUTOMATION_TEMPLATES_LOCATIONS';

const USER_FILE_PREFIX = 'module.automations.';

export interface AutomationTemplatesLocations {
	builtinDirectory: string;
	schemaPath: string;
}

export interface LoadedAutomationTemplate {
	template: AutomationTemplate;
	source: DefinitionSource;
	path: string;
	overridesBuiltin: boolean;
}

export interface AutomationTemplateCatalog {
	templates: LoadedAutomationTemplate[];
	files: DefinitionFileResult[];
}

/**
 * Loads the automation templates from the built-in definitions directory and the user locations, the way the
 * device mapping and Modbus template definitions are loaded, and generates the graph of a new automation from a
 * template and the answers to its questions.
 *
 * A template is checked when it is loaded: against the schema of the definition files, for the mistakes the
 * schema does not catch, and by generating its graph from sample answers and validating it against the registered
 * node types as a save of an enabled automation would. A template that fails is reported on its file and never
 * offered. Loading needs the node types, so the module loads the templates once it registered its own; a
 * template using a card of a plugin is therefore not offered.
 *
 * A generated graph is not stored: it is the draft of a new automation, which is created the ordinary way and
 * keeps nothing that points back at the template.
 */
@Injectable()
export class AutomationTemplatesService {
	private readonly logger = createExtensionLogger(AUTOMATIONS_MODULE_NAME, 'AutomationTemplatesService');

	private current: AutomationTemplateCatalog = { templates: [], files: [] };
	private byId = new Map<string, LoadedAutomationTemplate>();

	private readonly findProperty: DevicePropertyLookup = async (propertyId) => {
		const property = await this.propertiesService.findOne(propertyId);

		return property ? toDevicePropertyInfo(property) : null;
	};

	constructor(
		private readonly config: NestConfigService,
		private readonly nodeTypeRegistry: AutomationNodeTypeRegistryService,
		private readonly automationsService: AutomationsService,
		private readonly propertiesService: ChannelsPropertiesService,
		@Inject(AUTOMATION_TEMPLATES_LOCATIONS) private readonly locations: AutomationTemplatesLocations,
	) {}

	/** Loads the templates; a failure leaves no template offered and is logged, it never stops the module */
	async load(): Promise<void> {
		try {
			await this.reload();
		} catch (error) {
			const message = errorMessage(error);

			this.logger.error(
				`Automation templates could not be loaded: ${message}`,
				error instanceof Error ? error.stack : undefined,
			);

			this.current = {
				templates: [],
				files: [{ source: 'builtin', path: '.', loaded: 0, errors: [message], warnings: [] }],
			};
			this.byId = new Map();
		}
	}

	async reload(): Promise<AutomationTemplateCatalog> {
		const overrideDirectory = getEnvValue<string | undefined>(this.config, 'FB_AUTOMATIONS_TEMPLATES_PATH', undefined);

		const loader = new DefinitionLoader<AutomationTemplate>({
			builtinDirectory: this.locations.builtinDirectory,
			userDirectory: resolveUserDefinitionsDirectory(this.config),
			userFilePrefix: USER_FILE_PREFIX,
			overrideDirectory: overrideDirectory ? overrideDirectory : null,
			schema: JSON.parse(readFileSync(this.locations.schemaPath, 'utf8')) as object,
			collectionKey: 'templates',
			idOf: (template) => template.id,
			validateItem: (template) =>
				checkAutomationTemplate(template).map((problem) => `template ${template.id}: ${problem}`),
		});

		const result = loader.load();

		const templates: LoadedAutomationTemplate[] = [];

		for (const definition of result.definitions) {
			const problems = await this.checkGraph(definition.item);

			if (problems.length > 0) {
				const file = result.files.find((entry) => entry.source === definition.source && entry.path === definition.path);

				if (file) {
					file.errors.push(...problems.map((problem) => `template ${definition.id}: ${problem}`));
					file.loaded = Math.max(0, file.loaded - 1);
				}

				continue;
			}

			templates.push({
				template: definition.item,
				source: definition.source,
				path: definition.path,
				overridesBuiltin: definition.overridesBuiltin,
			});
		}

		for (const file of result.files) {
			for (const error of file.errors) {
				this.logger.warn(`Automation template file ${file.source}:${file.path} was not loaded: ${error}`);
			}
		}

		this.current = { templates, files: result.files };
		this.byId = new Map(templates.map((entry) => [entry.template.id, entry]));

		this.logger.log(
			`Loaded ${templates.length} automation templates from ${result.files.length} files (${
				result.files.filter((file) => file.errors.length > 0).length
			} with errors)`,
		);

		return this.current;
	}

	catalog(): AutomationTemplateCatalog {
		return this.current;
	}

	get(id: string): LoadedAutomationTemplate {
		const entry = this.byId.get(id);

		if (!entry) {
			throw new AutomationsTemplateNotFoundException(`Automation template ${id} does not exist`);
		}

		return entry;
	}

	/**
	 * Generates the draft of a new automation from a template and the answers to its questions. Refuses answers
	 * that are missing, of the wrong kind, out of bounds or that point at a device property the question does not
	 * take, and a generated graph the server would not save as an enabled automation. Nothing is stored.
	 */
	async generate(id: string, answers: AutomationTemplateParameterValues): Promise<AutomationTemplateDraft> {
		const { template } = this.get(id);

		const check = await checkAutomationTemplateAnswers(template, answers, this.findProperty);

		if (check.issues.length > 0) {
			throw new AutomationsTemplateParametersException(
				`The answers to template ${template.id} were refused: ${check.issues.length} problem(s).`,
				check.issues,
			);
		}

		const graph = generateAutomationTemplateGraph(template, check.values);

		const validation = await this.automationsService.checkGraph(graph, true);

		if (!validation.valid) {
			const blocking = validation.issues.filter((issue) => issue.blocking).length;

			throw new AutomationsGraphValidationException(
				`The automation generated from template ${template.id} could not be saved: it has ${blocking} problem(s).`,
				validation.issues,
			);
		}

		return { name: template.name, mode: template.mode, graph };
	}

	/** Generates the graph of a template from sample answers and validates it as a save of an enabled automation */
	private async checkGraph(template: AutomationTemplate): Promise<string[]> {
		try {
			const graph = generateAutomationTemplateGraph(template, sampleAutomationTemplateAnswers(template));

			const check = await checkGraphForSave(graph, this.nodeTypeRegistry.lookup, { enabled: true });

			return check.issues
				.filter((issue) => issue.blocking)
				.map((issue) => `${issue.node_id ? `node ${issue.node_id}: ` : ''}${issue.code}: ${issue.message}`);
		} catch (error) {
			return [`the graph could not be validated: ${errorMessage(error)}`];
		}
	}
}

function errorMessage(error: unknown): string {
	const message = (error as { message?: unknown } | null)?.message;

	return typeof message === 'string' ? message : 'unknown error';
}
