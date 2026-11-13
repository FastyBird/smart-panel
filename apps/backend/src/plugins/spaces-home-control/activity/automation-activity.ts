/** Prefix of the actor of an activation started by a mode schedule: `schedule:<schedule id>:<occurrence id>` */
export const SCHEDULE_ACTIVITY_ACTOR_PREFIX = 'schedule:';

/** Prefix of the actor of an activation started by an automation: `automation:<automation id>:<run id>` */
export const AUTOMATION_ACTIVITY_ACTOR_PREFIX = 'automation:';

/** The actor an automation run activates a mode as */
export const automationActivityActor = (automationId: string, runId: string): string =>
	`${AUTOMATION_ACTIVITY_ACTOR_PREFIX}${automationId}:${runId}`;

export const isAutomationActivityActor = (actor: string | null | undefined): boolean =>
	typeof actor === 'string' && actor.startsWith(AUTOMATION_ACTIVITY_ACTOR_PREFIX);

/**
 * Whether an activation was chosen by a schedule or an automation rather than by a person. The schedule's
 * "manual selection" indication is raised only for a selection that is not automatic.
 */
export const isAutomaticActivityActor = (actor: string | null | undefined): boolean =>
	typeof actor === 'string' && (actor.startsWith(SCHEDULE_ACTIVITY_ACTOR_PREFIX) || isAutomationActivityActor(actor));

/**
 * Server-created admission of an activation an automation asks for (ADR 0003, decision 9). It is an automatic
 * source: it does not set the occupancy manual hold, and it is admitted only while the selection it read is
 * still the current one, so an automation never overwrites a newer choice it did not see.
 */
export interface AutomationActivityAdmission {
	/** The activation the automation read before asking; null when the space had none */
	readonly previousActivationId: string | null;
	/** False once the run that asks is cancelled; checked again right before the selection is written */
	readonly isCurrent: () => boolean;
}
