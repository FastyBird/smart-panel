// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

@JsonEnum()
enum DevicesCreateChannelPropertyPermissions {
  @JsonValue('ro')
  ro('ro'),
  @JsonValue('rw')
  rw('rw'),
  @JsonValue('wo')
  wo('wo'),
  @JsonValue('ev')
  ev('ev'),
  /// Default value for all unparsed values, allows backward compatibility when adding new values on the backend.
  $unknown(null);

  const DevicesCreateChannelPropertyPermissions(this.json);

  factory DevicesCreateChannelPropertyPermissions.fromJson(String json) => values.firstWhere(
        (e) => e.json == json,
        orElse: () => $unknown,
      );

  final String? json;
}
