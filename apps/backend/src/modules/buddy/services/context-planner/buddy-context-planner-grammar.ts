import { BuddyContextDomain } from '../../models/context-plan.model';
import {
	BUDDY_ACTION_SIGNALS,
	BUDDY_COMPOUND_CONNECTOR_SIGNALS,
	BUDDY_CONDITION_SIGNALS,
	BUDDY_DEVICE_ACTION_SIGNALS,
	BUDDY_GROUNDED_STATE_SIGNALS,
	BUDDY_HOME_SIGNALS,
	BUDDY_LIGHTING_SIGNALS,
	BUDDY_RELATIVE_ADJUSTMENT_SIGNALS,
	BUDDY_SCENE_ACTION_SIGNALS,
	BUDDY_SPACE_SIGNALS,
	BUDDY_STATE_SIGNALS,
} from '../buddy-tool-selection.service';

export const MAX_EXPLICIT_SPACE_SCOPES = 20;
export const MAX_RECENT_ENTITY_REFERENCES = 20;
export const POWER_ACTION_TARGET_TOKEN_PATTERN_SOURCE = String.raw`(?!\b(?:already|appears?|are|be|been|brought|can|compare|consume|consumed|consumes|consumption|could|currently|draw|drawn|draws|electricity|energy|forced|go|goes|has|is|kept|knocked|kwh|left|looks?|made|may|might|must|neither|never|no|not|produce|produced|produces|production|remain|remains|report|seem|seems|should|show|shut|status|stay|stays|still|switched|switching|turn|turned|turning|usage|use|used|uses|was|were|went|whether|will|would)\b)[\p{Letter}\d'’-]+`;
export const POWER_ACTION_TARGET_PATTERN_SOURCE = String.raw`(?:(?:(?:my|our|the|your)\s+)?(?:it|them)|${POWER_ACTION_TARGET_TOKEN_PATTERN_SOURCE}(?:\s+${POWER_ACTION_TARGET_TOKEN_PATTERN_SOURCE}){0,7})`;
export const POWER_ACTION_SUFFIX_PATTERN_SOURCE = String.raw`(?=\s*(?:(?:asap|for\s+me|immediately|now|please|right\s+now)\s*)*(?:\b(?:after|at|before|for|if|in|on|throughout|til|till|until|when|while)\b|(?:[\p{Letter}\d.]+\s+){1,4}from\s+now\b|[?!,.;]|$))`;
export const POWER_ACTION_TAIL_PATTERN_SOURCE = String.raw`\s+(?:(?:off|on)\s+${POWER_ACTION_TARGET_PATTERN_SOURCE}\b|${POWER_ACTION_TARGET_PATTERN_SOURCE}\s+(?:off|on)\b)${POWER_ACTION_SUFFIX_PATTERN_SOURCE}`;
export const POWER_EVENT_SUBJECT_PATTERN_SOURCE = String.raw`(?:availability|backup|cut|failure|fault|outage|recovery|restoration|surge)`;
export const POWER_EVENT_STATE_SUBJECT_PATTERN_SOURCE = String.raw`(?:${POWER_EVENT_SUBJECT_PATTERN_SOURCE}|blackout|brownout|interruption|issue|loss|malfunction|problem|spike)`;
export const POWER_ACTION_PATTERN_SOURCE = String.raw`power(?!\s+${POWER_EVENT_SUBJECT_PATTERN_SOURCE}\b)(?=${POWER_ACTION_TAIL_PATTERN_SOURCE})`;
export const ACTION_SIGNAL_PATTERN_SOURCE = [...BUDDY_ACTION_SIGNALS, 'trigger', POWER_ACTION_PATTERN_SOURCE].join('|');
export const COMPOUND_CONNECTOR_PATTERN_SOURCE = [...BUDDY_COMPOUND_CONNECTOR_SIGNALS]
	.sort((left, right) => right.length - left.length)
	.join('|');
export const ACTION_REQUEST_PREFIX_PATTERN_SOURCE = String.raw`(?:(?:can|could|may|might|will|would) you|are you able to|i(?: need you to| want you to| would like you to|'d like you to)|is it possible to|is there any way you can)`;
export const ACTION_COMMAND_PREFIX_PATTERN_SOURCE = String.raw`^[?!,.;\s]*(?:(?:a|also|${COMPOUND_CONNECTOR_PATTERN_SOURCE}|if so|only|please)\s+)*(?:${ACTION_REQUEST_PREFIX_PATTERN_SOURCE}\s+(?:(?:also|only|please)\s+)*)?`;
export const TRAILING_ACTION_PREFIX_PATTERN_SOURCE = String.raw`(?:[?!,.;]|\b(?:a|${COMPOUND_CONNECTOR_PATTERN_SOURCE})\b)\s*(?:(?:also|if so|only|please)\s+)*(?:${ACTION_REQUEST_PREFIX_PATTERN_SOURCE}\s+(?:(?:also|only|please)\s+)*)?`;
export const ACTION_CONTINUATION_CONNECTOR_PATTERN = new RegExp(
	String.raw`^\s*(?:(?:,\s*)?(?:${COMPOUND_CONNECTOR_PATTERN_SOURCE})|(?:,\s*)?and\s+then|,)\s*$`,
	'u',
);
export const HOME_ENTITY_SIGNAL_PATTERN_SOURCE = [...BUDDY_HOME_SIGNALS]
	.filter((signal) => !['energy', 'energie', 'home', 'house', 'security', 'zabezpeceni'].includes(signal))
	.join('|');
