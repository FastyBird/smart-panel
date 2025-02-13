// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'system_temperature_info.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

SystemTemperatureInfo _$SystemTemperatureInfoFromJson(
    Map<String, dynamic> json) {
  return _SystemTemperatureInfo.fromJson(json);
}

/// @nodoc
mixin _$SystemTemperatureInfo {
  /// CPU temperature in Celsius.
  int? get cpu => throw _privateConstructorUsedError;

  /// GPU temperature in Celsius.
  int? get gpu => throw _privateConstructorUsedError;

  /// Serializes this SystemTemperatureInfo to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SystemTemperatureInfo
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SystemTemperatureInfoCopyWith<SystemTemperatureInfo> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SystemTemperatureInfoCopyWith<$Res> {
  factory $SystemTemperatureInfoCopyWith(SystemTemperatureInfo value,
          $Res Function(SystemTemperatureInfo) then) =
      _$SystemTemperatureInfoCopyWithImpl<$Res, SystemTemperatureInfo>;
  @useResult
  $Res call({int? cpu, int? gpu});
}

/// @nodoc
class _$SystemTemperatureInfoCopyWithImpl<$Res,
        $Val extends SystemTemperatureInfo>
    implements $SystemTemperatureInfoCopyWith<$Res> {
  _$SystemTemperatureInfoCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SystemTemperatureInfo
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? cpu = freezed,
    Object? gpu = freezed,
  }) {
    return _then(_value.copyWith(
      cpu: freezed == cpu
          ? _value.cpu
          : cpu // ignore: cast_nullable_to_non_nullable
              as int?,
      gpu: freezed == gpu
          ? _value.gpu
          : gpu // ignore: cast_nullable_to_non_nullable
              as int?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$SystemTemperatureInfoImplCopyWith<$Res>
    implements $SystemTemperatureInfoCopyWith<$Res> {
  factory _$$SystemTemperatureInfoImplCopyWith(
          _$SystemTemperatureInfoImpl value,
          $Res Function(_$SystemTemperatureInfoImpl) then) =
      __$$SystemTemperatureInfoImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({int? cpu, int? gpu});
}

/// @nodoc
class __$$SystemTemperatureInfoImplCopyWithImpl<$Res>
    extends _$SystemTemperatureInfoCopyWithImpl<$Res,
        _$SystemTemperatureInfoImpl>
    implements _$$SystemTemperatureInfoImplCopyWith<$Res> {
  __$$SystemTemperatureInfoImplCopyWithImpl(_$SystemTemperatureInfoImpl _value,
      $Res Function(_$SystemTemperatureInfoImpl) _then)
      : super(_value, _then);

  /// Create a copy of SystemTemperatureInfo
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? cpu = freezed,
    Object? gpu = freezed,
  }) {
    return _then(_$SystemTemperatureInfoImpl(
      cpu: freezed == cpu
          ? _value.cpu
          : cpu // ignore: cast_nullable_to_non_nullable
              as int?,
      gpu: freezed == gpu
          ? _value.gpu
          : gpu // ignore: cast_nullable_to_non_nullable
              as int?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$SystemTemperatureInfoImpl implements _SystemTemperatureInfo {
  const _$SystemTemperatureInfoImpl({this.cpu, this.gpu});

  factory _$SystemTemperatureInfoImpl.fromJson(Map<String, dynamic> json) =>
      _$$SystemTemperatureInfoImplFromJson(json);

  /// CPU temperature in Celsius.
  @override
  final int? cpu;

  /// GPU temperature in Celsius.
  @override
  final int? gpu;

  @override
  String toString() {
    return 'SystemTemperatureInfo(cpu: $cpu, gpu: $gpu)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SystemTemperatureInfoImpl &&
            (identical(other.cpu, cpu) || other.cpu == cpu) &&
            (identical(other.gpu, gpu) || other.gpu == gpu));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, cpu, gpu);

  /// Create a copy of SystemTemperatureInfo
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SystemTemperatureInfoImplCopyWith<_$SystemTemperatureInfoImpl>
      get copyWith => __$$SystemTemperatureInfoImplCopyWithImpl<
          _$SystemTemperatureInfoImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SystemTemperatureInfoImplToJson(
      this,
    );
  }
}

abstract class _SystemTemperatureInfo implements SystemTemperatureInfo {
  const factory _SystemTemperatureInfo({final int? cpu, final int? gpu}) =
      _$SystemTemperatureInfoImpl;

  factory _SystemTemperatureInfo.fromJson(Map<String, dynamic> json) =
      _$SystemTemperatureInfoImpl.fromJson;

  /// CPU temperature in Celsius.
  @override
  int? get cpu;

  /// GPU temperature in Celsius.
  @override
  int? get gpu;

  /// Create a copy of SystemTemperatureInfo
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SystemTemperatureInfoImplCopyWith<_$SystemTemperatureInfoImpl>
      get copyWith => throw _privateConstructorUsedError;
}
