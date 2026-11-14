import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { ChannelsPropertiesService } from '../../devices/services/channels.properties.service';
import { ChannelsService } from '../../devices/services/channels.service';
import { DevicesService } from '../../devices/services/devices.service';
import { ScenesService } from '../../scenes/services/scenes.service';
import { SpacesService } from '../../spaces/services/spaces.service';
import { AUTOMATIONS_MODULE_NAME, AUTOMATION_GRAPH_VERSION, AutomationMode } from '../automations.constants';
import { AutomationsGraphValidationException, AutomationsImportException } from '../automations.exceptions';
import { CreateAutomationDto } from '../dto/create-automation.dto';
import { AutomationNodeReferenceKind } from '../graph/node-type';
import { AutomationGraphModel } from '../models/automation-graph.model';
import { AutomationImportPreparation } from '../models/automation-transfer.model';
import { toDevicePropertyInfo } from '../nodes/built-in-node-types.service';
import {
	AutomationImportProblem,
	automationExportFileName,
	parseAutomationYaml,
	serializeAutomationYaml,
} from '../transfer/automation-yaml';
import {
	AutomationReferenceLookup,
	AutomationResolvedReferenceMapping,
	applyReferenceMappings,
	collectReferenceUses,
	findMissingReferences,
} from '../transfer/import-references';
import { flattenErrors } from '../utils/node-config-dto.utils';

import { AutomationsService } from './automations.service';
import { AutomationNodeTypeRegistryService } from './node-type-registry.service';

export interface AutomationExport {
	fileName: string;
	content: string;
}

export interface AutomationImportMappingRequest {
	kind: AutomationNodeReferenceKind;
	id: string;
	to: string;
}

/**
 * Exports an automation as a YAML document and prepares the import of one (design § JSON and YAML).
 *
 * An import is prepared, not stored: the file is read, checked with the rules of a create request and of a save
 * of a disabled automation - the safety policy included - and its references are looked up. The caller creates
 * the automation from the draft through the ordinary create request, which checks it all again, disabled.
 */
@Injectable()
export class AutomationTransferService {
	private readonly logger = createExtensionLogger(AUTOMATIONS_MODULE_NAME, 'AutomationTransferService');

	private readonly lookup: AutomationReferenceLookup = {
		exists: async (kind, id) => {
			switch (kind) {
				case 'device':
					return this.devicesService.exists(id);
				case 'channel':
					return this.channelsService.exists(id);
				case 'property':
					return this.propertiesService.exists(id);
				case 'scene':
					return (await this.scenesService.findOne(id)) !== null;
				case 'space':
					return (await this.spacesService.findOne(id)) !== null;
				case 'automation':
					return (await this.automationsService.findOne(id)) !== null;
				default:
					return false;
			}
		},
		propertyTargetExists: async (propertyId, channelId, deviceId) => {
			if (!(await this.propertiesService.exists(propertyId, channelId))) return false;

			return channelId === undefined || deviceId === undefined || this.channelsService.exists(channelId, deviceId);
		},
	};

	constructor(
		private readonly automationsService: AutomationsService,
		private readonly nodeTypeRegistry: AutomationNodeTypeRegistryService,
		private readonly devicesService: DevicesService,
		private readonly channelsService: ChannelsService,
		private readonly propertiesService: ChannelsPropertiesService,
		private readonly scenesService: ScenesService,
		private readonly spacesService: SpacesService,
	) {}

	async exportAutomation(id: string): Promise<AutomationExport> {
		const automation = await this.automationsService.getOneOrThrow(id);

		this.logger.debug(`[EXPORT] Exporting automation id=${id}`);

		return {
			fileName: automationExportFileName(automation.name),
			content: serializeAutomationYaml({
				name: automation.name,
				description: automation.description,
				icon: automation.icon,
				mode: automation.mode,
				spaceId: automation.spaceId,
				graph: automation.graph,
			}),
		};
	}

