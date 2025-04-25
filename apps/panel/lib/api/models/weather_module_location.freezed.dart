// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'weather_module_location.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

WeatherModuleLocation _$WeatherModuleLocationFromJson(
    Map<String, dynamic> json) {
  return _WeatherModuleLocation.fromJson(json);
}

/// @nodoc
mixin _$WeatherModuleLocation {
  /// Name of the city or region.
  String get name => throw _privateConstructorUsedError;

  /// Country code (ISO 3166-1 alpha-2) or full country name.
  String get country => throw _privateConstructorUsedError;

  /// Serializes this WeatherModuleLocation to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of WeatherModuleLocation
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $WeatherModuleLocationCopyWith<WeatherModuleLocation> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $WeatherModuleLocationCopyWith<$Res> {
  factory $WeatherModuleLocationCopyWith(WeatherModuleLocation value,
          $Res Function(WeatherModuleLocation) then) =
      _$WeatherModuleLocationCopyWithImpl<$Res, WeatherModuleLocation>;
  @useResult
  $Res call({String name, String country});
}

/// @nodoc
class _$WeatherModuleLocationCopyWithImpl<$Res,
        $Val extends WeatherModuleLocation>
    implements $WeatherModuleLocationCopyWith<$Res> {
  _$WeatherModuleLocationCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of WeatherModuleLocation
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? name = null,
    Object? country = null,
  }) {
    return _then(_value.copyWith(
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      country: null == country
          ? _value.country
          : country // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$WeatherModuleLocationImplCopyWith<$Res>
    implements $WeatherModuleLocationCopyWith<$Res> {
  factory _$$WeatherModuleLocationImplCopyWith(
          _$WeatherModuleLocationImpl value,
          $Res Function(_$WeatherModuleLocationImpl) then) =
      __$$WeatherModuleLocationImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String name, String country});
}

/// @nodoc
class __$$WeatherModuleLocationImplCopyWithImpl<$Res>
    extends _$WeatherModuleLocationCopyWithImpl<$Res,
        _$WeatherModuleLocationImpl>
    implements _$$WeatherModuleLocationImplCopyWith<$Res> {
  __$$WeatherModuleLocationImplCopyWithImpl(_$WeatherModuleLocationImpl _value,
      $Res Function(_$WeatherModuleLocationImpl) _then)
      : super(_value, _then);

  /// Create a copy of WeatherModuleLocation
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? name = null,
    Object? country = null,
  }) {
    return _then(_$WeatherModuleLocationImpl(
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      country: null == country
          ? _value.country
          : country // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$WeatherModuleLocationImpl implements _WeatherModuleLocation {
  const _$WeatherModuleLocationImpl(
      {required this.name, required this.country});

  factory _$WeatherModuleLocationImpl.fromJson(Map<String, dynamic> json) =>
      _$$WeatherModuleLocationImplFromJson(json);

  /// Name of the city or region.
  @override
  final String name;

  /// Country code (ISO 3166-1 alpha-2) or full country name.
  @override
  final String country;

  @override
  String toString() {
    return 'WeatherModuleLocation(name: $name, country: $country)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$WeatherModuleLocationImpl &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.country, country) || other.country == country));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, name, country);

  /// Create a copy of WeatherModuleLocation
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$WeatherModuleLocationImplCopyWith<_$WeatherModuleLocationImpl>
      get copyWith => __$$WeatherModuleLocationImplCopyWithImpl<
          _$WeatherModuleLocationImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$WeatherModuleLocationImplToJson(
      this,
    );
  }
}

abstract class _WeatherModuleLocation implements WeatherModuleLocation {
  const factory _WeatherModuleLocation(
      {required final String name,
      required final String country}) = _$WeatherModuleLocationImpl;

  factory _WeatherModuleLocation.fromJson(Map<String, dynamic> json) =
      _$WeatherModuleLocationImpl.fromJson;

  /// Name of the city or region.
  @override
  String get name;

  /// Country code (ISO 3166-1 alpha-2) or full country name.
  @override
  String get country;

  /// Create a copy of WeatherModuleLocation
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$WeatherModuleLocationImplCopyWith<_$WeatherModuleLocationImpl>
      get copyWith => throw _privateConstructorUsedError;
}
