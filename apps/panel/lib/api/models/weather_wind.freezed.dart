// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'weather_wind.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

WeatherWind _$WeatherWindFromJson(Map<String, dynamic> json) {
  return _WeatherWind.fromJson(json);
}

/// @nodoc
mixin _$WeatherWind {
  /// Wind speed in meters per second.
  num get speed => throw _privateConstructorUsedError;

  /// Wind direction in degrees (0° - 360°).
  num get deg => throw _privateConstructorUsedError;

  /// Wind gust speed in meters per second.
  num? get gust => throw _privateConstructorUsedError;

  /// Serializes this WeatherWind to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of WeatherWind
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $WeatherWindCopyWith<WeatherWind> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $WeatherWindCopyWith<$Res> {
  factory $WeatherWindCopyWith(
          WeatherWind value, $Res Function(WeatherWind) then) =
      _$WeatherWindCopyWithImpl<$Res, WeatherWind>;
  @useResult
  $Res call({num speed, num deg, num? gust});
}

/// @nodoc
class _$WeatherWindCopyWithImpl<$Res, $Val extends WeatherWind>
    implements $WeatherWindCopyWith<$Res> {
  _$WeatherWindCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of WeatherWind
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
abstract class _$$WeatherWindImplCopyWith<$Res>
    implements $WeatherWindCopyWith<$Res> {
  factory _$$WeatherWindImplCopyWith(
          _$WeatherWindImpl value, $Res Function(_$WeatherWindImpl) then) =
      __$$WeatherWindImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({num speed, num deg, num? gust});
}

/// @nodoc
class __$$WeatherWindImplCopyWithImpl<$Res>
    extends _$WeatherWindCopyWithImpl<$Res, _$WeatherWindImpl>
    implements _$$WeatherWindImplCopyWith<$Res> {
  __$$WeatherWindImplCopyWithImpl(
      _$WeatherWindImpl _value, $Res Function(_$WeatherWindImpl) _then)
      : super(_value, _then);

  /// Create a copy of WeatherWind
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? speed = null,
    Object? deg = null,
    Object? gust = freezed,
  }) {
    return _then(_$WeatherWindImpl(
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
class _$WeatherWindImpl implements _WeatherWind {
  const _$WeatherWindImpl(
      {required this.speed, required this.deg, required this.gust});

  factory _$WeatherWindImpl.fromJson(Map<String, dynamic> json) =>
      _$$WeatherWindImplFromJson(json);

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
    return 'WeatherWind(speed: $speed, deg: $deg, gust: $gust)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$WeatherWindImpl &&
            (identical(other.speed, speed) || other.speed == speed) &&
            (identical(other.deg, deg) || other.deg == deg) &&
            (identical(other.gust, gust) || other.gust == gust));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, speed, deg, gust);

  /// Create a copy of WeatherWind
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$WeatherWindImplCopyWith<_$WeatherWindImpl> get copyWith =>
      __$$WeatherWindImplCopyWithImpl<_$WeatherWindImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$WeatherWindImplToJson(
      this,
    );
  }
}

abstract class _WeatherWind implements WeatherWind {
  const factory _WeatherWind(
      {required final num speed,
      required final num deg,
      required final num? gust}) = _$WeatherWindImpl;

  factory _WeatherWind.fromJson(Map<String, dynamic> json) =
      _$WeatherWindImpl.fromJson;

  /// Wind speed in meters per second.
  @override
  num get speed;

  /// Wind direction in degrees (0° - 360°).
  @override
  num get deg;

  /// Wind gust speed in meters per second.
  @override
  num? get gust;

  /// Create a copy of WeatherWind
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$WeatherWindImplCopyWith<_$WeatherWindImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
