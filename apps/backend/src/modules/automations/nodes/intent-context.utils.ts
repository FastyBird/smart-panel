import { INTENT_ORIGIN_AUTOMATION } from '../../intents/intents.constants';
import { IntentContext } from '../../intents/models/intent.model';
import { AutomationRunContext } from '../graph/node-type';

/**
 * The intent context of what an action does in a run: the automation as the origin, with its id. Every
 * built-in action that writes to a device or runs a scene hands it on, so the panel, the admin and Buddy
 * can tell a change made by an automation from one made by a person.
 */
export const automationIntentContext = (context: Pick<AutomationRunContext, 'automationId'>): IntentContext => ({
	origin: INTENT_ORIGIN_AUTOMATION,
	extra: { automationId: context.automationId },
});
