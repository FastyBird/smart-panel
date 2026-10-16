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
  Map? get cooling => diagnostic?['cooling_protection'] is Map
      ? diagnostic!['cooling_protection'] as Map
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

  DateTime? get activitySampledAt =>
      DateTime.tryParse(diagnostic?['activity_sampled_at']?.toString() ?? '');
  DateTime? get activityExpiresAt =>
      DateTime.tryParse(diagnostic?['activity_expires_at']?.toString() ?? '');
  String? get activity => const ['on', 'off'].contains(diagnostic?['activity'])
      ? diagnostic!['activity'] as String
      : null;
  bool? qualification(bool current) => !current || historical
      ? null
      : diagnostic?['qualification_ready'] is bool
      ? diagnostic!['qualification_ready'] as bool
      : null;

  String? observed(bool current, DateTime now) {
    final sampled = activitySampledAt;
    final expiry = activityExpiresAt;
    if (!current ||
        historical ||
        sampled == null ||
        expiry == null ||
        sampled.isAfter(now) ||
        !expiry.isAfter(sampled) ||
        !now.isBefore(expiry)) {
      return null;
    }
    return activity;
  }

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

  /// Only an accepted configuration can establish removal. Empty/loading view
  /// projections must not discard watermarks during same-device replacement.
  void retainClaims(Iterable<String> claims) {
    final active = claims.toSet();
    _samples.removeWhere((claim, _) => !active.contains(claim));
  }

  Set<String> expiredClaims(
    List<VirtualThermostatMember> members,
    Duration elapsed,
    DateTime now,
  ) {
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

/// Relay observations have their own original timestamps and lifetime. Neither
/// HTTP refresh nor floor samples can renew this independent display evidence.
class VirtualThermostatActivityFence {
  final _samples = <String, _ActivityWatermark>{};

  void retainClaims(Iterable<String> claims) {
    final active = claims.toSet();
    _samples.removeWhere((claim, _) => !active.contains(claim));
  }

  Set<String> unavailableClaims(
    List<VirtualThermostatMember> members,
    DateTime now,
    Duration clock,
  ) {
    final unavailable = <String>{};
    for (final member in members) {
      final previous = _samples[member.claim];
      final sampled = member.activitySampledAt;
      final expiry = member.activityExpiresAt;
      final activity = member.observed(true, now);
      final context =
          '${member.identity}/${member.configuration['qualification_generation'] ?? ''}';
      if (sampled == null ||
          expiry == null ||
          activity == null ||
          (previous != null && sampled.isBefore(previous.sampled))) {
        // A source gap or regression cannot restore the last observed sample.
        if (previous != null) previous.invalid = true;
        if (sampled != null &&
            (previous == null || sampled.isAfter(previous.sampled))) {
          _samples[member.claim] = _ActivityWatermark(
            sampled,
            expiry ?? sampled,
            clock,
            context,
            member.activity ?? 'unknown',
          )..invalid = true;
        }
        unavailable.add(member.claim);
        continue;
      }
      final deadline = clock + expiry.difference(now);
      if (previous != null && sampled == previous.sampled) {
        // Keep the earliest original expiry/budget, even across clock rollback
        // or a cached response that changes its expiry for the same sample.
        if (expiry.isBefore(previous.expiry)) previous.expiry = expiry;
        if (deadline < previous.deadline) previous.deadline = deadline;
        previous.invalid =
            previous.invalid ||
            previous.context != context ||
            previous.activity != activity ||
            !now.isBefore(previous.expiry) ||
            clock >= previous.deadline;
        if (previous.invalid) unavailable.add(member.claim);
      } else {
        _samples[member.claim] = _ActivityWatermark(
          sampled,
          expiry,
          deadline,
          context,
          activity,
        );
      }
    }
    return unavailable;
  }
}

class _ActivityWatermark {
  final DateTime sampled;
  DateTime expiry;
  Duration deadline;
  final String context;
  final String activity;
  bool invalid = false;
  _ActivityWatermark(
    this.sampled,
    this.expiry,
    this.deadline,
    this.context,
    this.activity,
  );
}

/// Cooling has no heating-floor sample. Keep its original expiry and a monotonic
/// display budget separately: identical HTTP refetches cannot revive stale data.
/// This is only a display fence, never installed qualification or command authority.
class VirtualThermostatCoolingFence {
  final _samples = <String, _CoolingWatermark>{};

  void retainClaims(Iterable<String> claims) {
    final active = claims.toSet();
    _samples.removeWhere((claim, _) => !active.contains(claim));
  }

  Set<String> freshClaims(
    List<VirtualThermostatMember> members,
    DateTime now,
    Duration clock,
  ) {
    final fresh = <String>{};
    for (final member in members) {
      final previous = _samples[member.claim];
      final cooling = member.cooling;
      final binding = member.configuration['cooling_protection'] is Map
          ? member.configuration['cooling_protection'] as Map
          : null;
      final expiry = DateTime.tryParse(
        cooling?['expires_at']?.toString() ?? '',
      );
      bool reading(Object? value) =>
          value is num && value.isFinite && value > -45 && value <= 60;
      if (member.historical ||
          member.role != 'cooling' ||
          expiry == null ||
          member.configuration['id'] != member.claim ||
          cooling?['claim'] != member.claim ||
          binding == null ||
          binding['schema_version'] != 1 ||
          binding['purpose'] != 'cooled_surface' ||
          binding['dew_point_property'] is! String ||
          binding['surface_property'] is! String ||
          binding['dew_point_identity'] != cooling?['dew_point_identity'] ||
          binding['surface_identity'] != cooling?['surface_identity'] ||
          !reading(cooling?['dew_point']) ||
          !reading(cooling?['surface']) ||
          cooling?['ready'] is! bool ||
          cooling?['latched'] is! bool ||
          cooling?['dew_point_identity'] is! String ||
          cooling?['surface_identity'] is! String) {
        if (previous != null) previous.invalid = true;
        continue;
      }
      final context =
          '${member.identity}/${member.configuration['revision']}/${member.configuration['qualification_generation']}/${binding['revision']}/${cooling!['dew_point_identity']}/${cooling['surface_identity']}';
      if (previous != null &&
          (expiry.isBefore(previous.expiry) ||
              (expiry == previous.expiry && previous.context != context))) {
        previous.invalid = true;
        continue;
      }
      if (previous == null || expiry.isAfter(previous.expiry)) {
        if (previous == null && _samples.length >= 128) continue;
        final remaining = expiry.difference(now);
        _samples[member.claim] = _CoolingWatermark(
          expiry,
          clock + (remaining.isNegative ? Duration.zero : remaining),
          context,
        );
      }
      final sample = _samples[member.claim]!;
      if (!now.isBefore(expiry) || clock >= sample.deadline) {
        sample.invalid = true;
      }
      if (!sample.invalid) fresh.add(member.claim);
    }
    return fresh;
  }
}

class _CoolingWatermark {
  final DateTime expiry;
  final Duration deadline;
  final String context;
  bool invalid = false;
  _CoolingWatermark(this.expiry, this.deadline, this.context);
}
