import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations_en.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/virtual_thermostat_member.dart';
import 'package:flutter/material.dart';

/// Diagnostics only. Structural ownership and installation recovery live in Admin.
class VirtualThermostatMembers extends StatelessWidget {
  final Map? configuration;
  final Map? runtime;
  final Duration elapsed;
  final DateTime now;
  final bool current;
  final Set<String> expiredMemberClaims;
  final Set<String> unavailableActivityClaims;
  const VirtualThermostatMembers({
    super.key,
    required this.configuration,
    required this.runtime,
    required this.elapsed,
    required this.now,
    required this.current,
    this.expiredMemberClaims = const {},
    this.unavailableActivityClaims = const {},
  });

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context) ?? AppLocalizationsEn();
    final active = VirtualThermostatMember.read(configuration, runtime);
    final history = VirtualThermostatMember.read(
      configuration,
      runtime,
      historical: true,
    );
    Widget field(String label, Object? value) =>
        Text('$label: ${value ?? l.thermostatMemberUnavailable}');
    Widget card(VirtualThermostatMember member) {
      final d = member.diagnostic;
      final p = member.protection;
      final input = member.input;
      final live = member.liveTemperature(
        elapsed,
        now,
        current && !expiredMemberClaims.contains(member.claim),
      );
      final evidence =
          member.configuration['release_evidence'] ?? d?['release_evidence'];
      return Card(
        key: ValueKey(
          'thermostat-member-${member.historical ? 'history-' : ''}${member.claim}',
        ),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${member.role} • ${member.identity}',
                style: Theme.of(context).textTheme.titleSmall,
              ),
              field(l.thermostatMemberClaim, member.claim),
              field(l.thermostatMemberState, member.state),
              field(
                l.thermostatMemberGroup,
                member.configuration['group_identity'] ?? d?['group_identity'],
              ),
              field(
                l.thermostatMemberSource,
                member.configuration['source_property'] ??
                    member.configuration['source_identity'],
              ),
              if (!member.historical) ...[
                field(
                  l.thermostatMemberRequested,
                  runtime?['requested_mode'] ??
                      configuration?['requested_mode'],
                ),
                field(
                  l.thermostatMemberObserved,
                  member.observed(
                    current &&
                        !unavailableActivityClaims.contains(member.claim),
                    now,
                  ),
                ),
                field(
                  l.thermostatMemberActivitySample,
                  member.activitySampledAt?.toUtc().toIso8601String(),
                ),
                field(
                  l.thermostatMemberActivityExpiry,
                  member.activityExpiresAt?.toUtc().toIso8601String(),
                ),
                field(
                  l.thermostatMemberQualificationCheck,
                  member.qualification(current),
                ),
                field(
                  l.thermostatMemberPending,
                  current ? (d?['pending_on']) : null,
                ),
                field(
                  l.thermostatMemberBlockers,
                  current && d != null && d.containsKey('fault')
                      ? d['fault'] ?? l.thermostatMemberNoBlocker
                      : null,
                ),
                field(
                  l.thermostatMemberProfile,
                  member.configuration['provider_profile'],
                ),
                // This public registry/target check is narrower than admission
                // or installation readiness; floor and relay evidence are separate.
                field(
                  l.thermostatMemberVersion,
                  member.configuration['provider_profile_version'],
                ),
                Text(l.thermostatMemberQualification),
                if (member.binding != null || p != null) ...[
                  field(
                    l.thermostatMemberProtectionSource,
                    p?['source_identity'] ?? member.binding?['source_identity'],
                  ),
                  field(
                    l.thermostatMemberReading,
                    live == null ? null : '${live.toStringAsFixed(1)} °C',
                  ),
                  field(
                    l.thermostatMemberQuality,
                    current ? input?.quality : null,
                  ),
                  field(
                    l.thermostatMemberFreshness,
                    current
                        ? (input != null &&
                                  expiredMemberClaims.contains(member.claim)
                              ? 'stale'
                              : input?.currentStatus(elapsed, now))
                        : null,
                  ),
                  field(
                    l.thermostatMemberAge,
                    input?.age(elapsed)?.toStringAsFixed(0),
                  ),
                  field(
                    l.thermostatMemberSample,
                    input?.sampledAt?.toUtc().toIso8601String(),
                  ),
                  field(l.thermostatMemberMaximumAge, input?.maximumAgeSeconds),
                  field(
                    l.thermostatMemberExpiry,
                    input?.expiresAt?.toUtc().toIso8601String(),
                  ),
                  if (live == null && member.temperature != null)
                    field(
                      l.thermostatMemberHistoryReading,
                      '${member.temperature!.toStringAsFixed(1)} °C',
                    ),
                  field(l.thermostatMemberCutoff, p?['effective_cutoff']),
                  field(
                    l.thermostatMemberLatch,
                    live != null ? (p?['latched']) : null,
                  ),
                  field(
                    l.thermostatMemberProtectionReady,
                    live != null ? (p?['ready']) : null,
                  ),
                  for (final reason in input?.reasons ?? <String>[])
                    field(l.thermostatMemberBlockers, reason),
                ],
                field(
                  l.thermostatMemberReleasePending,
                  current ? (d?['release_pending']) : null,
                ),
                if (!current && d != null) ...[
                  field(l.thermostatMemberHistoryPending, d['pending_on']),
                  field(l.thermostatMemberHistoryRelease, d['release_pending']),
                ],
                field(l.thermostatMemberAttempts, d?['release_attempts']),
                field(l.thermostatMemberNextRelease, d?['next_release_at']),
                field(
                  l.thermostatMemberDrain,
                  current ? (d?['release_proven']) : null,
                ),
              ],
              field(
                l.thermostatMemberGeneration,
                member.configuration['qualification_generation'],
              ),
              field(l.thermostatMemberLastOff, d?['last_verified_off_at']),
              field(
                l.thermostatMemberReleaseRequested,
                member.configuration['release_requested_at'],
              ),
              field(
                l.thermostatMemberReleasedAt,
                member.configuration['released_at'],
              ),
              if (member.configuration['reason'] != null)
                field(
                  l.thermostatMemberBlockers,
                  member.configuration['reason'],
                ),
              if (evidence == null) field(l.thermostatMemberEvidence, null),
              if (evidence is Map) ...[
                Text(l.thermostatMemberEvidence),
                for (final entry in evidence.entries)
                  Text('${entry.key}: ${entry.value}'),
              ],
            ],
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(l.thermostatMemberMandatory),
        Text(l.thermostatMemberWholeBranch),
        Text(l.thermostatMemberActivitySnapshot),
        if (!current) Text(l.thermostatMemberExpired),
        for (final member in active) card(member),
        if (history.isNotEmpty) ...[
          Text(l.thermostatMemberReleasedHistory),
          for (final member in history) card(member),
        ],
        if (active.isNotEmpty || history.isNotEmpty)
          Text(l.thermostatMemberAdmin),
      ],
    );
  }
}
