import { PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { PlatformRegistryService } from '../../../modules/devices/services/platform.registry.service';

export interface CoverOperationReadiness {
	operation: 'open' | 'close' | 'stop' | 'position' | 'tilt';
	commandable: boolean;
	members: { source_identity: string; commandable: boolean; reasons: string[] }[];
}
/** Preparation/readiness is metadata-only: never dispatches a probe or a physical command. */
export async function coverOperationReadiness(
	platforms: PlatformRegistryService | undefined,
	members: readonly { identity: string; channel: ChannelEntity | null; reasons?: string[] }[],
): Promise<CoverOperationReadiness[]> {
	return Promise.all(
		(['open', 'close', 'stop', 'position', 'tilt'] as const).map(async (operation) => {
			const results = await Promise.all(
				members.map(async (member) => {
					const property = member.channel?.properties?.find(
						(property) =>
							property.category ===
							(operation === 'position'
								? PropertyCategory.POSITION
								: operation === 'tilt'
									? PropertyCategory.TILT
									: PropertyCategory.COMMAND),
					);
					const device = member.channel?.device as DeviceEntity;
					const reasons = [...(member.reasons ?? [])];
					if (!member.channel || !property || !device) reasons.push('member_or_capability_missing');
					else if (!reasons.length) {
						try {
							const readiness = await platforms?.get(device)?.getCommandReadiness?.({
								property,
								channel: member.channel,
								device,
								value: operation === 'position' || operation === 'tilt' ? 0 : operation,
							});
							if (!readiness?.commandable)
								reasons.push(...(readiness?.reasons ?? ['qualified_cover_adapter_unavailable']));
						} catch {
							reasons.push('qualified_cover_adapter_unavailable');
						}
					}
					return { source_identity: member.identity, commandable: reasons.length === 0, reasons };
				}),
			);
			return {
				operation,
				commandable: results.length >= 2 && results.every((member) => member.commandable),
				members: results,
			};
		}),
	);
}
