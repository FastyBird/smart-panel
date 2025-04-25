// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'weather_module_geolocation.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

WeatherModuleGeolocation _$WeatherModuleGeolocationFromJson(
    Map<String, dynamic> json) {
  return _WeatherModuleGeolocation.fromJson(json);
}

/// @nodoc
mixin _$WeatherModuleGeolocation {
  /// Name of the city or location.
  String get name => throw _privateConstructorUsedError;

  /// Alternative names for the location in different languages.
  @JsonKey(name: 'local_names')
  Map<String, String> get localNames => throw _privateConstructorUsedError;

  /// Latitude coordinate of the location.
  String get lat => throw _privateConstructorUsedError;

  /// Longitude coordinate of the location.
  String get lon => throw _privateConstructorUsedError;

  /// Country code (ISO 3166-1 alpha-2) or full country name.
  String get country => throw _privateConstructorUsedError;

  /// State or province where the location is situated, if applicable.
  String get state => throw _privateConstructorUsedError;

  /// Serializes this WeatherModuleGeolocation to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of WeatherModuleGeolocation
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $WeatherModuleGeolocationCopyWith<WeatherModuleGeolocation> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $WeatherModuleGeolocationCopyWith<$Res> {
  factory $WeatherModuleGeolocationCopyWith(WeatherModuleGeolocation value,
          $Res Function(WeatherModuleGeolocation) then) =
      _$WeatherModuleGeolocationCopyWithImpl<$Res, WeatherModuleGeolocation>;
  @useResult
  $Res call(
      {String name,
      @JsonKey(name: 'local_names') Map<String, String> localNames,
      String lat,
      String lon,
      String country,
      String state});
}

/// @nodoc
class _$WeatherModuleGeolocationCopyWithImpl<$Res,
        $Val extends WeatherModuleGeolocation>
    implements $WeatherModuleGeolocationCopyWith<$Res> {
  _$WeatherModuleGeolocationCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of WeatherModuleGeolocation
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? name = null,
    Object? localNames = null,
    Object? lat = null,
    Object? lon = null,
    Object? country = null,
    Object? state = null,
  }) {
    return _then(_value.copyWith(
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      localNames: null == localNames
          ? _value.localNames
          : localNames // ignore: cast_nullable_to_non_nullable
              as Map<String, String>,
      lat: null == lat
          ? _value.lat
          : lat // ignore: cast_nullable_to_non_nullable
              as String,
      lon: null == lon
          ? _value.lon
          : lon // ignore: cast_nullable_to_non_nullable
              as String,
      country: null == country
          ? _value.country
          : country // ignore: cast_nullable_to_non_nullable
              as String,
      state: null == state
          ? _value.state
          : state // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$WeatherModuleGeolocationImplCopyWith<$Res>
    implements $WeatherModuleGeolocationCopyWith<$Res> {
  factory _$$WeatherModuleGeolocationImplCopyWith(
          _$WeatherModuleGeolocationImpl value,
          $Res Function(_$WeatherModuleGeolocationImpl) then) =
      __$$WeatherModuleGeolocationImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String name,
      @JsonKey(name: 'local_names') Map<String, String> localNames,
      String lat,
      String lon,
      String country,
      String state});
}

/// @nodoc
class __$$WeatherModuleGeolocationImplCopyWithImpl<$Res>
    extends _$WeatherModuleGeolocationCopyWithImpl<$Res,
        _$WeatherModuleGeolocationImpl>
    implements _$$WeatherModuleGeolocationImplCopyWith<$Res> {
  __$$WeatherModuleGeolocationImplCopyWithImpl(
      _$WeatherModuleGeolocationImpl _value,
      $Res Function(_$WeatherModuleGeolocationImpl) _then)
      : super(_value, _then);

  /// Create a copy of WeatherModuleGeolocation
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? name = null,
    Object? localNames = null,
    Object? lat = null,
    Object? lon = null,
    Object? country = null,
    Object? state = null,
  }) {
    return _then(_$WeatherModuleGeolocationImpl(
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      localNames: null == localNames
          ? _value._localNames
          : localNames // ignore: cast_nullable_to_non_nullable
              as Map<String, String>,
      lat: null == lat
          ? _value.lat
          : lat // ignore: cast_nullable_to_non_nullable
              as String,
      lon: null == lon
          ? _value.lon
          : lon // ignore: cast_nullable_to_non_nullable
              as String,
      country: null == country
          ? _value.country
          : country // ignore: cast_nullable_to_non_nullable
              as String,
      state: null == state
          ? _value.state
          : state // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$WeatherModuleGeolocationImpl implements _WeatherModuleGeolocation {
  const _$WeatherModuleGeolocationImpl(
      {required this.name,
      @JsonKey(name: 'local_names')
      required final Map<String, String> localNames,
      required this.lat,
      required this.lon,
      required this.country,
      required this.state})
      : _localNames = localNames;

  factory _$WeatherModuleGeolocationImpl.fromJson(Map<String, dynamic> json) =>
      _$$WeatherModuleGeolocationImplFromJson(json);

  /// Name of the city or location.
  @override
  final String name;

  /// Alternative names for the location in different languages.
  final Map<String, String> _localNames;

  /// Alternative names for the location in different languages.
  @override
  @JsonKey(name: 'local_names')
  Map<String, String> get localNames {
    if (_localNames is EqualUnmodifiableMapView) return _localNames;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableMapView(_localNames);
  }

  /// Latitude coordinate of the location.
  @override
  final String lat;

  /// Longitude coordinate of the location.
  @override
  final String lon;

  /// Country code (ISO 3166-1 alpha-2) or full country name.
  @override
  final String country;

  /// State or province where the location is situated, if applicable.
  @override
  final String state;

  @override
  String toString() {
    return 'WeatherModuleGeolocation(name: $name, localNames: $localNames, lat: $lat, lon: $lon, country: $country, state: $state)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$WeatherModuleGeolocationImpl &&
            (identical(other.name, name) || other.name == name) &&
            const DeepCollectionEquality()
                .equals(other._localNames, _localNames) &&
            (identical(other.lat, lat) || other.lat == lat) &&
            (identical(other.lon, lon) || other.lon == lon) &&
            (identical(other.country, country) || other.country == country) &&
            (identical(other.state, state) || other.state == state));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      name,
      const DeepCollectionEquality().hash(_localNames),
      lat,
      lon,
      country,
      state);

  /// Create a copy of WeatherModuleGeolocation
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$WeatherModuleGeolocationImplCopyWith<_$WeatherModuleGeolocationImpl>
      get copyWith => __$$WeatherModuleGeolocationImplCopyWithImpl<
          _$WeatherModuleGeolocationImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$WeatherModuleGeolocationImplToJson(
      this,
    );
  }
}

abstract class _WeatherModuleGeolocation implements WeatherModuleGeolocation {
  const factory _WeatherModuleGeolocation(
      {required final String name,
      @JsonKey(name: 'local_names')
      required final Map<String, String> localNames,
      required final String lat,
      required final String lon,
      required final String country,
      required final String state}) = _$WeatherModuleGeolocationImpl;

  factory _WeatherModuleGeolocation.fromJson(Map<String, dynamic> json) =
      _$WeatherModuleGeolocationImpl.fromJson;

  /// Name of the city or location.
  @override
  String get name;

  /// Alternative names for the location in different languages.
  @override
  @JsonKey(name: 'local_names')
  Map<String, String> get localNames;

  /// Latitude coordinate of the location.
  @override
  String get lat;

  /// Longitude coordinate of the location.
  @override
  String get lon;

  /// Country code (ISO 3166-1 alpha-2) or full country name.
  @override
  String get country;

  /// State or province where the location is situated, if applicable.
  @override
  String get state;

  /// Create a copy of WeatherModuleGeolocation
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$WeatherModuleGeolocationImplCopyWith<_$WeatherModuleGeolocationImpl>
      get copyWith => throw _privateConstructorUsedError;
}
