// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_module_req_update_device.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesModuleReqUpdateDevice _$DevicesModuleReqUpdateDeviceFromJson(
    Map<String, dynamic> json) {
  return _DevicesModuleReqUpdateDevice.fromJson(json);
}

/// @nodoc
mixin _$DevicesModuleReqUpdateDevice {
  DevicesModuleUpdateDevice get data => throw _privateConstructorUsedError;

  /// Serializes this DevicesModuleReqUpdateDevice to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesModuleReqUpdateDevice
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesModuleReqUpdateDeviceCopyWith<DevicesModuleReqUpdateDevice>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesModuleReqUpdateDeviceCopyWith<$Res> {
  factory $DevicesModuleReqUpdateDeviceCopyWith(
          DevicesModuleReqUpdateDevice value,
          $Res Function(DevicesModuleReqUpdateDevice) then) =
      _$DevicesModuleReqUpdateDeviceCopyWithImpl<$Res,
          DevicesModuleReqUpdateDevice>;
  @useResult
  $Res call({DevicesModuleUpdateDevice data});

  $DevicesModuleUpdateDeviceCopyWith<$Res> get data;
}

/// @nodoc
class _$DevicesModuleReqUpdateDeviceCopyWithImpl<$Res,
        $Val extends DevicesModuleReqUpdateDevice>
    implements $DevicesModuleReqUpdateDeviceCopyWith<$Res> {
  _$DevicesModuleReqUpdateDeviceCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesModuleReqUpdateDevice
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
              as DevicesModuleUpdateDevice,
    ) as $Val);
  }

  /// Create a copy of DevicesModuleReqUpdateDevice
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $DevicesModuleUpdateDeviceCopyWith<$Res> get data {
    return $DevicesModuleUpdateDeviceCopyWith<$Res>(_value.data, (value) {
      return _then(_value.copyWith(data: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$DevicesModuleReqUpdateDeviceImplCopyWith<$Res>
    implements $DevicesModuleReqUpdateDeviceCopyWith<$Res> {
  factory _$$DevicesModuleReqUpdateDeviceImplCopyWith(
          _$DevicesModuleReqUpdateDeviceImpl value,
          $Res Function(_$DevicesModuleReqUpdateDeviceImpl) then) =
      __$$DevicesModuleReqUpdateDeviceImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({DevicesModuleUpdateDevice data});

  @override
  $DevicesModuleUpdateDeviceCopyWith<$Res> get data;
}

/// @nodoc
class __$$DevicesModuleReqUpdateDeviceImplCopyWithImpl<$Res>
    extends _$DevicesModuleReqUpdateDeviceCopyWithImpl<$Res,
        _$DevicesModuleReqUpdateDeviceImpl>
    implements _$$DevicesModuleReqUpdateDeviceImplCopyWith<$Res> {
  __$$DevicesModuleReqUpdateDeviceImplCopyWithImpl(
      _$DevicesModuleReqUpdateDeviceImpl _value,
      $Res Function(_$DevicesModuleReqUpdateDeviceImpl) _then)
      : super(_value, _then);

  /// Create a copy of DevicesModuleReqUpdateDevice
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_$DevicesModuleReqUpdateDeviceImpl(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as DevicesModuleUpdateDevice,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DevicesModuleReqUpdateDeviceImpl
    implements _DevicesModuleReqUpdateDevice {
  const _$DevicesModuleReqUpdateDeviceImpl({required this.data});

  factory _$DevicesModuleReqUpdateDeviceImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DevicesModuleReqUpdateDeviceImplFromJson(json);

  @override
  final DevicesModuleUpdateDevice data;

  @override
  String toString() {
    return 'DevicesModuleReqUpdateDevice(data: $data)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DevicesModuleReqUpdateDeviceImpl &&
            (identical(other.data, data) || other.data == data));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, data);

  /// Create a copy of DevicesModuleReqUpdateDevice
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesModuleReqUpdateDeviceImplCopyWith<
          _$DevicesModuleReqUpdateDeviceImpl>
      get copyWith => __$$DevicesModuleReqUpdateDeviceImplCopyWithImpl<
          _$DevicesModuleReqUpdateDeviceImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesModuleReqUpdateDeviceImplToJson(
      this,
    );
  }
}

abstract class _DevicesModuleReqUpdateDevice
    implements DevicesModuleReqUpdateDevice {
  const factory _DevicesModuleReqUpdateDevice(
          {required final DevicesModuleUpdateDevice data}) =
      _$DevicesModuleReqUpdateDeviceImpl;

  factory _DevicesModuleReqUpdateDevice.fromJson(Map<String, dynamic> json) =
      _$DevicesModuleReqUpdateDeviceImpl.fromJson;

  @override
  DevicesModuleUpdateDevice get data;

  /// Create a copy of DevicesModuleReqUpdateDevice
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesModuleReqUpdateDeviceImplCopyWith<
          _$DevicesModuleReqUpdateDeviceImpl>
      get copyWith => throw _privateConstructorUsedError;
}
