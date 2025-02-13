// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

@JsonEnum()
enum Section {
  @JsonValue('audio')
  audio('audio'),
  @JsonValue('display')
  display('display'),
  @JsonValue('language')
  language('language'),
  @JsonValue('weather')
  weather('weather'),
  /// Default value for all unparsed values, allows backward compatibility when adding new values on the backend.
  $unknown(null);

  const Section(this.json);

  factory Section.fromJson(String json) => values.firstWhere(
        (e) => e.json == json,
        orElse: () => $unknown,
      );

  final String? json;
}