export const GROUNDED_STATE_PATTERN_SOURCE = [...BUDDY_GROUNDED_STATE_SIGNALS].join('|');
export const GROUNDED_STATE_PATTERN = new RegExp(String.raw`\b(?:${GROUNDED_STATE_PATTERN_SOURCE})\b`, 'u');
export const STATE_SIGNAL_PATTERN = new RegExp(String.raw`\b(?:${[...BUDDY_STATE_SIGNALS].join('|')})\b`, 'u');
export const ACTION_CONDITION_STATE_PATTERN = /\b(?:dark|darker|light|lighter|ready)\b/u;
export const LIGHTING_PATTERN = new RegExp(String.raw`\b(?:${[...BUDDY_LIGHTING_SIGNALS].join('|')})\b`, 'u');
export const LIGHTING_GROUP_PATTERN = new RegExp(
	String.raw`\b(?:every|${[...BUDDY_SPACE_SIGNALS]
		.filter((signal) => ['all', 'lamps', 'lighting', 'lights', 'pokoj', 'room', 'svetla'].includes(signal))
		.join('|')})\b`,
	'u',
);
export const LIGHTING_GROUP_EXCLUSION_PATTERN =
	/\b(?:apart from|but not|but|except|excluding|instead of|krome|other than|rather than|save for|save|with(?: the)? exception of|without)\b/u;
const UNIT_LIGHTING_QUANTITY_PATTERN_SOURCE = String.raw`(?:one|two|three|four|five|six|seven|eight|nine)`;
const SMALL_LIGHTING_QUANTITY_PATTERN_SOURCE = String.raw`(?:zero|${UNIT_LIGHTING_QUANTITY_PATTERN_SOURCE}|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)`;
const WORD_LIGHTING_QUANTITY_PATTERN_SOURCE = String.raw`(?:${SMALL_LIGHTING_QUANTITY_PATTERN_SOURCE}|(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[-\s]${UNIT_LIGHTING_QUANTITY_PATTERN_SOURCE})?|(?:${UNIT_LIGHTING_QUANTITY_PATTERN_SOURCE}\s+)?hundred(?:\s+and\s+${SMALL_LIGHTING_QUANTITY_PATTERN_SOURCE})?|(?:a\s+)?dozens?(?:\s+of)?)`;
const TRUSTED_LIGHTING_TARGET_MODIFIER_PATTERN_SOURCE = String.raw`(?:bedside|ceiling|desk|outdoor|outside)`;
export const PARTIAL_LIGHTING_GROUP_PATTERN = new RegExp(
	String.raw`\b(?:a couple of|a few|a pair of|a quarter|a third|alternate|both(?:\s+of(?:\s+the)?)?|either(?=\s+(?:${TRUSTED_LIGHTING_TARGET_MODIFIER_PATTERN_SOURCE}\s+)?(?:lamp|lamps|light|lights)\b)|either\s+of(?:\s+the)?|every\s+other|half|most of|one third|one quarter|part of|portion of|several|some|\d+|${WORD_LIGHTING_QUANTITY_PATTERN_SOURCE}|(?:(?:a|the)\s+)?majority\s+of)\b.*\b(?:lamp|lamps|light|lights)\b`,
	'u',
);
export const ZERO_QUANTITY_LIGHTING_PATTERN = /\b(?:no|none|zero)\b.*\b(?:lamp|lamps|light|lights)\b/u;

export const DOMAIN_ORDER: readonly BuddyContextDomain[] = [
	'general',
	'home',
	'weather',
	'energy',
	'security',
	'history',
];
export const EXPLICIT_WEATHER_PATTERN =
	/\b(?:cloud|cloudy|fog|foggy|forecast|outdoor|outside|rain|rained|raining|snow|snowed|snowing|storm|stormy|sun|sunny|thunder|weather|wind)\b/u;
export const FUTURE_TEMPERATURE_PATTERN =
	/\btemperature\b.*\b(?:tomorrow|next (?:day|morning|week))\b|\b(?:tomorrow|next (?:day|morning|week))\b.*\btemperature\b/u;
