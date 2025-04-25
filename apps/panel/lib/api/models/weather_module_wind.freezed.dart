// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'weather_module_wind.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

WeatherModuleWind _$WeatherModuleWindFromJson(Map<String, dynamic> json) {
  return _WeatherModuleWind.fromJson(json);
}

/// @nodoc
mixin _$WeatherModuleWind {
  /// Wind speed in meters per second.
  num get speed => throw _privateConstructorUsedError;

  /// Wind direction in degrees (0° - 360°).
  num get deg => throw _privateConstructorUsedError;

  /// Wind gust speed in meters per second.
  num? get gust => throw _privateConstructorUsedError;

  /// Serializes this WeatherModuleWind to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of WeatherModuleWind
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $WeatherModuleWindCopyWith<WeatherModuleWind> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $WeatherModuleWindCopyWith<$Res> {
  factory $WeatherModuleWindCopyWith(
          WeatherModuleWind value, $Res Function(WeatherModuleWind) then) =
      _$WeatherModuleWindCopyWithImpl<$Res, WeatherModuleWind>;
  @useResult
  $Res call({num speed, num deg, num? gust});
}

/// @nodoc
class _$WeatherModuleWindCopyWithImpl<$Res, $Val extends WeatherModuleWind>
    implements $WeatherModuleWindCopyWith<$Res> {
  _$WeatherModuleWindCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of WeatherModuleWind
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? speed = null,
    Object? deg = null,
    Object? gust = freezed,
  }) {
    return _then(_value.copyWith(
      speed: null == speed
          ? _value.speed
          : speed // ignore: cast_nullable_to_non_nullable
              as num,
      deg: null == deg
          ? _value.deg
          : deg // ignore: cast_nullable_to_non_nullable
              as num,
      gust: freezed == gust
          ? _value.gust
          : gust // ignore: cast_nullable_to_non_nullable
              as num?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$WeatherModuleWindImplCopyWith<$Res>
    implements $WeatherModuleWindCopyWith<$Res> {
  factory _$$WeatherModuleWindImplCopyWith(_$WeatherModuleWindImpl value,
          $Res Function(_$WeatherModuleWindImpl) then) =
      __$$WeatherModuleWindImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({num speed, num deg, num? gust});
}

/// @nodoc
class __$$WeatherModuleWindImplCopyWithImpl<$Res>
    extends _$WeatherModuleWindCopyWithImpl<$Res, _$WeatherModuleWindImpl>
    implements _$$WeatherModuleWindImplCopyWith<$Res> {
  __$$WeatherModuleWindImplCopyWithImpl(_$WeatherModuleWindImpl _value,
      $Res Function(_$WeatherModuleWindImpl) _then)
      : super(_value, _then);

  /// Create a copy of WeatherModuleWind
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? speed = null,
    Object? deg = null,
    Object? gust = freezed,
  }) {
    return _then(_$WeatherModuleWindImpl(
      speed: null == speed
          ? _value.speed
          : speed // ignore: cast_nullable_to_non_nullable
              as num,
      deg: null == deg
          ? _value.deg
          : deg // ignore: cast_nullable_to_non_nullable
              as num,
      gust: freezed == gust
          ? _value.gust
          : gust // ignore: cast_nullable_to_non_nullable
              as num?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$WeatherModuleWindImpl implements _WeatherModuleWind {
  const _$WeatherModuleWindImpl(
      {required this.speed, required this.deg, required this.gust});

  factory _$WeatherModuleWindImpl.fromJson(Map<String, dynamic> json) =>
      _$$WeatherModuleWindImplFromJson(json);

  /// Wind speed in meters per second.
  @override
  final num speed;

  /// Wind direction in degrees (0° - 360°).
  @override
  final num deg;

  /// Wind gust speed in meters per second.
  @override
  final num? gust;

  @override
  String toString() {
    return 'WeatherModuleWind(speed: $speed, deg: $deg, gust: $gust)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$WeatherModuleWindImpl &&
            (identical(other.speed, speed) || other.speed == speed) &&
            (identical(other.deg, deg) || other.deg == deg) &&
            (identical(other.gust, gust) || other.gust == gust));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, speed, deg, gust);

  /// Create a copy of WeatherModuleWind
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$WeatherModuleWindImplCopyWith<_$WeatherModuleWindImpl> get copyWith =>
      __$$WeatherModuleWindImplCopyWithImpl<_$WeatherModuleWindImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$WeatherModuleWindImplToJson(
      this,
    );
  }
}

abstract class _WeatherModuleWind implements WeatherModuleWind {
  const factory _WeatherModuleWind(
      {required final num speed,
      required final num deg,
      required final num? gust}) = _$WeatherModuleWindImpl;

  factory _WeatherModuleWind.fromJson(Map<String, dynamic> json) =
      _$WeatherModuleWindImpl.fromJson;

  /// Wind speed in meters per second.
  @override
  num get speed;

  /// Wind direction in degrees (0° - 360°).
  @override
  num get deg;

  /// Wind gust speed in meters per second.
  @override
  num? get gust;

  /// Create a copy of WeatherModuleWind
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$WeatherModuleWindImplCopyWith<_$WeatherModuleWindImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