	/**
	 * Reads an import file and returns the automation it would create, with the given references pointed
	 * elsewhere and the references that still do not exist. Refuses a file that is not an automation document or
	 * holds fields a create request refuses (AutomationsImportException), a mapping to an entity that does not
	 * exist (the same), and a graph that could not be saved even disabled (AutomationsGraphValidationException).
	 */
	async prepareImport(
		yaml: string,
		mappings: AutomationImportMappingRequest[] = [],
	): Promise<AutomationImportPreparation> {
		const parsed = parseAutomationYaml(yaml);

		if (parsed.data === null) {
			throw this.importRejection(parsed.problems);
		}

		const dto = plainToInstance(CreateAutomationDto, { ...parsed.data, enabled: false });

		const errors = await validate(dto, {
			whitelist: true,
			forbidNonWhitelisted: true,
			stopAtFirstError: false,
			// The errors must not carry the submitted document
			validationError: { target: false, value: false },
		});

		if (errors.length > 0) {
			throw this.importRejection(
				flattenErrors(errors).map((problem) => ({ field: problem.field ?? 'yaml', reason: problem.reason })),
			);
		}

		const graph: AutomationGraphModel = {
			version: AUTOMATION_GRAPH_VERSION,
			nodes: (dto.graph?.nodes ?? []).map((node) => ({
				id: node.id,
				type: node.type,
				position: { x: node.position.x, y: node.position.y },
				config: node.config,
			})),
			edges: (dto.graph?.edges ?? []).map((edge) => ({
				id: edge.id,
				source: edge.source,
				source_port: edge.source_port,
				target: edge.target,
				target_port: edge.target_port,
			})),
		};

		const resolved = await this.resolveMappings(mappings);

		const uses = collectReferenceUses(graph, this.nodeTypeRegistry.lookup, dto.space_id ?? null);

		const mapped = applyReferenceMappings(graph, dto.space_id ?? null, uses, resolved);

		const missing = await findMissingReferences(
			collectReferenceUses(mapped.graph, this.nodeTypeRegistry.lookup, mapped.spaceId),
			this.lookup,
		);

		// A create request refuses a space that does not exist, so the automation is created without it
		const spaceMissing = missing.some((reference) => reference.usages.some((usage) => usage.nodeId === null));

		const check = await this.automationsService.checkGraph(mapped.graph, false);

		if (!check.valid) {
			const blocking = check.issues.filter((issue) => issue.blocking).length;

			throw new AutomationsGraphValidationException(
				`The imported automation cannot be saved: it has ${blocking} problem(s).`,
				check.issues,
			);
		}

		this.logger.debug(
			`[IMPORT] Prepared an import with ${graph.nodes.length} node(s) and ${missing.length} missing reference(s)`,
		);

		return {
			draft: {
				name: dto.name,
				description: dto.description ?? null,
				icon: dto.icon ?? null,
				mode: dto.mode ?? AutomationMode.RESTART,
				spaceId: spaceMissing ? null : mapped.spaceId,
				graph: mapped.graph,
			},
			missingReferences: missing,
			issues: check.issues,
		};
	}

	/** Looks up what each mapping points at; for a property, the channel and device it belongs to */
	private async resolveMappings(
		mappings: AutomationImportMappingRequest[],
	): Promise<AutomationResolvedReferenceMapping[]> {
		const problems: AutomationImportProblem[] = [];
		const resolved: AutomationResolvedReferenceMapping[] = [];

		for (const [index, mapping] of mappings.entries()) {
			if (mapping.kind === 'property') {
				const property = await this.propertiesService.findOne(mapping.to);
				const info = property ? toDevicePropertyInfo(property) : null;

				if (info && info.channelId !== null && info.deviceId !== null) {
					resolved.push({ ...mapping, channelId: info.channelId, deviceId: info.deviceId });

					continue;
				}
			} else if (await this.lookup.exists(mapping.kind, mapping.to)) {
				resolved.push({ ...mapping });

				continue;
			}

			problems.push({
				field: `mappings.${index}.to`,
				reason: `The ${mapping.kind} to refer to instead does not exist.`,
			});
		}

		if (problems.length > 0) {
			throw this.importRejection(problems);
		}

		return resolved;
	}

	private importRejection(problems: AutomationImportProblem[]): AutomationsImportException {
		// The problems can quote submitted identifiers, so they go to the caller only and the log gets a count
		this.logger.warn(`[IMPORT] An import file was refused with ${problems.length} problem(s)`);

		return new AutomationsImportException(
			`The file can not be imported as an automation: it has ${problems.length} problem(s).`,
			problems,
		);
	}
}
