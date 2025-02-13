// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

/// Defines the time zone of the smart panel. Uses the IANA time zone format.
@JsonEnum()
enum ConfigLanguageTimeFormat {
  @JsonValue('12h')
  value12h('12h'),
  @JsonValue('24h')
  value24h('24h'),
  /// Default value for all unparsed values, allows backward compatibility when adding new values on the backend.
  $unknown(null);

  const ConfigLanguageTimeFormat(this.json);

  factory ConfigLanguageTimeFormat.fromJson(String json) => values.firstWhere(
        (e) => e.json == json,
        orElse: () => $unknown,
      );

  final String? json;
}
