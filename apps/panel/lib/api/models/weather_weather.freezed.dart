// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'weather_weather.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

WeatherWeather _$WeatherWeatherFromJson(Map<String, dynamic> json) {
  return _WeatherWeather.fromJson(json);
}

/// @nodoc
mixin _$WeatherWeather {
  /// Weather condition code.
  num get code => throw _privateConstructorUsedError;

  /// Weather condition (e.g., Rain, Snow, Clear).
  String get main => throw _privateConstructorUsedError;

  /// Detailed description of the weather condition.
  String get description => throw _privateConstructorUsedError;

  /// Icon code representing the current weather condition.
  String get icon => throw _privateConstructorUsedError;

  /// Serializes this WeatherWeather to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of WeatherWeather
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $WeatherWeatherCopyWith<WeatherWeather> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $WeatherWeatherCopyWith<$Res> {
  factory $WeatherWeatherCopyWith(
          WeatherWeather value, $Res Function(WeatherWeather) then) =
      _$WeatherWeatherCopyWithImpl<$Res, WeatherWeather>;
  @useResult
  $Res call({num code, String main, String description, String icon});
}

/// @nodoc
class _$WeatherWeatherCopyWithImpl<$Res, $Val extends WeatherWeather>
    implements $WeatherWeatherCopyWith<$Res> {
  _$WeatherWeatherCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of WeatherWeather
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? code = null,
    Object? main = null,
    Object? description = null,
    Object? icon = null,
  }) {
    return _then(_value.copyWith(
      code: null == code
          ? _value.code
          : code // ignore: cast_nullable_to_non_nullable
              as num,
      main: null == main
          ? _value.main
          : main // ignore: cast_nullable_to_non_nullable
              as String,
      description: null == description
          ? _value.description
          : description // ignore: cast_nullable_to_non_nullable
              as String,
      icon: null == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$WeatherWeatherImplCopyWith<$Res>
    implements $WeatherWeatherCopyWith<$Res> {
  factory _$$WeatherWeatherImplCopyWith(_$WeatherWeatherImpl value,
          $Res Function(_$WeatherWeatherImpl) then) =
      __$$WeatherWeatherImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({num code, String main, String description, String icon});
}

/// @nodoc
class __$$WeatherWeatherImplCopyWithImpl<$Res>
    extends _$WeatherWeatherCopyWithImpl<$Res, _$WeatherWeatherImpl>
    implements _$$WeatherWeatherImplCopyWith<$Res> {
  __$$WeatherWeatherImplCopyWithImpl(
      _$WeatherWeatherImpl _value, $Res Function(_$WeatherWeatherImpl) _then)
      : super(_value, _then);

  /// Create a copy of WeatherWeather
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? code = null,
    Object? main = null,
    Object? description = null,
    Object? icon = null,
  }) {
    return _then(_$WeatherWeatherImpl(
      code: null == code
          ? _value.code
          : code // ignore: cast_nullable_to_non_nullable
              as num,
      main: null == main
          ? _value.main
          : main // ignore: cast_nullable_to_non_nullable
              as String,
      description: null == description
          ? _value.description
          : description // ignore: cast_nullable_to_non_nullable
              as String,
      icon: null == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$WeatherWeatherImpl implements _WeatherWeather {
  const _$WeatherWeatherImpl(
      {required this.code,
      required this.main,
      required this.description,
      required this.icon});

  factory _$WeatherWeatherImpl.fromJson(Map<String, dynamic> json) =>
      _$$WeatherWeatherImplFromJson(json);

  /// Weather condition code.
  @override
  final num code;

  /// Weather condition (e.g., Rain, Snow, Clear).
  @override
  final String main;

  /// Detailed description of the weather condition.
  @override
  final String description;

  /// Icon code representing the current weather condition.
  @override
  final String icon;

  @override
  String toString() {
    return 'WeatherWeather(code: $code, main: $main, description: $description, icon: $icon)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$WeatherWeatherImpl &&
            (identical(other.code, code) || other.code == code) &&
            (identical(other.main, main) || other.main == main) &&
            (identical(other.description, description) ||
                other.description == description) &&
            (identical(other.icon, icon) || other.icon == icon));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, code, main, description, icon);

  /// Create a copy of WeatherWeather
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$WeatherWeatherImplCopyWith<_$WeatherWeatherImpl> get copyWith =>
      __$$WeatherWeatherImplCopyWithImpl<_$WeatherWeatherImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$WeatherWeatherImplToJson(
      this,
    );
  }
}

abstract class _WeatherWeather implements WeatherWeather {
  const factory _WeatherWeather(
      {required final num code,
      required final String main,
      required final String description,
      required final String icon}) = _$WeatherWeatherImpl;

  factory _WeatherWeather.fromJson(Map<String, dynamic> json) =
      _$WeatherWeatherImpl.fromJson;

  /// Weather condition code.
  @override
  num get code;

  /// Weather condition (e.g., Rain, Snow, Clear).
  @override
  String get main;

  /// Detailed description of the weather condition.
  @override
  String get description;

  /// Icon code representing the current weather condition.
  @override
  String get icon;

  /// Create a copy of WeatherWeather
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$WeatherWeatherImplCopyWith<_$WeatherWeatherImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