export const WEATHER_PATTERN = new RegExp(
	String.raw`${EXPLICIT_WEATHER_PATTERN.source}|${FUTURE_TEMPERATURE_PATTERN.source}`,
	'u',
);
export const ENERGY_PATTERN = /\b(?:consumption|electricity|energy|kwh|power|production|usage)\b/u;
export const POWER_STATE_READ_PATTERN =
	/\bpower(?:\s+[\p{Letter}\d'’-]+){0,8}\s+(?:(?:already|currently|still)\s+|(?:appears?|are|be|go|goes|has\s+been|is|looks?|may\s+be|remain|remains|seem|seems|should\s+be|stay|stays|turned|was|were|went)\s+)?(?:off|on)\b/u;
export const POWER_USAGE_READ_PATTERN =
	/\bpower\b[^?!,.;]{0,80}\b(?:consume|consumed|consumes|consumption|draw|drawn|draws|produce|produced|produces|production|use|used|uses|usage)\b/u;
export const POWER_MEASUREMENT_READ_PATTERN = /\bhow much\b/u;
export const POWER_EVENT_STATE_READ_PATTERN = new RegExp(
	String.raw`\bpower\s+${POWER_EVENT_STATE_SUBJECT_PATTERN_SOURCE}\b|\bpower\s+status\b`,
	'u',
);
export const ENERGY_PREDICATE_PATTERN_SOURCE = String.raw`(?:consum(?:e|ed|es|ption)|produc(?:e|ed|es|tion)|us(?:e|ed|es|age))`;
export const UNSUPPORTED_MEASUREMENT_READ_PATTERN = new RegExp(
	String.raw`\b(?:battery|data|fuel|gas|water)\b[^?!,.;]{0,80}\b${ENERGY_PREDICATE_PATTERN_SOURCE}\b`,
	'u',
);
export const ENERGY_ELLIPSIS_READ_PATTERN = new RegExp(
	String.raw`^how\s+much\b.*\b${ENERGY_PREDICATE_PATTERN_SOURCE}\b`,
	'u',
);
export const REPEATED_ENERGY_CONNECTOR_PATTERN = new RegExp(
	String.raw`^\s*${ENERGY_PREDICATE_PATTERN_SOURCE}\s*,?\s+(?:and|or|plus)\s+$`,
	'u',
);
export const LEADING_ENERGY_PREDICATE_PATTERN = new RegExp(String.raw`^\s*${ENERGY_PREDICATE_PATTERN_SOURCE}\b`, 'u');
export const DOMAIN_ENTITY_CATEGORY_PATTERN_SOURCE =
	'device|devices|fan|fans|lamp|lamps|light|lights|sensor|sensors|switch|switches';
export const WEATHER_ENTITY_NAME_PATTERN = new RegExp(
	String.raw`\b(?:outdoor|outside)\s+(?:${DOMAIN_ENTITY_CATEGORY_PATTERN_SOURCE})\b`,
	'gu',
);
export const ENERGY_ENTITY_NAME_PATTERN = new RegExp(
	String.raw`\bpower\s+(?:${DOMAIN_ENTITY_CATEGORY_PATTERN_SOURCE})\b`,
	'gu',
);
export const SECURITY_PATTERN = /\b(?:alarm|armed|intrusion|secure|security)\b/u;
export const SECURITY_ENTITY_NAME_PATTERN = new RegExp(
	String.raw`\b(?:alarm|security)\s+(?:${DOMAIN_ENTITY_CATEGORY_PATTERN_SOURCE})\b`,
	'gu',
);
export const CLOCK_TIME_VALUE_PATTERN_SOURCE = String.raw`(?:midnight|noon|(?:[01]?\d|2[0-3]):[0-5]\d(?:\s*(?:a\.?m\.?|p\.?m\.?))?|(?:0?[1-9]|1[0-2])\s*(?:a\.?m\.?|p\.?m\.?))`;
export const CLOCK_TIME_AT_VALUE_PATTERN_SOURCE = String.raw`(?:${CLOCK_TIME_VALUE_PATTERN_SOURCE}|(?:[01]?\d|2[0-3]))`;
export const CLOCK_TIME_HISTORY_PATTERN = new RegExp(
	String.raw`\b(?:from\s+${CLOCK_TIME_VALUE_PATTERN_SOURCE}\s+(?:to|until)\s+${CLOCK_TIME_VALUE_PATTERN_SOURCE}|between\s+${CLOCK_TIME_VALUE_PATTERN_SOURCE}\s+and\s+${CLOCK_TIME_VALUE_PATTERN_SOURCE}|since\s+${CLOCK_TIME_VALUE_PATTERN_SOURCE}|(?:after|before|until)\s+${CLOCK_TIME_AT_VALUE_PATTERN_SOURCE}|at\s+${CLOCK_TIME_AT_VALUE_PATTERN_SOURCE})\b`,
	'u',
);
export const SCHEDULED_ACTION_PATTERN = new RegExp(
	String.raw`\b(?:at\s+(?:dawn|dusk|sunrise|sunset|${CLOCK_TIME_AT_VALUE_PATTERN_SOURCE})(?!\s*(?:%|celsius\b|degrees?\b|fahrenheit\b|percent\b|°\s*(?:c|f)?))|after\s+(?:dawn|dusk|sunrise|sunset)|in\s+(?:a\s+little\s+while|half\s+an?\s+hour|(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|thirty)\s*(?:seconds?|secs?|minutes?|mins?|hours?|days?|weeks?|months?))|later|(?<!as\s)soon|this\s+(?:afternoon|evening|friday|monday|morning|night|saturday|sunday|thursday|tuesday|wednesday|week|weekend)|tomorrow|tonight|next\s+(?:day|evening|friday|monday|month|morning|night|saturday|sunday|thursday|tuesday|wednesday|week|weekend)|on\s+(?:friday|monday|saturday|sunday|thursday|tuesday|wednesday|weekdays?|weekends?)|when\s+i\s+(?:arrive|get\s+home|leave)|(?:after|for)\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|thirty)\s+(?:seconds?|minutes?|hours?|days?|weeks?|months?)|(?:each|every)\s+(?:(?:other|working)\s+)?(?:day|evening|friday|monday|morning|night|saturday|sunday|thursday|time|tuesday|wednesday|week|weekday|weekend)|daily|weekly|whenever)\b|^(?:at\s+(?:dawn|dusk|sunrise|sunset)|(?:friday|monday|saturday|sunday|thursday|tuesday|wednesday))\b`,
	'u',
);
export const LEADING_RECURRING_ACTION_PATTERN =
	/^(?:after\b|as\s+soon\s+as\b|before\b|every time\b|once\b|until\b|when\b|whenever\b)/u;
export const LEADING_UNSUPPORTED_ACTION_TEMPORAL_PATTERN =
	/^on\s+(?:halloween|my\s+anniversary|new\s+year's\s+(?:day|eve)|thanksgiving)\b/u;
export const UNSUPPORTED_ACTION_TEMPORAL_PATTERN =
	/\b(?:(?:after|before|during|following|near|until|upon)\b|as\s+soon\s+as\b|at\s+(?:(?:(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b|(?:a\s+)?quarter\s+(?:past|to)\s+(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b)(?!\s*(?:%|celsius\b|degrees?\b|fahrenheit\b|percent\b|°\s*(?:c|f)?))|bedtime\b|breakfast\b|dinner\b|lunchtime\b|the\s+end\b)|(?:around|by)\s+(?:(?:breakfast|dinner|lunchtime)\b|(?:friday|monday|saturday|sunday|thursday|tuesday|wednesday)\b|(?:dawn|dusk|sunrise|sunset)\b|(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b|\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?\b)|come\s+(?:dawn|dusk|friday|monday|saturday|sunday|sunrise|sunset|thursday|tuesday|wednesday)\b|in\s+(?:a\s+quarter\s+(?:of\s+an?\s+)?hour|the\s+future\b|(?:the\s+)?(?:autumn|fall|spring|summer|winter)\b|(?:[\p{Letter}\d.]+\s+){0,3}(?:days?|hours?|minutes?|months?|weeks?|years?))|(?:next|this)\s+(?:christmas|holiday|month|season|weekend|year)|on\s+(?:(?:april|august|december|february|january|july|june|march|may|november|october|september)\s+\d{1,2}|christmas|new\s+year's\s+day)\b|(?<!at\s)once\b|the\s+next\s+time\b|(?:[\p{Letter}\d.]+\s+){1,3}from\s+now|towards\s+evening\b|when\b|within\s+(?:[\p{Letter}\d.]+\s+){0,3}(?:days?|hours?|minutes?|months?|weeks?|years?)|(?:each|every)\s+(?:[\p{Letter}\d.]+\s+){0,2}(?:days?|fortnight|hours?|minutes?|months?|weeks?|years?)|annually\b|biweekly\b|eventually\b|fortnightly\b|monthly\b|quarterly\b|semiannually\b|sometime\b|yearly\b)\b/u;
export const UNSUPPORTED_ACTION_TEMPORAL_ADJUNCT_PATTERN =
	/\b(?:(?:effective|starting)\s+(?:friday|monday|saturday|sunday|thursday|tuesday|wednesday)|from\s+(?:friday|monday|saturday|sunday|thursday|tuesday|wednesday)\s+onward|by\s+the\s+end\s+of\s+the\s+day|at\s+(?:closing\s+time|daybreak|nightfall)|for\s+(?:the\s+)?(?:rest|remainder)\s+of\s+(?:the\s+)?(?:day|evening|month|night|week|weekend)|for\s+the\s+(?:night|weekend)|(?:all|the\s+entire|the\s+whole)\s+(?:day|evening|night|week|weekend)|on\s+my\s+birthday|overnight|through(?:out)?\s+(?:the\s+)?(?:day|evening|month|night|week|weekend)|(?:til|till)\s+(?:dawn|morning|sunrise))\b/u;
export const UNSUPPORTED_ACTION_TEMPORAL_CALENDAR_PATTERN =
	/\b(?:at\s+(?:supper|tea\s+time|the\s+weekend)|biannually|bimonthly|(?:around|at|by|come|effective|for|next|on|over|starting)\s+(?:christmas|easter|halloween|thanksgiving)|hourly|in\s+q[1-4]|next\s+(?:bank\s+)?holiday|next\s+quarter|(?:around|at|by|come|effective|for|on|over|starting)\s+(?:(?:my|our|the|your)\s+)?(?:[\p{Letter}'’-]+\s+){0,2}(?:anniversary|birthday|day|eve|holiday)\b|on\s+(?:\d{1,2}\/\d{1,2}|(?:the\s+)?(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+of\s+(?:april|august|december|february|january|july|june|march|may|november|october|september)|(?:april|august|december|february|january|july|june|march|may|november|october|september)\s+\d{1,2}(?:st|nd|rd|th)?)|weeknights)\b/u;
export const ACTION_DURATION_PATTERN =
	/\bfor\s+(?:(?!\b(?:but|if|then|when|while)\b)[\p{Letter}\p{Number}./⁄'’-]+\s+){0,7}(?:seconds?|secs?|minutes?|mins?|hours?|hrs?|days?|nights?|weeks?|months?)\b/u;
export const NONNUMERIC_ACTION_DURATION_PATTERN =
	/\bfor\s+(?:(?:a|an)\s+|half\s+(?:a|an)\s+)(?:seconds?|secs?|minutes?|mins?|hours?|hrs?|days?|weeks?|months?)\b/u;
export const QUALIFIED_ACTION_DURATION_PATTERN =
	/\bfor\s+(?:the\s+)?next\s+(?:\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(?:seconds?|secs?|minutes?|mins?|hours?|hrs?|days?|weeks?|months?)\b/u;
export const HISTORY_PATTERN =
	/\b(?:chart|graph|history|historical|past|trend|vcera|yesterday)\b|\bhow\s+(?:did|has|have|is|was)\b.*\b(?:change|changed|changing|varied)\b|\b(?:at\s+)?what time did\b|\bwhen did\b|\b(?:earlier today|(?:last|previous) (?:day|hour|minute|month|night|week|weekend|year)|this (?:afternoon|day|evening|hour|minute|month|morning|night|week|weekend|year))\b|\b(?:last|since)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|\b(?:did|was|were)\b.*\bon\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|\bon\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b.*\b(?:did|was|were)\b|\b(?:did|was|were)\b.*\btoday\b|\b(?:has|have)\b.*\bbeen\b.*\btoday\b|\btoday\b.*\b(?:did|was|were)\b|\btoday\b.*\b(?:has|have)\b.*\bbeen\b|\b(?:for|last|over)\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(?:minutes?|hours?|days?|weeks?|months?|years?)\b|\b(?:(?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+|\d+\s*)(?:minutes?|hours?|days?|weeks?|months?|years?)\s+(?:ago|earlier|prior)\b|\b\d{4}-\d{2}-\d{2}\b|\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+(?:[12]?\d|3[01])(?:st|nd|rd|th)?(?:,?\s+\d{4})?\b|\b(?:[12]?\d|3[01])(?:st|nd|rd|th)?\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+\d{4})?\b/u;
export const LEADING_WEEKDAY_HISTORY_PATTERN =
	/^\s*on\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s*$/u;
export const TEMPORAL_HISTORY_PATTERN = new RegExp(
	String.raw`(?:${HISTORY_PATTERN.source}|${CLOCK_TIME_HISTORY_PATTERN.source})`,
	'u',
);
export const CURRENT_STATE_PATTERN = /\b(?:at present|current|currently|now|right now)\b/u;
export const HOME_ENTITY_PATTERN =
	/\b(?:air|blind|blinds|device|devices|door|doors|fan|fans|garage|heater|heaters|lamp|lamps|light|lighting|lights|lock|locks|room|scene|scenes|sensor|sensors|switch|switches|thermostat|thermostats|window|windows)\b/u;
export const HOME_VOCABULARY_PATTERN = new RegExp(String.raw`\b(?:${HOME_ENTITY_SIGNAL_PATTERN_SOURCE})\b`, 'u');
export const POSSESSIVE_HOME_ENTITY_PATTERN =
	/\b(?:my|our)\s+(?:air|blind|blinds|device|devices|door|doors|fan|fans|garage|heater|heaters|lamp|light|lighting|lights|lock|locks|room|scene|scenes|sensor|sensors|switch|switches|thermostat|thermostats|window|windows)\b/u;
export const GENERAL_KNOWLEDGE_INVENTORY_PATTERN = /^how (?:many|much)\b.*\b(?:does|do) (?:a|an)\b/u;
export const HOME_INSTALLATION_PATTERN = /\b(?:home|house)\b/u;
export const HOME_STATE_PATTERN = /\b(?:cold|cooling|heating|humidity|temperature|warm)\b/u;
export const READ_PATTERN =
	/^(?:are|can you (?:check|compare|confirm|determine|fetch|get|read|report|show|tell|verify)|check|compare|confirm|determine|ensure|fetch|find|get|how (?:many|much)|is|list|make sure|read|report|search|see|show|tell(?: me)?|verify|what|which|will)\b/u;
export const PREDICATE_QUESTION_PATTERN =
	/^(?:are|can|could|did|do|does|had|has|have|is|may|might|must|should|when|will|would|was|were|je|jsou|jaka|jaky|ktere|kolik|(?:how|what|when|where|which|who|why)['’]s|(?:what|why) (?:are|did|do|does|had|has|have|is|was|were))\b/u;
export const ACTION_REQUEST_PATTERN = new RegExp(String.raw`^${ACTION_REQUEST_PREFIX_PATTERN_SOURCE}\b`, 'u');
export const ACTION_CANCELLATION_PATTERN = new RegExp(
	String.raw`(?:[?!,.;—–]|\b(?:and(?:\s+then)?|then)\b)\s*(?:abort(?:\s+(?:it|that))?\b|actually\s+(?:do\s+not|don't)\b|cancel\s+(?:it|that)\b|disregard\s+(?:it|that)\b|forget\s+it\b|ignore\s+(?:it|that)\b|never\s*mind\b|no\b\s*,?\s*(?:no\s+)?(?:action|only\s+(?:check\s+)?status|status\s+only)\b|do\s+nothing\b|do(?:\s+not|n't)\s+execute\b|just\s+status\b|read\s+only\b|scratch\s+(?:it|that)\b|status\s+only\b)`,
	'u',
);
export const MODAL_STATE_READ_PATTERN =
	/^(?:can|could|may|might|will|would) you (?:check|confirm|determine|fetch|get|read|report|show|tell|verify)(?: me)?\b.*\b(?:how|if|what|when|where|whether|which|why)\b/u;
export const WRITE_PATTERN = new RegExp(
	String.raw`\b(?:${[...BUDDY_DEVICE_ACTION_SIGNALS].join('|')}|${POWER_ACTION_PATTERN_SOURCE})\b`,
	'u',
);
export const TRIGGER_PATTERN = new RegExp(
	String.raw`\b(?:activate|deactivate|start|stop|trigger|${[...BUDDY_SCENE_ACTION_SIGNALS].join('|')})\b`,
	'u',
);
export const TARGET_DEPENDENT_ACTION_PATTERN = /\b(?:activate|deactivate|start|stop)\b/u;
export const DEVICE_RUN_TARGET_PATTERN = /\brun\b.*\b(?:device|fan|switch)\b/u;
export const SCENE_RUN_PATTERN = new RegExp(
	String.raw`\b(?:trigger|${[...BUDDY_SCENE_ACTION_SIGNALS].join('|')})\b`,
	'u',
);
export const DEVICE_ACTION_TARGET_PATTERN =
	/\b(?:blind|blinds|device|devices|door|doors|fan|fans|heater|heaters|lamp|lamps|light|lights|sensor|sensors|switch|switches|thermostat|thermostats|window|windows)\b/u;
export const TRUSTED_UNSCOPED_DEVICE_TARGET_PATTERN = new RegExp(
	String.raw`\b(?:(?:bathroom|bedroom|downstairs|garage|hallway|kitchen|living room|office|reading|security|upstairs)\s+(?:blind|blinds|device|devices|door|doors|fan|fans|heater|heaters|lamp|lamps|light|lights|sensor|sensors|switch|switches|thermostat|thermostats|window|windows)|${TRUSTED_LIGHTING_TARGET_MODIFIER_PATTERN_SOURCE}\s+(?:lamp|lamps|light|lights)|ceiling\s+(?:fan|fans)|(?:outdoor|outside)\s+(?:sensor|sensors)|power\s+(?:switch|switches))\b`,
	'u',
);
export const PLAUSIBLE_CUSTOM_HOME_TARGET_PATTERN =
	/\b(?:air purifiers?|aquarium pumps?|coffee makers?|dehumidifiers?|humidifiers?|irrigation|media volume|robot vacuums?|skylights?|sprinklers?)\b/u;
export const CLEAR_NON_HOME_ACTION_OBJECT_PATTERN =
	/^(?:(?:a|an|my|our|the|your)\s+)?(?:another|app|application|around|bluetooth|browser|build|car|chrome|conversation|countdown|deployment|dialog|dinner|dishwasher|docker|document|figma|file|hand|jest|lanes?|meeting|new|npm|page|password|payroll|recording|reminder|right|sandwich|screen|spotify|tabs?|talking|terminal|tests?|timer|voice|volume)\b/u;
export const ACTION_COMMAND_PATTERN = new RegExp(
	String.raw`${ACTION_COMMAND_PREFIX_PATTERN_SOURCE}(?:${ACTION_SIGNAL_PATTERN_SOURCE})\b`,
	'u',
);
export const CONDITION_PATTERN = new RegExp(String.raw`\b(?:${[...BUDDY_CONDITION_SIGNALS].join('|')})\b`, 'u');
export const LEADING_CONDITION_PATTERN = new RegExp(String.raw`^(?:${[...BUDDY_CONDITION_SIGNALS].join('|')})\b`, 'u');
export const RELATIVE_PATTERN = new RegExp(
	String.raw`\b(?:${[...BUDDY_RELATIVE_ADJUSTMENT_SIGNALS].join('|')}|times as)\b`,
	'u',
);
export const REPEATED_ACTION_PATTERN =
	/(?<!at\s)\b(?:once|thrice|twice)\b(?!\s+as\b)|\b(?:\d+|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+times?\b/u;
export const ACTION_RANGE_PATTERN =
	/\b(?:between\b[^?!,.;]+\band\b|from\b[^?!,.;]+\b(?:to|until)\b|\d+(?:\.\d+)?\s*[-–—]\s*\d+(?:\.\d+)?\b)/u;
export const ACTION_NON_SCALAR_BOUND_PATTERN =
	/\b(?:above|at least|at most|below|greater than|less than|more than|over|under)\s+[-+]?\d+(?:\.\d+)?\b/u;
export const RELATIVE_SCALAR_ADJUSTMENT_PATTERN =
	/\bby\s+(?:\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(?:%|celsius\b|degrees?\b|fahrenheit\b|percent\b|°\s*(?:c|f)?)/u;
export const UNSUPPORTED_SCENE_INVERSE_PATTERN = /\b(?:deactivate|stop)\b/u;
export const SCENE_TARGET_PATTERN =
	/\b(?:automation|automations|preset|presets|routine|routines|scena|scenu|scene|scenes)\b/u;
export const CONFLICTING_DEVICE_SCENE_QUALIFIER_PATTERN = new RegExp(
	String.raw`${DEVICE_ACTION_TARGET_PATTERN.source}\s+(?:in|with)\b[^,;.!?]*${SCENE_TARGET_PATTERN.source}`,
	'u',
);
export const QUOTED_ENTITY_TARGET_PATTERN =
	/"[^"]+"\s+(?:automation|device|door|fan|heater|lamp|light|preset|routine|scene|sensor|switch|thermostat|window)\b/u;
export const QUOTED_SCENE_TARGET_PATTERN = /"[^"]+"\s+(?:automation|preset|routine|scene)\b/u;
export const EXPLICIT_SCENE_KIND_SUFFIX_PATTERN =
	/\b(?:automation|preset|routine|scene)s?(?:\s+(?:asap|at\s+once|for\s+(?:me|us)|immediately|now|please|right\s+(?:away|now)|straight\s+away))*\s*[?!.,]*$/u;
export const EXPLICIT_SCENE_KIND_PREFIX_PATTERN =
	/^\s*(?:the\s+)?(?:automation|preset|routine|scene)s?\b(?:\s+called\b)?/u;
export const ACTION_TARGET_NEGATION_PATTERN =
	/\b(?:and\s+not|neither|rather than|instead of)\b|,\s*not\b|\bnot\s+(?:off|on)\b/u;
export const ACTION_PROHIBITION_PREFIX_PATTERN =
	/^(?:(?:but|please)\s+)?(?:avoid\b|be\s+sure\b[^,;.!?]*\bnot\s+to\b|do\b[^,;.!?]*(?:\bnot\b|\banything\s+(?:but|except)\b|\beverything\s+other\s+than\b)|don't\b|ensure\s+you\s+do\s+not\b|i\s+(?:(?:do\s+not|don't)\s+want|forbid)\s+you\s+to\b|i\s+request\s+you\s+not\b|it\s+is\s+(?:forbidden|not\s+allowed)\s+to\b|make\s+(?:[\p{Letter}-]+\s+){0,3}(?:certain|sure)\b[^,;.!?]*(?:\bnot\s+to\b|\bto\s+never\b|\byou\s+(?:do\s+not|don't|never)\b)|never\b|no\s+way\s+should\b|refrain\s+from\b|remember\s+not\s+to\b|try\b[^,;.!?]*\bnot\s+to\b|under\s+no\s+circumstances\b|you(?:'re|\s+are)\s+not\s+allowed\s+to\b|you\s+(?:had\s+better\s+not\b|may\s+under\s+no\s+circumstances\b|ought\s+not\b|(?:(?:cannot|can't|couldn't|mayn't|mightn't|mustn't|shouldn't|won't|wouldn't)\b|(?:must|should|will|would)\b[^,;.!?]*\bnot\b|are\b[^,;.!?]*(?:forbidden|not\s+allowed)\b))|(?:can|could|would)\s+you\b[^,;.!?]*\bnot\b)/u;
export const PRONOUN_PATTERN = /\b(?:ho|it|its|that|their|them|these|they|this|those)\b|\bthe one\b/u;
export const SINGULAR_REFERENCE_PRONOUN_PATTERN = /\b(?:ho|it|its|that|this)\b|\bthe one\b/u;
export const PLURAL_REFERENCE_PRONOUN_PATTERN = /\b(?:their|them|these|they|those)\b/u;
export const PLURAL_HOME_TARGET_PATTERN =
	/\b(?:blinds|devices|doors|fans|heaters|lamps|lights|locks|scenes|sensors|switches|thermostats|windows)\b/u;
export const RELATIVE_REFERENCE_ANTECEDENT_PATTERN = new RegExp(
	String.raw`(?:${HOME_ENTITY_PATTERN.source}|${PLAUSIBLE_CUSTOM_HOME_TARGET_PATTERN.source}|${TRUSTED_UNSCOPED_DEVICE_TARGET_PATTERN.source})(?:\s+[\p{Letter}\p{Number}'’-]+){0,5}\s*$`,
	'u',
);
const WRAPPED_AGGREGATE_STATE_PATTERN_SOURCE = String.raw`(?:${GROUNDED_STATE_PATTERN_SOURCE}|${HOME_STATE_PATTERN.source}|running|triggered)`;
const AGGREGATE_STATE_MODIFIER_PATTERN_SOURCE = String.raw`(?:already|almost|completely|fully|not|only|partially|slightly|still|${CURRENT_STATE_PATTERN.source})`;
const AGGREGATE_STATE_VALUE_PATTERN_SOURCE = String.raw`(?:(?:${AGGREGATE_STATE_MODIFIER_PATTERN_SOURCE})\s+){0,2}${WRAPPED_AGGREGATE_STATE_PATTERN_SOURCE}`;
const PROGRESSIVE_STATE_LINKER_PATTERN_SOURCE = String.raw`being\s+(?:left|powered|switched|turned)`;
const STATE_LINKING_VERB_PATTERN_SOURCE = String.raw`(?:${PROGRESSIVE_STATE_LINKER_PATTERN_SOURCE}|appear|appears|are|is|left|look|looks|powered|remain|remains|seem|seems|stay|stays|switched|turned|was|were)`;
export const RELATIVE_REFERENCE_PRONOUN_PATTERN = new RegExp(
	String.raw`\b(?:that|which)\s+(?:${AGGREGATE_STATE_MODIFIER_PATTERN_SOURCE}\s+)?${STATE_LINKING_VERB_PATTERN_SOURCE}\b(?=\s+(?:${AGGREGATE_STATE_MODIFIER_PATTERN_SOURCE}\s+)?(?:${STATE_LINKING_VERB_PATTERN_SOURCE}\s+)?${AGGREGATE_STATE_VALUE_PATTERN_SOURCE}\b)`,
	'gu',
);
export const TEMPORAL_THIS_REFERENCE_PATTERN =
	/\bthis\s+(?:afternoon|day|evening|hour|minute|month|morning|night|week|weekend|year)\b/gu;
export const LOCALIZED_REFERENCE_PRONOUN_PATTERN =
	/\b(?:aktivuj|nastav|odemkni|otevri|sniz|spust|vypni|zamkni|zapni|zavri|zvys)\s+(?:ho|to)\b/u;
export const LOCALIZED_STATE_REFERENCE_PRONOUN_PATTERN = new RegExp(
	String.raw`^(?:a\s+)?(?:je|jsou)\s+to\b.*\b(?:${[...BUDDY_GROUNDED_STATE_SIGNALS, ...BUDDY_STATE_SIGNALS].join(
		'|',
	)})\b`,
	'u',
);
export const CAPABILITY_DISCOVERY_PATTERN = new RegExp(
	String.raw`^(?:(?:what|which)\b|(?:can|could|would) you (?:show|tell)(?: me)?\b).*\b(?:am i able to|can i|i can)\b.*\b(?:${ACTION_SIGNAL_PATTERN_SOURCE})\b`,
	'u',
);
export const CONTEXTUAL_SCOPE_PATTERN = /\b(?:here|in this room|this space)\b/u;
export const CONTEXTUAL_SCOPE_REFERENCE_PATTERN = /\b(?:in this room|this space)\b/gu;
export const GENERIC_ACTION_TARGET_PATTERN =
	/\b(?:a|all|an|any|every|the)\s+(?:(?:bathroom|bedroom|downstairs|garage|hallway|kitchen|living room|office|upstairs)\s+)?(?:blind|blinds|device|devices|door|doors|fan|fans|heater|heaters|lamp|lamps|light|lights|scene|scenes|switch|switches|thermostat|thermostats|window|windows)\b|\b(?:(?:bathroom|bedroom|downstairs|garage|hallway|kitchen|living room|office|upstairs)\s+)?(?:blinds|devices|doors|fans|heaters|lamps|lights|scenes|switches|thermostats|windows)\b|^[?!,.;\s]*(?:(?:and(?: also)?|as well as|if so|please|plus|then)\s+)*(?:(?:can|could|may|might|will|would) you\s+(?:please\s+)?)?(?:activate|adjust|brighten|change|close|deactivate|decrease|dim|increase|lock|lower|make|open|raise|run|set|start|stop|switch|trigger|turn|unlock)\s+(?:off\s+|on\s+)?(?:blind|device|door|fan|heater|lamp|light|scene|switch|thermostat|window)\b/u;
export const GENERIC_ACTION_TARGET_NAMES = [
	'blind',
	'blinds',
	'device',
	'devices',
	'door',
	'doors',
	'fan',
	'fans',
	'heater',
	'heaters',
	'lamp',
	'lamps',
	'light',
	'lights',
	'scene',
	'scenes',
	'switch',
	'switches',
	'thermostat',
	'thermostats',
	'window',
	'windows',
	'dvere',
	'lampa',
	'okno',
	'scena',
	'senzor',
	'svetlo',
	'termostat',
	'vypinac',
	'zaluzie',
	'zarizeni',
] as const;
export const BARE_GENERIC_ACTION_TARGET_PATTERN = new RegExp(
	String.raw`^[?!,.;\s]*(?:${[...BUDDY_ACTION_SIGNALS].join('|')})\s+(?:${GENERIC_ACTION_TARGET_NAMES.join('|')})\b`,
	'u',
);
export const BUILT_IN_ACTION_SPACE_NAMES = new Set([
	'bathroom',
	'bedroom',
	'downstairs',
	'garage',
	'hallway',
	'kitchen',
	'living room',
	'office',
	'upstairs',
]);
export const EXACT_BUILT_IN_THERMOSTAT_TARGET_PATTERN =
	/\b(?:bathroom|bedroom|downstairs|garage|hallway|kitchen|living room|office|upstairs) thermostat\b/u;
const WHOLE_HOME_QUANTIFIER_PATTERN_SOURCE = String.raw`(?:all|any|each|every)(?:\s+one)?`;
export const WHOLE_HOME_SCOPE_PATTERN = new RegExp(
	String.raw`\b(?:entire|whole) (?:home|house)\b|\b(?:across|throughout) (?:the )?(?:home|house)\b|\banywhere(?:\s+at\s+all)?\b(?!\s+(?:around|at|else|here|in|inside|near|within)\b)|\beverywhere\b|\b${WHOLE_HOME_QUANTIFIER_PATTERN_SOURCE}(?:\s+of\s+the)?\s+(?:rooms?|spaces?)\b`,
	'u',
);
export const ANYWHERE_ELSE_PATTERN = /\banywhere else\b/u;
export const AGGREGATE_DEVICE_CATEGORY_PATTERN_SOURCE = String.raw`(?:air\s+(?:conditioners?|dehumidifiers?|humidifiers?|purifiers?)|av\s+receivers?|cameras?|doorbells?|game\s+consoles?|heating\s+units?|outlets?|projectors?|pumps?|robot\s+vacuums?|set[-\s]top\s+boxes|speakers?|sprinklers?|televisions?|tvs?|valves?|water\s+heaters?|window\s+coverings?)`;
const WRAPPED_AGGREGATE_HOME_TARGET_PATTERN_SOURCE = String.raw`(?:(?:contact|door|humidity|motion|temperature|window)\s+sensors?|smoke\s+(?:detectors?|sensors?)|(?:light|power)\s+switch(?:es)?|smart\s+(?:devices?|lights?|locks?|switch(?:es)?|thermostats?)|${AGGREGATE_DEVICE_CATEGORY_PATTERN_SOURCE}|${PLAUSIBLE_CUSTOM_HOME_TARGET_PATTERN.source}|${TRUSTED_UNSCOPED_DEVICE_TARGET_PATTERN.source}|${HOME_ENTITY_PATTERN.source})`;
const AGGREGATE_READ_QUANTIFIER_PATTERN_SOURCE = String.raw`(?:${WHOLE_HOME_QUANTIFIER_PATTERN_SOURCE}|none)`;
const AGGREGATE_HOME_TARGET_LOOKAHEAD_PATTERN_SOURCE = String.raw`(?=\s+(?:(?:of\s+)?(?:my|our|the|your)\s+)?(?:${WRAPPED_AGGREGATE_STATE_PATTERN_SOURCE}\s+)?${WRAPPED_AGGREGATE_HOME_TARGET_PATTERN_SOURCE}(?:\s+(?:${RELATIVE_REFERENCE_PRONOUN_PATTERN.source}\s+)?(?:${AGGREGATE_STATE_MODIFIER_PATTERN_SOURCE}\s+)?(?:${STATE_LINKING_VERB_PATTERN_SOURCE}\s+)?${AGGREGATE_STATE_VALUE_PATTERN_SOURCE}\b|\s+remains?\b(?=\s*[?!,.;]?$)|\s*[?!,.;]?\s*$))`;
export const UNSCOPED_AGGREGATE_READ_PATTERN = new RegExp(
	String.raw`^(?:(?:(?:please\s+)?(?:(?:can|could|may|might|will|would) you\s+(?:please\s+)?)?(?:check|confirm|determine|fetch|get|read|report|see|show|tell|verify)(?: me)?)\s+(?:if|whether)\s+(?:(?:are|is)(?:\s+there)?\s+|there\s+(?:are|is)\s+)?${AGGREGATE_READ_QUANTIFIER_PATTERN_SOURCE}\b${AGGREGATE_HOME_TARGET_LOOKAHEAD_PATTERN_SOURCE}|(?:are|is)(?:\s+there)?\s+${AGGREGATE_READ_QUANTIFIER_PATTERN_SOURCE}\b${AGGREGATE_HOME_TARGET_LOOKAHEAD_PATTERN_SOURCE}|do(?:es)?\s+${AGGREGATE_READ_QUANTIFIER_PATTERN_SOURCE}\b${AGGREGATE_HOME_TARGET_LOOKAHEAD_PATTERN_SOURCE}|do\s+(?:i|we)\s+have\s+${AGGREGATE_READ_QUANTIFIER_PATTERN_SOURCE}\b${AGGREGATE_HOME_TARGET_LOOKAHEAD_PATTERN_SOURCE}|count\b|how many\b)`,
	'u',
);
export const TRAILING_ACTION_PATTERN = new RegExp(
	String.raw`${TRAILING_ACTION_PREFIX_PATTERN_SOURCE}(?:${ACTION_SIGNAL_PATTERN_SOURCE})\b`,
	'u',
);
export const TRAILING_READ_PATTERN = new RegExp(
	String.raw`(?:[?!,.;]|\b(?:a|${COMPOUND_CONNECTOR_PATTERN_SOURCE})\b)\s*(?:(?:also|please)\s+)*(?:are|can|check|compare|confirm|could|determine|did|do|does|ensure|fetch|find|get|had|has|have|how|is|make sure|may|might|read|report|see|show|tell(?: me)?|verify|was|were|what|whether|which|will|would)\b`,
	'u',
);
