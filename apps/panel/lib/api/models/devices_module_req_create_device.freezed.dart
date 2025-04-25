// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_module_req_create_device.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesModuleReqCreateDevice _$DevicesModuleReqCreateDeviceFromJson(
    Map<String, dynamic> json) {
  return _DevicesModuleReqCreateDevice.fromJson(json);
}

/// @nodoc
mixin _$DevicesModuleReqCreateDevice {
  DevicesModuleCreateDevice get data => throw _privateConstructorUsedError;

  /// Serializes this DevicesModuleReqCreateDevice to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesModuleReqCreateDevice
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesModuleReqCreateDeviceCopyWith<DevicesModuleReqCreateDevice>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesModuleReqCreateDeviceCopyWith<$Res> {
  factory $DevicesModuleReqCreateDeviceCopyWith(
          DevicesModuleReqCreateDevice value,
          $Res Function(DevicesModuleReqCreateDevice) then) =
      _$DevicesModuleReqCreateDeviceCopyWithImpl<$Res,
          DevicesModuleReqCreateDevice>;
  @useResult
  $Res call({DevicesModuleCreateDevice data});

  $DevicesModuleCreateDeviceCopyWith<$Res> get data;
}

/// @nodoc
class _$DevicesModuleReqCreateDeviceCopyWithImpl<$Res,
        $Val extends DevicesModuleReqCreateDevice>
    implements $DevicesModuleReqCreateDeviceCopyWith<$Res> {
  _$DevicesModuleReqCreateDeviceCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesModuleReqCreateDevice
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_value.copyWith(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as DevicesModuleCreateDevice,
    ) as $Val);
  }

  /// Create a copy of DevicesModuleReqCreateDevice
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $DevicesModuleCreateDeviceCopyWith<$Res> get data {
    return $DevicesModuleCreateDeviceCopyWith<$Res>(_value.data, (value) {
      return _then(_value.copyWith(data: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$DevicesModuleReqCreateDeviceImplCopyWith<$Res>
    implements $DevicesModuleReqCreateDeviceCopyWith<$Res> {
  factory _$$DevicesModuleReqCreateDeviceImplCopyWith(
          _$DevicesModuleReqCreateDeviceImpl value,
          $Res Function(_$DevicesModuleReqCreateDeviceImpl) then) =
      __$$DevicesModuleReqCreateDeviceImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({DevicesModuleCreateDevice data});

  @override
  $DevicesModuleCreateDeviceCopyWith<$Res> get data;
}

/// @nodoc
class __$$DevicesModuleReqCreateDeviceImplCopyWithImpl<$Res>
    extends _$DevicesModuleReqCreateDeviceCopyWithImpl<$Res,
        _$DevicesModuleReqCreateDeviceImpl>
    implements _$$DevicesModuleReqCreateDeviceImplCopyWith<$Res> {
  __$$DevicesModuleReqCreateDeviceImplCopyWithImpl(
      _$DevicesModuleReqCreateDeviceImpl _value,
      $Res Function(_$DevicesModuleReqCreateDeviceImpl) _then)
      : super(_value, _then);

  /// Create a copy of DevicesModuleReqCreateDevice
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_$DevicesModuleReqCreateDeviceImpl(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as DevicesModuleCreateDevice,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DevicesModuleReqCreateDeviceImpl
    implements _DevicesModuleReqCreateDevice {
  const _$DevicesModuleReqCreateDeviceImpl({required this.data});

  factory _$DevicesModuleReqCreateDeviceImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DevicesModuleReqCreateDeviceImplFromJson(json);

  @override
  final DevicesModuleCreateDevice data;

  @override
  String toString() {
    return 'DevicesModuleReqCreateDevice(data: $data)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DevicesModuleReqCreateDeviceImpl &&
            (identical(other.data, data) || other.data == data));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, data);

  /// Create a copy of DevicesModuleReqCreateDevice
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesModuleReqCreateDeviceImplCopyWith<
          _$DevicesModuleReqCreateDeviceImpl>
      get copyWith => __$$DevicesModuleReqCreateDeviceImplCopyWithImpl<
          _$DevicesModuleReqCreateDeviceImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesModuleReqCreateDeviceImplToJson(
      this,
    );
  }
}

abstract class _DevicesModuleReqCreateDevice
    implements DevicesModuleReqCreateDevice {
  const factory _DevicesModuleReqCreateDevice(
          {required final DevicesModuleCreateDevice data}) =
      _$DevicesModuleReqCreateDeviceImpl;

  factory _DevicesModuleReqCreateDevice.fromJson(Map<String, dynamic> json) =
      _$DevicesModuleReqCreateDeviceImpl.fromJson;

  @override
  DevicesModuleCreateDevice get data;

  /// Create a copy of DevicesModuleReqCreateDevice
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesModuleReqCreateDeviceImplCopyWith<
          _$DevicesModuleReqCreateDeviceImpl>
      get copyWith => throw _privateConstructorUsedError;
}
