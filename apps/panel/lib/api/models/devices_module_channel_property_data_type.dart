// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

/// Data type of the property’s value, e.g., string, integer, or boolean.
@JsonEnum()
enum DevicesModuleChannelPropertyDataType {
  @JsonValue('char')
  char('char'),
  @JsonValue('uchar')
  uchar('uchar'),
  @JsonValue('short')
  short('short'),
  @JsonValue('ushort')
  ushort('ushort'),
  @JsonValue('int')
  int('int'),
  @JsonValue('uint')
  uint('uint'),
  @JsonValue('float')
  float('float'),
  @JsonValue('bool')
  bool('bool'),
  @JsonValue('string')
  string('string'),
  /// The name has been replaced because it contains a keyword. Original name: `enum`.
  @JsonValue('enum')
  valueEnum('enum'),
  @JsonValue('unknown')
  unknown('unknown'),
  /// Default value for all unparsed values, allows backward compatibility when adding new values on the backend.
  $unknown(null);

  const DevicesModuleChannelPropertyDataType(this.json);

  factory DevicesModuleChannelPropertyDataType.fromJson(String json) => values.firstWhere(
        (e) => e.json == json,
        orElse: () => $unknown,
      );

  final String? json;
}
