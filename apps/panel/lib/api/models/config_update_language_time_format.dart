// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

/// Sets the time format (12-hour or 24-hour).
@JsonEnum()
enum ConfigUpdateLanguageTimeFormat {
  @JsonValue('12h')
  value12h('12h'),
  @JsonValue('24h')
  value24h('24h'),
  /// Default value for all unparsed values, allows backward compatibility when adding new values on the backend.
  $unknown(null);

  const ConfigUpdateLanguageTimeFormat(this.json);

  factory ConfigUpdateLanguageTimeFormat.fromJson(String json) => values.firstWhere(
        (e) => e.json == json,
        orElse: () => $unknown,
      );

  final String? json;
}
