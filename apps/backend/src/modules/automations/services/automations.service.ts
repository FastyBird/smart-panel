import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { v4 as uuid } from 'uuid';

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import { ValidationExceptionFactory } from '../../../common/validation/validation-exception-factory';
import { SpacesService } from '../../spaces/services/spaces.service';
import {
	AUTOMATIONS_MAX_COUNT,
	AUTOMATIONS_MODULE_NAME,
	AutomationMode,
	AutomationStatus,
	EventType,
} from '../automations.constants';
import {
	AutomationsGraphValidationException,
	AutomationsNotFoundException,
	AutomationsRevisionConflictException,
	AutomationsSpaceValidationException,
	AutomationsValidationException,
} from '../automations.exceptions';
import { AutomationGraphDto } from '../dto/automation-graph.dto';
import { CreateAutomationDto } from '../dto/create-automation.dto';
import { UpdateAutomationDto } from '../dto/update-automation.dto';
import { AutomationEntity } from '../entities/automations.entity';
import { AutomationGraphSaveCheck, checkGraphForSave } from '../graph/save-policy';
import { AutomationGraphModel, createEmptyAutomationGraph } from '../models/automation-graph.model';
import { AutomationSummaryModel } from '../models/automations.model';

import { AutomationNodeTypeRegistryService } from './node-type-registry.service';

@Injectable()
export class AutomationsService {
	private readonly logger = createExtensionLogger(AUTOMATIONS_MODULE_NAME, 'AutomationsService');

	private createQueue: Promise<void> = Promise.resolve();

	constructor(
		@InjectRepository(AutomationEntity)
		private readonly repository: Repository<AutomationEntity>,
		private readonly spacesService: SpacesService,
		private readonly eventEmitter: EventEmitter2,
		private readonly nodeTypeRegistry: AutomationNodeTypeRegistryService,
	) {}

	/**
	 * Lists automations without their graphs. The graph column is not read from the database at all.
	 */
	async findAll(): Promise<AutomationSummaryModel[]> {
		this.logger.debug('[LOOKUP ALL] Fetching all automations');

		const automations = await this.repository.find({
			select: {
				id: true,
				createdAt: true,
				updatedAt: true,
				name: true,
				description: true,
				icon: true,
				enabled: true,
				spaceId: true,
				mode: true,
				revision: true,
				status: true,
				lastTriggeredAt: true,
				lastRunStatus: true,
			},
			order: {
				name: 'ASC',
				id: 'ASC',
			},
		});

		this.logger.debug(`[LOOKUP ALL] Found ${automations.length} automations`);

		return toInstance(AutomationSummaryModel, automations);
	}

	async findOne(id: string): Promise<AutomationEntity | null> {
		this.logger.debug(`[LOOKUP] Fetching automation with id=${id}`);

		const automation = await this.repository.findOneBy({ id });

		if (!automation) {
			this.logger.debug(`[LOOKUP] Automation with id=${id} not found`);

			return null;
		}

		this.logger.debug(`[LOOKUP] Successfully fetched automation with id=${id}`);

		return automation;
	}

	async getOneOrThrow(id: string): Promise<AutomationEntity> {
		const automation = await this.findOne(id);

		if (!automation) {
			this.logger.error(`[ERROR] Automation with id=${id} was not found.`);

			throw new AutomationsNotFoundException(`Automation with id=${id} was not found.`);
		}

		return automation;
	}

