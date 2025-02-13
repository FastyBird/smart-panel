// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

/// The HTTP method used for the request (`GET`, `POST`, `PATCH`, `DELETE`).
@JsonEnum()
enum DevicesResChannelsMethod {
  /// The name has been replaced because it contains a keyword. Original name: `GET`.
  @JsonValue('GET')
  valueGet('GET'),
  @JsonValue('POST')
  post('POST'),
  @JsonValue('PATCH')
  patch('PATCH'),
  @JsonValue('DELETE')
  delete('DELETE'),
  /// Default value for all unparsed values, allows backward compatibility when adding new values on the backend.
  $unknown(null);

  const DevicesResChannelsMethod(this.json);

  factory DevicesResChannelsMethod.fromJson(String json) => values.firstWhere(
        (e) => e.json == json,
        orElse: () => $unknown,
      );

  final String? json;
}
