import 'dart:convert';

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

/// Original observation budgets are established only at coherent HTTP acceptance.
/// Receipt, render, configuration changes and equal-timestamp cache hits never
/// create a new publication. Retirement floors deliberately prefer withholding
/// a new identity to admitting a previously retired cached observation.
class VirtualThermostatEvidenceFence {
  final members = VirtualThermostatReadingFence();
  final sources = VirtualThermostatSourceFence();
  num? _revision;

  bool accept(Map configuration, Map runtime, DateTime now, Duration clock) {
    final revision = configuration['revision'];
    final known = revision is num && revision.isFinite && revision >= 0;
    if (_revision != null && (!known || revision < _revision!)) return false;
    final runtimeRevision = runtime['configuration_revision'];
    if (runtimeRevision is num &&
        runtimeRevision > 0 &&
        runtimeRevision != revision) {
      return false;
    }
    if (known) _revision = revision;
    // Revision admission precedes ALL aliases, contexts, retirements and samples.
    final rows = VirtualThermostatMember.read(configuration, runtime);
    final configured = configuration['actuators'];
    final branches = runtime['branches'];
    bool identity(Object? value) => value is String && value.isNotEmpty;
    final completeMembers =
        configured is List &&
        branches is List &&
        configured.every((row) => row is Map && identity(row['id'])) &&
        branches.every(
          (row) =>
              row is Map &&
              (row['claim_state'] == 'released' || identity(row['claim'])),
        );
    if (members.cannotRetain(rows, authoritative: completeMembers)) {
      sources.legacyFallbackClosed = true;
    }
    sources.prepare(configuration, runtime, now, clock);
    if (completeMembers) {
      members.retainClaims(rows.map((row) => row.claim));
    }
    // Both namespaces have folded retirements before admitting replacements.
    members.accept(rows, now, clock);
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
    row.protection?['source_identity'],
    row.protection?['source_property'],
    row.protection?['physical_property'],
  ]);

  bool _valid(VirtualThermostatMember row) {
    if (row.historical || row.claim.isEmpty || row.temperature == null) {
      return false;
    }
    final p = row.protection, b = row.binding;
    if (row.configuration['physical_identity'] != null &&
        row.diagnostic?['physical_identity'] != null &&
        row.configuration['physical_identity'] !=
            row.diagnostic!['physical_identity']) {
      return false;
    }
    if (p?['claim'] != null && p!['claim'] != row.claim) return false;
    for (final field in [
      'source_identity',
      'source_property',
      'physical_property',
    ]) {
      if (b != null &&
          p != null &&
          b.containsKey(field) &&
          p.containsKey(field) &&
          b[field] != p[field]) {
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
    Duration clock,
  ) {
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
    var complete =
        sources is List && rows.length == sources.length && rows.length <= 18;
    _joinsComplete = true;
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
    // Reject orphan diagnostics and ambiguous joins for positive readiness.
    _joinsComplete = diagnostics.every(
      (raw) =>
          _pending
              .where(
                (row) =>
                    row.source['id'] == raw['binding'] &&
                    row.source['role'] == raw['role'],
              )
              .length ==
          1,
    );
    final activeRecords = _pending
        .map((row) => row.record)
        .whereType<_ObservationBudget>()
        .toSet();
    if (complete) {
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
    if (rows.length > 18 ||
        rows.length != (sources is List ? sources.length : 0)) {
      _joinsComplete = false;
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