	async create(createDto: CreateAutomationDto): Promise<AutomationEntity> {
		const dtoInstance = await this.validateDto(CreateAutomationDto, createDto);

		if (dtoInstance.id && (await this.repository.existsBy({ id: dtoInstance.id }))) {
			throw new AutomationsValidationException(`Automation with id=${dtoInstance.id} already exists.`);
		}

		if (dtoInstance.space_id) {
			await this.validateSpace(dtoInstance.space_id);
		}

		const id = dtoInstance.id ?? uuid().toString();
		const graph = dtoInstance.graph ? this.toStoredGraph(dtoInstance.graph) : createEmptyAutomationGraph();

		await this.assertGraphCanBeSaved(graph, dtoInstance.enabled ?? false);

		// The limit check and the insert run as one serialized step, so concurrent creates cannot both pass
		// the check and exceed the limit.
		await this.serializeCreate(async () => {
			if ((await this.repository.count()) >= AUTOMATIONS_MAX_COUNT) {
				throw new AutomationsValidationException(
					`The limit of ${AUTOMATIONS_MAX_COUNT} automations is reached. Remove an automation before adding another.`,
				);
			}

			// The entity is assembled by hand, not through toInstance(): that helper rewrites every object key
			// to snake_case, which would also rewrite the keys of the opaque node configuration.
			await this.repository.insert({
				id,
				name: dtoInstance.name,
				description: dtoInstance.description ?? null,
				icon: dtoInstance.icon ?? null,
				enabled: dtoInstance.enabled ?? false,
				spaceId: dtoInstance.space_id ?? null,
				mode: dtoInstance.mode ?? AutomationMode.RESTART,
				graph,
				revision: 1,
				status: AutomationStatus.OK,
				lastTriggeredAt: null,
				lastRunStatus: null,
			});
		});

		const automation = await this.getOneOrThrow(id);

		this.logger.debug(`[CREATE] Created automation with id=${id}`);

		this.eventEmitter.emit(EventType.AUTOMATION_CREATED, automation);

		return automation;
	}

	/**
	 * Runs the given step after every earlier create step has settled. The backend is a single process, so an
	 * in-process queue is enough to make "check the limit, then insert" atomic.
	 */
	private serializeCreate<T>(step: () => Promise<T>): Promise<T> {
		const result = this.createQueue.then(step);

		this.createQueue = result.then(
			(): void => undefined,
			(): void => undefined,
		);

		return result;
	}

	/**
	 * Updates an automation with a revision compare-and-swap.
	 *
	 * The row is written by one conditional UPDATE that matches on the revision the caller based its edit on,
	 * so of two concurrent updates carrying the same revision exactly one succeeds.
	 */
	async update(id: string, updateDto: UpdateAutomationDto): Promise<AutomationEntity> {
		const dtoInstance = await this.validateDto(UpdateAutomationDto, updateDto);

		const existing = await this.getOneOrThrow(id);

		if (existing.revision !== dtoInstance.revision) {
			throw this.createRevisionConflict(id, dtoInstance.revision);
		}

		// A space is only checked when it changes, so an automation whose space was deleted since can still be
		// edited without first being moved elsewhere.
		if (dtoInstance.space_id && dtoInstance.space_id !== existing.spaceId) {
			await this.validateSpace(dtoInstance.space_id);
		}

		// The graph that will be stored is checked whenever it can become worse than it was: when a new graph
		// is submitted, and when the stored graph is switched on. Other saves (a rename, switching off) are
		// let through, so an automation whose node type has gone since can still be edited.
		const graph = dtoInstance.graph !== undefined ? this.toStoredGraph(dtoInstance.graph) : undefined;
		const enabled = dtoInstance.enabled ?? existing.enabled;

		if (graph !== undefined || (dtoInstance.enabled === true && !existing.enabled)) {
			await this.assertGraphCanBeSaved(graph ?? existing.graph, enabled);
		}

		const changes: QueryDeepPartialEntity<AutomationEntity> = {
			revision: dtoInstance.revision + 1,
			updatedAt: new Date(),
		};

		if (dtoInstance.name !== undefined) {
			changes.name = dtoInstance.name;
		}

		if (dtoInstance.description !== undefined) {
			changes.description = dtoInstance.description;
		}

		if (dtoInstance.icon !== undefined) {
			changes.icon = dtoInstance.icon;
		}

		if (dtoInstance.enabled !== undefined) {
			changes.enabled = dtoInstance.enabled;
		}

		if (dtoInstance.space_id !== undefined) {
			changes.spaceId = dtoInstance.space_id;
		}

		if (dtoInstance.mode !== undefined) {
			changes.mode = dtoInstance.mode;
		}

		if (graph !== undefined) {
			changes.graph = graph as QueryDeepPartialEntity<AutomationGraphModel>;
		}

		// Saving an automation the overload guard stopped resumes it (ADR 0003, decision 3)
		if (existing.status === AutomationStatus.SUSPENDED) {
			changes.status = AutomationStatus.OK;
		}

		const result = await this.repository.update({ id, revision: dtoInstance.revision }, changes);

		if (result.affected !== 1) {
			// Lost the race: the automation was either updated or deleted after it was read above
			if (!(await this.repository.existsBy({ id }))) {
				throw new AutomationsNotFoundException(`Automation with id=${id} was not found.`);
			}

			throw this.createRevisionConflict(id, dtoInstance.revision);
		}

		const automation = await this.getOneOrThrow(id);

		this.logger.debug(`[UPDATE] Updated automation with id=${id} to revision=${automation.revision}`);

		this.eventEmitter.emit(EventType.AUTOMATION_UPDATED, automation);

		return automation;
	}

