// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'feels_like.freezed.dart';
part 'feels_like.g.dart';

@Freezed()
class FeelsLike with _$FeelsLike {
  const factory FeelsLike({
    /// Morning temperature.
    num? morn,

    /// Day temperature.
    num? day,

    /// Evening temperature.
    num? eve,

    /// Night temperature.
    num? night,
  }) = _FeelsLike;
  
  factory FeelsLike.fromJson(Map<String, Object?> json) => _$FeelsLikeFromJson(json);
}
