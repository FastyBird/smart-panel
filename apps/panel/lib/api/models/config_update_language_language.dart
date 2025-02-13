// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

/// Defines the language and region format.
@JsonEnum()
enum ConfigUpdateLanguageLanguage {
  @JsonValue('en_US')
  enUS('en_US'),
  @JsonValue('cs_CZ')
  csCZ('cs_CZ'),
  /// Default value for all unparsed values, allows backward compatibility when adding new values on the backend.
  $unknown(null);

  const ConfigUpdateLanguageLanguage(this.json);

  factory ConfigUpdateLanguageLanguage.fromJson(String json) => values.firstWhere(
        (e) => e.json == json,
        orElse: () => $unknown,
      );

  final String? json;
}