	async remove(id: string): Promise<void> {
		const automation = await this.getOneOrThrow(id);

		await this.repository.delete({ id: automation.id });

		this.logger.debug(`[DELETE] Removed automation with id=${id}`);

		this.eventEmitter.emit(EventType.AUTOMATION_DELETED, { id });
	}

	/**
	 * Validates a graph against the registered node types without saving anything.
	 *
	 * @param enabled whether the automation the graph belongs to would be enabled; an enabled automation
	 * needs a complete graph, a disabled one may be a draft
	 */
	async checkGraph(graph: unknown, enabled: boolean): Promise<AutomationGraphSaveCheck> {
		return checkGraphForSave(graph, this.nodeTypeRegistry.lookup, { enabled });
	}

	private async assertGraphCanBeSaved(graph: unknown, enabled: boolean): Promise<void> {
		const check = await this.checkGraph(graph, enabled);

		if (check.valid) {
			return;
		}

		const blocking = check.issues.filter((issue) => issue.blocking).length;

		// The issues can quote submitted identifiers, so they go to the caller only and the log gets a count
		this.logger.error(`[VALIDATION FAILED] Graph validation failed with ${blocking} blocking issue(s)`);

		throw new AutomationsGraphValidationException(
			enabled
				? `The automation graph cannot be saved: it has ${blocking} problem(s). An enabled automation needs a complete graph.`
				: `The automation graph cannot be saved: it has ${blocking} problem(s).`,
			check.issues,
		);
	}

	private createRevisionConflict(id: string, revision: number): AutomationsRevisionConflictException {
		this.logger.warn(`[UPDATE] Automation with id=${id} is no longer at revision=${revision}`);

		return new AutomationsRevisionConflictException(
			`Automation with id=${id} was changed by somebody else. Reload it and apply the change again.`,
		);
	}

	private async validateSpace(spaceId: string): Promise<void> {
		const space = await this.spacesService.findOne(spaceId);

		if (!space) {
			throw new AutomationsSpaceValidationException(`Space with id=${spaceId} was not found.`);
		}
	}

	/**
	 * Copies the validated graph into the plain document that is stored, keeping only the known keys.
	 * The node configuration is kept exactly as it was submitted.
	 */
	private toStoredGraph(graph: AutomationGraphDto): AutomationGraphModel {
		return {
			version: graph.version,
			nodes: graph.nodes.map((node) => ({
				id: node.id,
				type: node.type,
				position: { x: node.position.x, y: node.position.y },
				config: node.config,
			})),
			edges: graph.edges.map((edge) => ({
				id: edge.id,
				source: edge.source,
				source_port: edge.source_port,
				target: edge.target,
				target_port: edge.target_port,
			})),
		};
	}

	private async validateDto<T extends object>(dtoClass: new () => T, data: T): Promise<T> {
		// plainToInstance() is used directly for the same reason the entity is assembled by hand in create()
		const dtoInstance = data instanceof dtoClass ? data : plainToInstance(dtoClass, data);

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
			stopAtFirstError: false,
			// The errors must not carry the submitted document: a graph can hold 100 nodes with arbitrary configuration
			validationError: { target: false, value: false },
		});

		if (errors.length > 0) {
			const reasons = ValidationExceptionFactory.createException(errors).getResponse() as { message: string[] };
			const message = reasons.message.join('; ');

			// The reasons can quote submitted identifiers, so they go to the caller only and the log gets a count
			this.logger.error(`[VALIDATION FAILED] DTO validation failed with ${reasons.message.length} problem(s)`);

			throw new AutomationsValidationException(`Provided automation data are invalid: ${message}`);
		}

		return dtoInstance;
	}
}
