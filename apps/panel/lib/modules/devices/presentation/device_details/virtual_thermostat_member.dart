import 'dart:convert';

import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/virtual_thermostat_input.dart';

/// Read-only projection of the source-owned configuration and runtime contracts.
/// Joins by claim, never role: a missing sibling remains mandatory capacity.
class VirtualThermostatMember {
  final Map configuration;
  final Map? diagnostic;
  final bool historical, ambiguous;

  const VirtualThermostatMember(
    this.configuration,
    this.diagnostic, {
    this.historical = false,
    this.ambiguous = false,
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
          !ambiguous &&
          claim.isNotEmpty &&
          current &&
          input?.sampledAt != null &&
          input?.expiresAt != null &&
          input?.currentStatus(elapsed, now) == 'fresh' &&
          input?.quality == 'good'
      ? temperature
      : null;

  /// Independent relay diagnostics require their own exact claim/physical join,
  /// regardless of whether protective-floor evidence is available.
  bool get relayBindingCurrent {
    final rawClaim = diagnostic?['claim'];
    final configuredClaim = configuration['id'];
    return !historical &&
        !ambiguous &&
        rawClaim is String &&
        rawClaim.isNotEmpty &&
        rawClaim == claim &&
        (configuredClaim == null || configuredClaim == rawClaim) &&
        (configuration['physical_identity'] == null ||
            configuration['physical_identity'] ==
                diagnostic?['physical_identity']);
  }

  DateTime? get activitySampledAt =>
      DateTime.tryParse(diagnostic?['activity_sampled_at']?.toString() ?? '');
  DateTime? get activityExpiresAt =>
      DateTime.tryParse(diagnostic?['activity_expires_at']?.toString() ?? '');
  String? get activity => const ['on', 'off'].contains(diagnostic?['activity'])
      ? diagnostic!['activity'] as String
      : null;
  bool? qualification(bool current) => !current || !relayBindingCurrent
      ? null
      : diagnostic?['qualification_ready'] is bool
      ? diagnostic!['qualification_ready'] as bool
      : null;

  String? observed(bool current, DateTime now) {
    final sampled = activitySampledAt;
    final expiry = activityExpiresAt;
    if (!current ||
        !relayBindingCurrent ||
        sampled == null ||
        expiry == null ||
        sampled.isAfter(now) ||
        !expiry.isAfter(sampled) ||
        !now.isBefore(expiry)) {
      return null;
    }
    return activity;
  }

  /// Both record retention paths use the raw arrays, before any projection/deduplication.
  static bool membershipComplete(Map? config, Map? runtime) {
    bool complete(Object? value, String field) {
      if (value is! List) return false;
      final ids = <String>{};
      return value.every(
        (row) =>
            row is Map &&
            row[field] is String &&
            (row[field] as String).isNotEmpty &&
            ids.add(row[field] as String),
      );
    }

    return complete(config?['actuators'], 'id') &&
        complete(runtime?['branches'], 'claim');
  }

  // Ambiguous rows contribute only invalid high-water timestamps, never positive
  // values or budgets. Correcting the join cannot qualify the same publication.
  static Map _ambiguousDiagnostic(Object? id, List<Map> rows) {
    DateTime? latest(Iterable<Object?> values) {
      DateTime? result;
      for (final value in values) {
        final time = DateTime.tryParse(value?.toString() ?? '');
        if (time != null && (result == null || time.isAfter(result))) {
          result = time;
        }
      }
      return result;
    }

    return {
      'claim': id,
      'protection': {
        'sampled_at': latest(
          rows.map(
            (row) => row['protection'] is Map
                ? (row['protection'] as Map)['sampled_at']
                : null,
          ),
        )?.toIso8601String(),
      },
      'activity_sampled_at': latest(
        rows.map((row) => row['activity_sampled_at']),
      )?.toIso8601String(),
    };
  }

  static List<VirtualThermostatMember> read(
    Map? config,
    Map? runtime, {
    bool historical = false,
  }) {
    final claims = config?[historical ? 'released_actuators' : 'actuators'];
    final rows = runtime?['branches'] is List
        ? (runtime!['branches'] as List).whereType<Map>().toList()
        : <Map>[];
    final configured = claims is List
        ? claims.whereType<Map>().toList()
        : <Map>[];
    final result = <VirtualThermostatMember>[];
    final seen = <Object?>{};
    for (final claim in configured) {
      final id = claim['id'];
      if (!seen.add(id)) continue;
      final known = id is String && id.isNotEmpty;
      final matching = known
          ? rows.where((row) => row['claim'] == id).toList()
          : <Map>[];
      final unique = configured.where((row) => row['id'] == id).length == 1;
      result.add(
        VirtualThermostatMember(
          known ? claim : ({...claim}..remove('id')),
          !unique || matching.length > 1
              ? _ambiguousDiagnostic(id, matching)
              : matching.length == 1
              ? matching.single
              : null,
          historical: historical,
          ambiguous: !unique || matching.length > 1,
        ),
      );
    }
    if (!historical) {
      for (final row in rows.where((row) => row['claim_state'] != 'released')) {
        final id = row['claim'];
        if (!seen.add(id)) continue;
        final known = id is String && id.isNotEmpty;
        final matching = known
            ? rows.where((other) => other['claim'] == id).toList()
            : <Map>[];
        // Preserve opaque diagnostics without granting them a claim identity.
        result.add(
          VirtualThermostatMember(
            known && matching.length != 1 ? {'id': id} : const {},
            !known
                ? ({...row}..remove('claim'))
                : matching.length == 1
                ? matching.single
                : _ambiguousDiagnostic(id, matching),
            ambiguous: known && matching.length > 1,
          ),
        );
      }
    }
    return result;
  }
}

/// Original observation budgets are established only at coherent HTTP acceptance.
/// Receipt, render, configuration changes and equal-timestamp cache hits never
/// create a new publication. Retirement floors deliberately prefer withholding
/// a new identity to admitting a previously retired cached observation.
class VirtualThermostatEvidenceFence {
  final members = VirtualThermostatReadingFence();
  final sources = VirtualThermostatSourceFence();
  num? _revision;

  static bool revisionValid(Object? value) =>
      value is num && value.isFinite && value >= 0 && value % 1 == 0;

  static bool revisionsCoherent(Map configuration, Map runtime) =>
      revisionValid(configuration['revision']) &&
      revisionValid(runtime['configuration_revision']) &&
      configuration['revision'] == runtime['configuration_revision'];

  bool accept(Map configuration, Map runtime, DateTime now, Duration clock) {
    // Reject the whole envelope before changing revision/history/evidence.
    if (!revisionsCoherent(configuration, runtime)) return false;
    final revision = configuration['revision'] as num;
    if (_revision != null && revision < _revision!) return false;
    _revision = revision;
    // Revision admission precedes ALL aliases, contexts, retirements and samples.
    final rows = VirtualThermostatMember.read(configuration, runtime);
    final completeMembers = VirtualThermostatMember.membershipComplete(
      configuration,
      runtime,
    );
    if (members.cannotRetain(rows, authoritative: completeMembers)) {
      sources.legacyFallbackClosed = true;
    }
    sources.prepare(configuration, runtime, now, clock);
    if (completeMembers) {
      members.retainClaims(rows.map((row) => row.claim));
    }
    // Both namespaces have folded retirements before admitting replacements.
    members.accept(rows, now, clock, complete: completeMembers);
    if (!completeMembers) {
      members.untracked = true;
    }
    sources.admit(now, clock);
    return true;
  }
}

class _ObservationBudget {
  DateTime? time, expiry, qualifiedTime;
  Duration? deadline;
  String? context;
  bool withdrawn = true, requiresFloor = true;

  static Duration? remaining(VirtualThermostatInput? input, DateTime now) {
    if (input == null ||
        input.status != 'fresh' ||
        input.quality != 'good' ||
        input.sampledAt == null ||
        input.expiresAt == null ||
        input.sampledAt!.isAfter(now) ||
        !input.expiresAt!.isAfter(input.sampledAt!) ||
        input.ageSeconds == null ||
        input.maximumAgeSeconds == null ||
        input.maximumAgeSeconds! <= 0) {
      return null;
    }
    final ageMicros = (input.maximumAgeSeconds! - input.ageSeconds!) * 1000000;
    if (!ageMicros.isFinite) return null;
    final age = ageMicros.floor();
    final wall = input.expiresAt!.difference(now).inMicroseconds;
    final budget = age < wall ? age : wall;
    return budget > 0 ? Duration(microseconds: budget) : null;
  }

  void expire(DateTime now, Duration clock) {
    if (expiry == null ||
        deadline == null ||
        !now.isBefore(expiry!) ||
        clock >= deadline!) {
      withdrawn = true;
    }
  }

  void accept(
    VirtualThermostatInput? input,
    String nextContext,
    bool valid,
    DateTime now,
    Duration clock,
    DateTime? floor,
  ) {
    expire(now, clock);
    final stamp = input?.sampledAt;
    final left = valid ? remaining(input, now) : null;
    if (stamp == null || (time != null && stamp.isBefore(time!))) {
      withdrawn = true;
      return;
    }
    if (time == null || stamp.isAfter(time!)) {
      time = stamp;
      context = nextContext;
      withdrawn =
          left == null ||
          (requiresFloor && floor != null && !stamp.isAfter(floor));
      if (!withdrawn) {
        expiry = input!.expiresAt;
        deadline = clock + left!;
        qualifiedTime = stamp;
        requiresFloor = false;
      }
      return;
    }
    // Same publication: even corrected metadata cannot undo a prior withdrawal.
    if (!valid || left == null || context != nextContext) withdrawn = true;
    context = nextContext;
    if (left != null && deadline != null && expiry != null) {
      if (input!.expiresAt!.isBefore(expiry!)) expiry = input.expiresAt;
      final candidate = clock + left;
      if (candidate < deadline!) deadline = candidate;
    }
    expire(now, clock);
  }

  bool current(
    VirtualThermostatInput? input,
    String expectedContext,
    bool valid,
    DateTime now,
    Duration clock,
  ) {
    expire(now, clock);
    if (!valid ||
        input?.sampledAt != time ||
        context != expectedContext ||
        remaining(input, now) == null) {
      withdrawn = true;
    }
    return !withdrawn;
  }

  void merge(_ObservationBudget other) {
    if (other.time != null && (time == null || other.time!.isAfter(time!))) {
      time = other.time;
      expiry = other.expiry;
      deadline = other.deadline;
    } else if (time == other.time) {
      if (other.expiry != null &&
          (expiry == null || other.expiry!.isBefore(expiry!))) {
        expiry = other.expiry;
      }
      if (other.deadline != null &&
          (deadline == null || other.deadline! < deadline!)) {
        deadline = other.deadline;
      }
    }
    if (other.qualifiedTime != null &&
        (qualifiedTime == null ||
            other.qualifiedTime!.isAfter(qualifiedTime!))) {
      qualifiedTime = other.qualifiedTime;
    }
    withdrawn = true;
    requiresFloor = true;
  }
}

class VirtualThermostatReadingFence {
  final _samples = <String, _ObservationBudget>{};
  DateTime? _retired;
  bool overflow = false, untracked = false;
  int get recordCount => _samples.length;

  void _fold(DateTime? stamp) {
    if (stamp != null && (_retired == null || stamp.isAfter(_retired!))) {
      _retired = stamp;
    }
  }

  bool cannotRetain(
    List<VirtualThermostatMember> rows, {
    required bool authoritative,
  }) {
    final keys = authoritative ? <String>{} : _samples.keys.toSet();
    keys.addAll(rows.map((row) => row.claim).where((id) => id.isNotEmpty));
    return keys.length > 16;
  }

  void retainClaims(Iterable<String> claims) {
    final active = claims.toSet();
    for (final key in _samples.keys.toList()) {
      if (!active.contains(key)) _fold(_samples.remove(key)!.qualifiedTime);
    }
  }

  String _context(VirtualThermostatMember row) => jsonEncode([
    row.role,
    row.identity,
    row.configuration['source_identity'],
    row.configuration['qualification_generation'],
    row.configuration['revision'],
    [
      for (final field in [
        'revision',
        'source_identity',
        'source_property',
        'physical_property',
      ])
        row.binding?[field],
    ],
    row.diagnostic?['physical_identity'],
    row.protection?['claim'],
    row.protection?['source_identity'],
    row.protection?['source_property'],
    row.protection?['physical_property'],
  ]);

  bool _valid(VirtualThermostatMember row) {
    if (row.historical ||
        row.ambiguous ||
        row.claim.isEmpty ||
        row.temperature == null) {
      return false;
    }
    final p = row.protection, b = row.binding;
    if (row.configuration['physical_identity'] != null &&
        row.configuration['physical_identity'] !=
            row.diagnostic?['physical_identity']) {
      return false;
    }
    if (p == null || p['claim'] != row.claim) return false;
    for (final field in [
      'source_identity',
      'source_property',
      'physical_property',
    ]) {
      if (b != null &&
          b[field] != null &&
          (!p.containsKey(field) || b[field] != p[field])) {
        return false;
      }
    }
    if (b != null &&
        b.containsKey('source_property') &&
        b['source_property'] == null) {
      return false;
    }
    return true;
  }

  void accept(
    List<VirtualThermostatMember> rows,
    DateTime now,
    Duration clock, {
    bool complete = true,
  }) {
    if (!complete) {
      final present = rows.map((row) => row.claim).toSet();
      for (final key in _samples.keys) {
        if (!present.contains(key)) _samples[key]!.withdrawn = true;
      }
    }
    final identities = rows
        .map((row) => row.claim)
        .where((id) => id.isNotEmpty)
        .toList();
    overflow = identities.toSet().length > 16;
    untracked =
        identities.length != rows.length ||
        identities.toSet().length != identities.length;
    for (final row in rows) {
      var record = _samples[row.claim];
      if (record == null) {
        if (row.claim.isEmpty) continue;
        if (_samples.length >= 16) {
          overflow = true;
          if (_valid(row) &&
              _ObservationBudget.remaining(row.input, now) != null) {
            _fold(row.input!.sampledAt);
          }
          continue;
        }
        record = _samples[row.claim] = _ObservationBudget();
      }
      record.accept(
        row.input,
        _context(row),
        _valid(row),
        now,
        clock,
        _retired,
      );
    }
  }

  Set<String> expiredClaims(
    List<VirtualThermostatMember> rows,
    Duration elapsed,
    DateTime now, {
    Duration? clock,
  }) => {
    for (final row in rows)
      if (!(_samples[row.claim]?.current(
            row.input,
            _context(row),
            _valid(row),
            now,
            clock ?? elapsed,
          ) ??
          false))
        row.claim,
  };
}

class _SourceObservation {
  final Map source;
  final Map? raw;
  final VirtualThermostatInput? input;
  final String alias, key, context;
  bool valid;
  _ObservationBudget? record;
  _SourceObservation(
    this.source,
    this.raw,
    this.alias,
    this.key,
    this.context,
    this.valid,
  ) : input = raw == null ? null : VirtualThermostatInput.fromJson(raw);
}

class VirtualThermostatSourceFence {
  final _records = <String, _ObservationBudget>{};
  final _aliases = <String, _ObservationBudget>{};
  final _current = <String, _SourceObservation>{};
  final _pending = <_SourceObservation>[];
  DateTime? _retired;
  bool legacyFallbackClosed = false, overflow = false, _joinsComplete = false;
  int get recordCount => _records.length;
  int get aliasCount => _aliases.length;

  String _alias(String role, Object? id) => jsonEncode([role, id]);
  void _fold(DateTime? stamp) {
    if (stamp != null && (_retired == null || stamp.isAfter(_retired!))) {
      _retired = stamp;
    }
  }

  String? _keyOf(_ObservationBudget record) {
    for (final entry in _records.entries) {
      if (identical(entry.value, record)) return entry.key;
    }
    return null;
  }

  void prepare(Map config, Map runtime, DateTime now, Duration clock) {
    _current.clear();
    _pending.clear();
    overflow = false;
    final sources = config['sources'];
    final inputs = runtime['inputs'];
    final rows = sources is List ? sources.whereType<Map>().toList() : <Map>[];
    final diagnostics = inputs is List
        ? inputs.whereType<Map>().toList()
        : <Map>[];
    final seenAliases = <String>{}, seenKeys = <String>{};
    final rawSourcesComplete =
        sources is List && rows.length == sources.length && rows.length <= 18;
    final rawInputsComplete =
        inputs is List && diagnostics.length == inputs.length;
    var complete = rawSourcesComplete && rawInputsComplete;
    for (final source in rows) {
      final role = source['role']?.toString() ?? '';
      final id = source['id'];
      final alias = _alias(role, id);
      final identity = source['source_identity'];
      // Existing binding lookup MUST precede any canonical/fallback allocation.
      final known = _aliases[alias];
      final key = identity is String && identity.isNotEmpty
          ? jsonEncode([role, identity, false])
          : known != null
          ? _keyOf(known)!
          : jsonEncode([role, id, true]);
      final matches = diagnostics
          .where((raw) => raw['binding'] == id && raw['role'] == role)
          .toList();
      final raw = matches.length == 1 ? matches.single : null;
      var valid =
          id is String &&
          id.isNotEmpty &&
          ['ambient', 'floor', 'contact'].contains(role) &&
          raw != null;
      if (!seenAliases.add(alias) || !seenKeys.add(key)) {
        complete = false;
        valid = false;
        for (final old in _pending.where(
          (old) => old.alias == alias || old.key == key,
        )) {
          old.valid = false;
          old.record?.withdrawn = true;
        }
      }
      if (id is! String ||
          id.isEmpty ||
          !['ambient', 'floor', 'contact'].contains(role) ||
          (source.containsKey('source_identity') &&
              !(identity is String && identity.isNotEmpty))) {
        complete = false;
        valid = false;
      }
      if (source.containsKey('source_property') &&
          source['source_property'] == null) {
        valid = false;
      }
      if (source.containsKey('source_property') &&
          raw != null &&
          (!raw.containsKey('source_property') ||
              source['source_property'] != raw['source_property'])) {
        valid = false;
      }
      if (!(identity is String && identity.isNotEmpty) &&
          known != null &&
          jsonDecode(key)[2] == false) {
        known.withdrawn = true;
        valid = false;
      }
      if (!(identity is String && identity.isNotEmpty) &&
          known == null &&
          legacyFallbackClosed) {
        valid = false;
      }
      final context = jsonEncode([
        role,
        id,
        identity,
        source['source_property'],
        raw?.containsKey('source_property') ?? false,
        raw?['source_property'],
        source['physical_identity'],
        source['contract_fingerprint'],
        source['open_value'],
        source['closed_value'],
      ]);
      final observation = _SourceObservation(
        source,
        raw,
        alias,
        key,
        context,
        valid,
      );
      var record = known ?? _records[key];
      if (known != null && _keyOf(known) != key) {
        final collision = _records[key];
        // Dropping X during X→Y also retires X before replacement admission.
        _fold(known.qualifiedTime);
        legacyFallbackClosed = true;
        _records.removeWhere((_, value) => identical(value, known));
        if (collision != null && !identical(collision, known)) {
          _fold(collision.qualifiedTime);
          known.merge(collision);
          _records.removeWhere((_, value) => identical(value, collision));
          _aliases.updateAll(
            (_, value) => identical(value, collision) ? known : value,
          );
          observation.valid = false;
        }
        known.withdrawn = true;
        known.requiresFloor = true;
        _records[key] = known;
        record = known;
      }
      observation.record = record;
      _pending.add(observation);
    }
    // Filtered projections cannot certify the whole batch or authorize pruning.
    // Independently unambiguous bindings keep their original observation budgets.
    final diagnosticAliases = <String>{};
    _joinsComplete =
        complete &&
        diagnostics.every(
          (raw) =>
              diagnosticAliases.add(
                _alias(raw['role']?.toString() ?? '', raw['binding']),
              ) &&
              _pending
                      .where(
                        (row) =>
                            row.source['id'] == raw['binding'] &&
                            row.source['role'] == raw['role'],
                      )
                      .length ==
                  1,
        ) &&
        _pending.every(
          (row) =>
              diagnostics
                  .where(
                    (raw) =>
                        raw['binding'] == row.source['id'] &&
                        raw['role'] == row.source['role'],
                  )
                  .length ==
              1,
        );
    final activeRecords = _pending
        .map((row) => row.record)
        .whereType<_ObservationBudget>()
        .toSet();
    if (_joinsComplete) {
      for (final alias in _aliases.keys.toList()) {
        if (!seenAliases.contains(alias)) {
          _fold(_aliases.remove(alias)!.qualifiedTime);
          legacyFallbackClosed = true;
        }
      }
      for (final key in _records.keys.toList()) {
        if (!activeRecords.contains(_records[key])) {
          _fold(_records.remove(key)!.qualifiedTime);
          legacyFallbackClosed = true;
        }
      }
    }
    // Resolve capacity only AFTER complete retirements have raised the floor.
    for (final row in _pending) {
      var record = row.record;
      if ((record == null && _records.length >= 36) ||
          (!_aliases.containsKey(row.alias) && _aliases.length >= 36)) {
        overflow = true;
        legacyFallbackClosed = true;
        if (row.valid && _ObservationBudget.remaining(row.input, now) != null) {
          _fold(row.input!.sampledAt);
        }
        row.record = null;
        continue;
      }
      final identity = row.source['source_identity'];
      if (!_aliases.containsKey(row.alias) &&
          !(identity is String && identity.isNotEmpty) &&
          legacyFallbackClosed) {
        row.valid = false;
      }
      if (record == null && !row.valid) continue;
      record ??= _records.putIfAbsent(row.key, () => _ObservationBudget());
      _aliases[row.alias] = record;
      row.record = record;
      _current[row.alias] = row;
    }
    if (!_joinsComplete) {
      // Accepted incomplete catalogs withdraw omitted records, not historical
      // aliases sharing a record with a valid, retained current binding.
      final represented = _pending
          .where((row) => row.valid)
          .map((row) => row.record)
          .whereType<_ObservationBudget>()
          .toSet();
      for (final record in _aliases.values) {
        if (!represented.contains(record)) record.withdrawn = true;
      }
    }
  }

  void admit(DateTime now, Duration clock) {
    for (final row in _pending) {
      row.record?.accept(
        row.input,
        row.context,
        row.valid,
        now,
        clock,
        _retired,
      );
    }
  }

  bool _qualified(_SourceObservation row, DateTime now, Duration clock) =>
      row.record?.current(row.input, row.context, row.valid, now, clock) ??
      false;

  bool roleCurrent(String role, DateTime now, Duration clock) {
    final rows = _current.values
        .where((row) => row.source['role'] == role)
        .toList();
    return rows.length == 1 && _qualified(rows.single, now, clock);
  }

  bool allCurrent(DateTime now, Duration clock) =>
      !overflow &&
      _joinsComplete &&
      roleCurrent('ambient', now, clock) &&
      _current.length == _pending.length &&
      _current.values.every((row) => _qualified(row, now, clock));

  String status(VirtualThermostatInput input, DateTime now, Duration clock) {
    final row = _current[_alias(input.role, input.binding)];
    if (row == null || !_qualified(row, now, clock)) {
      return input.status == 'fresh' ? 'unavailable' : input.status;
    }
    return input.status;
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

  int get recordCount => _samples.length;

  String _context(VirtualThermostatMember member) => jsonEncode([
    member.claim,
    member.identity,
    member.configuration['qualification_generation'],
    member.diagnostic?['claim'],
    member.diagnostic?['physical_identity'],
  ]);

  /// Admission happens for EVERY coherent HTTP batch, before any render.
  /// Membership completeness controls pruning separately, not evidence validity.
  void accept(
    List<VirtualThermostatMember> members,
    DateTime now,
    Duration clock,
  ) {
    final present = members.map((member) => member.claim).toSet();
    for (final key in _samples.keys) {
      if (!present.contains(key)) _samples[key]!.invalid = true;
    }
    for (final member in members) {
      if (member.claim.isEmpty) continue;
      final previous = _samples[member.claim];
      final sampled = member.activitySampledAt;
      final expiry = member.activityExpiresAt;
      final activity = member.observed(true, now);
      final context = _context(member);
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
  }

  /// Render/query can only withhold or expire admitted records. It cannot mint
  /// a first observation, accept a newer publication or renew an original budget.
  Set<String> unavailableClaims(
    List<VirtualThermostatMember> members,
    DateTime now,
    Duration clock,
  ) {
    final unavailable = <String>{};
    for (final member in members) {
      final previous = _samples[member.claim];
      if (previous == null) {
        unavailable.add(member.claim);
        continue;
      }
      if (member.activitySampledAt != previous.sampled ||
          member.observed(true, now) != previous.activity ||
          _context(member) != previous.context ||
          !now.isBefore(previous.expiry) ||
          clock >= previous.deadline) {
        previous.invalid = true;
      }
      if (previous.invalid) unavailable.add(member.claim);
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

/// Cooling display history belongs only to this mounted detail's fence instance.
/// HTTP admission captures original expiry budgets; rendering cannot mint them.
class VirtualThermostatCoolingFence {
  final _samples = <String, _CoolingWatermark>{};
  int get recordCount => _samples.length;

  bool _requiresCooling(Map row) =>
      row['role'] == 'cooling' || row['cooling_protection'] != null;

  DateTime? _expiry(Map? diagnostic) {
    final cooling = diagnostic?['cooling_protection'];
    final value = cooling is Map ? cooling['expires_at'] : null;
    return value is String ? DateTime.tryParse(value) : null;
  }

  bool _valid(Map configuration, Map? diagnostic) {
    final claim = configuration['id'];
    final physical = configuration['physical_identity'];
    final binding = configuration['cooling_protection'];
    final cooling = diagnostic?['cooling_protection'];
    bool identity(Object? value) => value is String && value.isNotEmpty;
    bool reading(Object? value) =>
        value is num && value.isFinite && value > -45 && value <= 60;
    return identity(claim) &&
        configuration['role'] == 'cooling' &&
        diagnostic?['role'] == 'cooling' &&
        diagnostic?['claim_state'] != 'released' &&
        diagnostic?['claim'] == claim &&
        identity(physical) &&
        diagnostic?['physical_identity'] == physical &&
        binding is Map &&
        cooling is Map &&
        cooling['claim'] == claim &&
        binding['schema_version'] == 1 &&
        binding['purpose'] == 'cooled_surface' &&
        identity(binding['dew_point_property']) &&
        identity(binding['surface_property']) &&
        identity(cooling['dew_point_identity']) &&
        identity(cooling['surface_identity']) &&
        binding['dew_point_identity'] == cooling['dew_point_identity'] &&
        binding['surface_identity'] == cooling['surface_identity'] &&
        reading(cooling['dew_point']) &&
        reading(cooling['surface']) &&
        cooling['ready'] is bool &&
        cooling['latched'] is bool &&
        _expiry(diagnostic) != null;
  }

  String _context(Map configuration, Map diagnostic) {
    final binding = configuration['cooling_protection'] as Map;
    final cooling = diagnostic['cooling_protection'] as Map;
    return jsonEncode([
      configuration['id'],
      configuration['physical_identity'],
      diagnostic['claim'],
      diagnostic['physical_identity'],
      configuration['revision'],
      configuration['qualification_generation'],
      binding['revision'],
      cooling['dew_point_identity'],
      cooling['surface_identity'],
    ]);
  }

  /// Called only after the caller's coherent/current HTTP revision admission.
  /// Raw rows preserve invalid duplicate expiries discarded by member projection.
  void accept(Map configuration, Map runtime, DateTime now, Duration clock) {
    Map<String, List<Map>> group(Object? raw, String field) {
      final grouped = <String, List<Map>>{};
      if (raw is List) {
        for (final row in raw.whereType<Map>()) {
          final id = row[field];
          if (id is String && id.isNotEmpty) {
            (grouped[id] ??= []).add(row);
          }
        }
      }
      return grouped;
    }

    final configured = group(configuration['actuators'], 'id');
    final diagnostics = group(runtime['branches'], 'claim');
    final candidates = {
      for (final entry in configured.entries)
        if (entry.value.any(_requiresCooling)) entry.key,
      for (final entry in diagnostics.entries)
        if (entry.value.any(_requiresCooling) &&
            (_samples.containsKey(entry.key) ||
                entry.value.any((row) =>
                    row['claim_state'] != 'released' && _requiresCooling(row))))
          entry.key,
    };
    final complete = VirtualThermostatMember.membershipComplete(
      configuration,
      runtime,
    );
    // Tombstones retain per-claim high-water within the existing bounded instance.
    // Complete membership proves retirement; incomplete omission is only a gap.
    for (final entry in _samples.entries) {
      if (!candidates.contains(entry.key)) {
        entry.value.invalid = true;
        if (complete &&
            !configured.containsKey(entry.key) &&
            !diagnostics.containsKey(entry.key)) {
          entry.value.retired = true;
        }
      }
    }
    for (final claim in candidates) {
      var record = _samples[claim];
      if (record == null) {
        if (_samples.length >= 128) continue;
        record = _samples[claim] = _CoolingWatermark();
      }
      final configs = configured[claim] ?? const <Map>[];
      final rows = diagnostics[claim] ?? const <Map>[];
      final previous = record.observedExpiry;
      DateTime? observed;
      for (final row in rows) {
        final expiry = _expiry(row);
        if (expiry != null && (observed == null || expiry.isAfter(observed))) {
          observed = expiry;
        }
      }
      if (observed != null &&
          (previous == null || observed.isAfter(previous))) {
        record.observedExpiry = observed;
      }
      if (record.awaitingBaseline && observed != null) {
        record.awaitingBaseline = false;
        record.invalid = true;
        continue;
      }
      final valid = configs.length == 1 &&
          rows.length == 1 &&
          _valid(configs.single, rows.single);
      if (!valid) {
        record.invalid = true;
        if (record.observedExpiry == null) record.awaitingBaseline = true;
        continue;
      }
      final expiry = _expiry(rows.single)!;
      final context = _context(configs.single, rows.single);
      final remaining = expiry.difference(now);
      final deadline = clock + (remaining.isNegative ? Duration.zero : remaining);
      if (previous == null || expiry.isAfter(previous)) {
        record.expiry = expiry;
        record.deadline = deadline;
        record.context = context;
        record.invalid = !now.isBefore(expiry);
        record.retired = false;
      } else if (expiry == record.expiry &&
          expiry == record.observedExpiry &&
          context == record.context &&
          !record.invalid &&
          !record.retired) {
        if (deadline < record.deadline!) record.deadline = deadline;
        if (!now.isBefore(expiry) || clock >= record.deadline!) {
          record.invalid = true;
        }
      } else {
        record.invalid = true;
      }
    }
  }

  Set<String> freshClaims(
    List<VirtualThermostatMember> members,
    DateTime now,
    Duration clock,
  ) {
    final fresh = <String>{};
    for (final member in members) {
      final record = _samples[member.claim];
      if (record == null) continue;
      final diagnostic = member.diagnostic;
      final valid = !member.historical &&
          !member.ambiguous &&
          _valid(member.configuration, diagnostic);
      if (!valid ||
          record.invalid ||
          record.retired ||
          _expiry(diagnostic) != record.expiry ||
          record.expiry != record.observedExpiry ||
          _context(member.configuration, diagnostic!) != record.context ||
          record.deadline == null ||
          !now.isBefore(record.expiry!) ||
          clock >= record.deadline!) {
        record.invalid = true;
        continue;
      }
      fresh.add(member.claim);
    }
    return fresh;
  }
}

class _CoolingWatermark {
  DateTime? observedExpiry, expiry;
  Duration? deadline;
  String? context;
  bool invalid = true, awaitingBaseline = false, retired = false;
}
