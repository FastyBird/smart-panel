// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'temperature.freezed.dart';
part 'temperature.g.dart';

@Freezed()
class Temperature with _$Temperature {
  const factory Temperature({
    /// Morning temperature.
    num? morn,

    /// Day temperature.
    num? day,

    /// Evening temperature.
    num? eve,

    /// Night temperature.
    num? night,

    /// Min daily temperature.
    num? min,

    /// Max daily temperature.
    num? max,
  }) = _Temperature;
  
  factory Temperature.fromJson(Map<String, Object?> json) => _$TemperatureFromJson(json);
}
