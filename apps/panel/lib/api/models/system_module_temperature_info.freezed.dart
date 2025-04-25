// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'system_module_temperature_info.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

SystemModuleTemperatureInfo _$SystemModuleTemperatureInfoFromJson(
    Map<String, dynamic> json) {
  return _SystemModuleTemperatureInfo.fromJson(json);
}

/// @nodoc
mixin _$SystemModuleTemperatureInfo {
  /// CPU temperature in Celsius.
  int? get cpu => throw _privateConstructorUsedError;

  /// GPU temperature in Celsius.
  int? get gpu => throw _privateConstructorUsedError;

  /// Serializes this SystemModuleTemperatureInfo to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SystemModuleTemperatureInfo
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SystemModuleTemperatureInfoCopyWith<SystemModuleTemperatureInfo>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SystemModuleTemperatureInfoCopyWith<$Res> {
  factory $SystemModuleTemperatureInfoCopyWith(
          SystemModuleTemperatureInfo value,
          $Res Function(SystemModuleTemperatureInfo) then) =
      _$SystemModuleTemperatureInfoCopyWithImpl<$Res,
          SystemModuleTemperatureInfo>;
  @useResult
  $Res call({int? cpu, int? gpu});
}

/// @nodoc
class _$SystemModuleTemperatureInfoCopyWithImpl<$Res,
        $Val extends SystemModuleTemperatureInfo>
    implements $SystemModuleTemperatureInfoCopyWith<$Res> {
  _$SystemModuleTemperatureInfoCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SystemModuleTemperatureInfo
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
abstract class _$$SystemModuleTemperatureInfoImplCopyWith<$Res>
    implements $SystemModuleTemperatureInfoCopyWith<$Res> {
  factory _$$SystemModuleTemperatureInfoImplCopyWith(
          _$SystemModuleTemperatureInfoImpl value,
          $Res Function(_$SystemModuleTemperatureInfoImpl) then) =
      __$$SystemModuleTemperatureInfoImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({int? cpu, int? gpu});
}

/// @nodoc
class __$$SystemModuleTemperatureInfoImplCopyWithImpl<$Res>
    extends _$SystemModuleTemperatureInfoCopyWithImpl<$Res,
        _$SystemModuleTemperatureInfoImpl>
    implements _$$SystemModuleTemperatureInfoImplCopyWith<$Res> {
  __$$SystemModuleTemperatureInfoImplCopyWithImpl(
      _$SystemModuleTemperatureInfoImpl _value,
      $Res Function(_$SystemModuleTemperatureInfoImpl) _then)
      : super(_value, _then);

  /// Create a copy of SystemModuleTemperatureInfo
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? cpu = freezed,
    Object? gpu = freezed,
  }) {
    return _then(_$SystemModuleTemperatureInfoImpl(
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
class _$SystemModuleTemperatureInfoImpl
    implements _SystemModuleTemperatureInfo {
  const _$SystemModuleTemperatureInfoImpl({this.cpu, this.gpu});

  factory _$SystemModuleTemperatureInfoImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$SystemModuleTemperatureInfoImplFromJson(json);

  /// CPU temperature in Celsius.
  @override
  final int? cpu;

  /// GPU temperature in Celsius.
  @override
  final int? gpu;

  @override
  String toString() {
    return 'SystemModuleTemperatureInfo(cpu: $cpu, gpu: $gpu)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SystemModuleTemperatureInfoImpl &&
            (identical(other.cpu, cpu) || other.cpu == cpu) &&
            (identical(other.gpu, gpu) || other.gpu == gpu));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, cpu, gpu);

  /// Create a copy of SystemModuleTemperatureInfo
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SystemModuleTemperatureInfoImplCopyWith<_$SystemModuleTemperatureInfoImpl>
      get copyWith => __$$SystemModuleTemperatureInfoImplCopyWithImpl<
          _$SystemModuleTemperatureInfoImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SystemModuleTemperatureInfoImplToJson(
      this,
    );
  }
}

abstract class _SystemModuleTemperatureInfo
    implements SystemModuleTemperatureInfo {
  const factory _SystemModuleTemperatureInfo({final int? cpu, final int? gpu}) =
      _$SystemModuleTemperatureInfoImpl;

  factory _SystemModuleTemperatureInfo.fromJson(Map<String, dynamic> json) =
      _$SystemModuleTemperatureInfoImpl.fromJson;

  /// CPU temperature in Celsius.
  @override
  int? get cpu;

  /// GPU temperature in Celsius.
  @override
  int? get gpu;

  /// Create a copy of SystemModuleTemperatureInfo
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SystemModuleTemperatureInfoImplCopyWith<_$SystemModuleTemperatureInfoImpl>
      get copyWith => throw _privateConstructorUsedError;
}
