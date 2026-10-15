import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/virtual_thermostat_input.dart';

/// Read-only projection of the source-owned configuration and runtime contracts.
/// Joins by claim, never role: a missing sibling remains mandatory capacity.
class VirtualThermostatMember {
  final Map configuration;
  final Map? diagnostic;
  final bool historical;

  const VirtualThermostatMember(
    this.configuration,
    this.diagnostic, {
    this.historical = false,
  });

  String get claim =>
      configuration['id']?.toString() ?? diagnostic?['claim']?.toString() ?? '';
  String get role =>
      configuration['role']?.toString() ??
      diagnostic?['role']?.toString() ??
      'unknown';
  String get identity =>
      configuration['physical_identity']?.toString() ??
      diagnostic?['physical_identity']?.toString() ??
      configuration['source_identity']?.toString() ??
      claim;
  String get state =>
      configuration['state']?.toString() ??
      diagnostic?['claim_state']?.toString() ??
      'unknown';
  Map? get protection => diagnostic?['protection'] is Map
      ? diagnostic!['protection'] as Map
      : null;
  Map? get binding => configuration['protection'] is Map
      ? configuration['protection'] as Map
      : null;
  VirtualThermostatInput? get input =>
      protection == null ? null : VirtualThermostatInput.fromJson(protection!);
  double? get temperature {
    final value = protection?['temperature'];
    return value is num && value.isFinite ? value.toDouble() : null;
  }

  double? liveTemperature(Duration elapsed, DateTime now, bool current) =>
      !historical &&
          current &&
          input?.sampledAt != null &&
          input?.expiresAt != null &&
          input?.currentStatus(elapsed, now) == 'fresh' &&
          input?.quality == 'good'
      ? temperature
      : null;

  String observed(bool current) => !current || historical
      ? 'unavailable'
      : diagnostic?['activity']?.toString() ?? 'unknown';

  static List<VirtualThermostatMember> read(
    Map? config,
    Map? runtime, {
    bool historical = false,
  }) {
    final claims = config?[historical ? 'released_actuators' : 'actuators'];
    final diagnostics = runtime?['branches'];
    final rows = diagnostics is List
        ? diagnostics.whereType<Map>().toList()
        : <Map>[];
    final result = <VirtualThermostatMember>[];
    if (claims is List) {
      for (final claim in claims.whereType<Map>()) {
        final matching = rows.where((row) => row['claim'] == claim['id']);
        result.add(
          VirtualThermostatMember(
            claim,
            matching.firstOrNull,
            historical: historical,
          ),
        );
      }
    }
    // Preserve runtime-only retained reservations (and legacy singleton payloads).
    if (!historical) {
      for (final row in rows.where((row) => row['claim_state'] != 'released')) {
        if (!result.any(
          (member) => member.claim == row['claim'] && row['claim'] != null,
        )) {
          result.add(VirtualThermostatMember(const {}, row));
        }
      }
    }
    return result;
  }
}

/// A display-only freshness fence. Refetching an identical cached record cannot
/// revive a reading already expired on screen. One watermark per active claim
/// bounds memory and also rejects older samples after a newer one was displayed.
class VirtualThermostatReadingFence {
  final _samples = <String, ({DateTime time, bool expired})>{};

  Set<String> expiredClaims(
    List<VirtualThermostatMember> members,
    Duration elapsed,
    DateTime now,
  ) {
    final claims = members.map((member) => member.claim).toSet();
    _samples.removeWhere((claim, _) => !claims.contains(claim));
    final expired = <String>{};
    for (final member in members) {
      final input = member.input;
      final time = input?.sampledAt;
      if (time == null) {
        expired.add(member.claim);
        continue;
      }
      final previous = _samples[member.claim];
      if (previous != null && time.isBefore(previous.time)) {
        expired.add(member.claim);
        continue;
      }
      final stale =
          input!.currentStatus(elapsed, now) != 'fresh' ||
          (previous != null && time == previous.time && previous.expired);
      _samples[member.claim] = (time: time, expired: stale);
      if (stale) expired.add(member.claim);
    }
    return expired;
  }
}
