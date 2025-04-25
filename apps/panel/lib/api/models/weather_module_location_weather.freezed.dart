// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'weather_module_location_weather.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

WeatherModuleLocationWeather _$WeatherModuleLocationWeatherFromJson(
    Map<String, dynamic> json) {
  return _WeatherModuleLocationWeather.fromJson(json);
}

/// @nodoc
mixin _$WeatherModuleLocationWeather {
  /// Current weather conditions at the specified location.
  WeatherModuleCurrentDay get current => throw _privateConstructorUsedError;

  /// List of daily weather forecasts.
  List<WeatherModuleForecastDay> get forecast =>
      throw _privateConstructorUsedError;

  /// Details of the location where the weather data is recorded.
  WeatherModuleLocation get location => throw _privateConstructorUsedError;

  /// Serializes this WeatherModuleLocationWeather to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of WeatherModuleLocationWeather
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $WeatherModuleLocationWeatherCopyWith<WeatherModuleLocationWeather>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $WeatherModuleLocationWeatherCopyWith<$Res> {
  factory $WeatherModuleLocationWeatherCopyWith(
          WeatherModuleLocationWeather value,
          $Res Function(WeatherModuleLocationWeather) then) =
      _$WeatherModuleLocationWeatherCopyWithImpl<$Res,
          WeatherModuleLocationWeather>;
  @useResult
  $Res call(
      {WeatherModuleCurrentDay current,
      List<WeatherModuleForecastDay> forecast,
      WeatherModuleLocation location});

  $WeatherModuleCurrentDayCopyWith<$Res> get current;
  $WeatherModuleLocationCopyWith<$Res> get location;
}

/// @nodoc
class _$WeatherModuleLocationWeatherCopyWithImpl<$Res,
        $Val extends WeatherModuleLocationWeather>
    implements $WeatherModuleLocationWeatherCopyWith<$Res> {
  _$WeatherModuleLocationWeatherCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of WeatherModuleLocationWeather
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? current = null,
    Object? forecast = null,
    Object? location = null,
  }) {
    return _then(_value.copyWith(
      current: null == current
          ? _value.current
          : current // ignore: cast_nullable_to_non_nullable
              as WeatherModuleCurrentDay,
      forecast: null == forecast
          ? _value.forecast
          : forecast // ignore: cast_nullable_to_non_nullable
              as List<WeatherModuleForecastDay>,
      location: null == location
          ? _value.location
          : location // ignore: cast_nullable_to_non_nullable
              as WeatherModuleLocation,
    ) as $Val);
  }

  /// Create a copy of WeatherModuleLocationWeather
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $WeatherModuleCurrentDayCopyWith<$Res> get current {
    return $WeatherModuleCurrentDayCopyWith<$Res>(_value.current, (value) {
      return _then(_value.copyWith(current: value) as $Val);
    });
  }

  /// Create a copy of WeatherModuleLocationWeather
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $WeatherModuleLocationCopyWith<$Res> get location {
    return $WeatherModuleLocationCopyWith<$Res>(_value.location, (value) {
      return _then(_value.copyWith(location: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$WeatherModuleLocationWeatherImplCopyWith<$Res>
    implements $WeatherModuleLocationWeatherCopyWith<$Res> {
  factory _$$WeatherModuleLocationWeatherImplCopyWith(
          _$WeatherModuleLocationWeatherImpl value,
          $Res Function(_$WeatherModuleLocationWeatherImpl) then) =
      __$$WeatherModuleLocationWeatherImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {WeatherModuleCurrentDay current,
      List<WeatherModuleForecastDay> forecast,
      WeatherModuleLocation location});

  @override
  $WeatherModuleCurrentDayCopyWith<$Res> get current;
  @override
  $WeatherModuleLocationCopyWith<$Res> get location;
}

/// @nodoc
class __$$WeatherModuleLocationWeatherImplCopyWithImpl<$Res>
    extends _$WeatherModuleLocationWeatherCopyWithImpl<$Res,
        _$WeatherModuleLocationWeatherImpl>
    implements _$$WeatherModuleLocationWeatherImplCopyWith<$Res> {
  __$$WeatherModuleLocationWeatherImplCopyWithImpl(
      _$WeatherModuleLocationWeatherImpl _value,
      $Res Function(_$WeatherModuleLocationWeatherImpl) _then)
      : super(_value, _then);

  /// Create a copy of WeatherModuleLocationWeather
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? current = null,
    Object? forecast = null,
    Object? location = null,
  }) {
    return _then(_$WeatherModuleLocationWeatherImpl(
      current: null == current
          ? _value.current
          : current // ignore: cast_nullable_to_non_nullable
              as WeatherModuleCurrentDay,
      forecast: null == forecast
          ? _value._forecast
          : forecast // ignore: cast_nullable_to_non_nullable
              as List<WeatherModuleForecastDay>,
      location: null == location
          ? _value.location
          : location // ignore: cast_nullable_to_non_nullable
              as WeatherModuleLocation,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$WeatherModuleLocationWeatherImpl
    implements _WeatherModuleLocationWeather {
  const _$WeatherModuleLocationWeatherImpl(
      {required this.current,
      required final List<WeatherModuleForecastDay> forecast,
      required this.location})
      : _forecast = forecast;

  factory _$WeatherModuleLocationWeatherImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$WeatherModuleLocationWeatherImplFromJson(json);

  /// Current weather conditions at the specified location.
  @override
  final WeatherModuleCurrentDay current;

  /// List of daily weather forecasts.
  final List<WeatherModuleForecastDay> _forecast;

  /// List of daily weather forecasts.
  @override
  List<WeatherModuleForecastDay> get forecast {
    if (_forecast is EqualUnmodifiableListView) return _forecast;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_forecast);
  }

  /// Details of the location where the weather data is recorded.
  @override
  final WeatherModuleLocation location;

  @override
  String toString() {
    return 'WeatherModuleLocationWeather(current: $current, forecast: $forecast, location: $location)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$WeatherModuleLocationWeatherImpl &&
            (identical(other.current, current) || other.current == current) &&
            const DeepCollectionEquality().equals(other._forecast, _forecast) &&
            (identical(other.location, location) ||
                other.location == location));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, current,
      const DeepCollectionEquality().hash(_forecast), location);

  /// Create a copy of WeatherModuleLocationWeather
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$WeatherModuleLocationWeatherImplCopyWith<
          _$WeatherModuleLocationWeatherImpl>
      get copyWith => __$$WeatherModuleLocationWeatherImplCopyWithImpl<
          _$WeatherModuleLocationWeatherImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$WeatherModuleLocationWeatherImplToJson(
      this,
    );
  }
}

abstract class _WeatherModuleLocationWeather
    implements WeatherModuleLocationWeather {
  const factory _WeatherModuleLocationWeather(
          {required final WeatherModuleCurrentDay current,
          required final List<WeatherModuleForecastDay> forecast,
          required final WeatherModuleLocation location}) =
      _$WeatherModuleLocationWeatherImpl;

  factory _WeatherModuleLocationWeather.fromJson(Map<String, dynamic> json) =
      _$WeatherModuleLocationWeatherImpl.fromJson;

  /// Current weather conditions at the specified location.
  @override
  WeatherModuleCurrentDay get current;

  /// List of daily weather forecasts.
  @override
  List<WeatherModuleForecastDay> get forecast;

  /// Details of the location where the weather data is recorded.
  @override
  WeatherModuleLocation get location;

  /// Create a copy of WeatherModuleLocationWeather
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$WeatherModuleLocationWeatherImplCopyWith<
          _$WeatherModuleLocationWeatherImpl>
      get copyWith => throw _privateConstructorUsedError;
}
