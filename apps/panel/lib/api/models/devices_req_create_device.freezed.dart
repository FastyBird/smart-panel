// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_req_create_device.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesReqCreateDevice _$DevicesReqCreateDeviceFromJson(
    Map<String, dynamic> json) {
  return _DevicesReqCreateDevice.fromJson(json);
}

/// @nodoc
mixin _$DevicesReqCreateDevice {
  DevicesCreateDevice get data => throw _privateConstructorUsedError;

  /// Serializes this DevicesReqCreateDevice to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesReqCreateDevice
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesReqCreateDeviceCopyWith<DevicesReqCreateDevice> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesReqCreateDeviceCopyWith<$Res> {
  factory $DevicesReqCreateDeviceCopyWith(DevicesReqCreateDevice value,
          $Res Function(DevicesReqCreateDevice) then) =
      _$DevicesReqCreateDeviceCopyWithImpl<$Res, DevicesReqCreateDevice>;
  @useResult
  $Res call({DevicesCreateDevice data});

  $DevicesCreateDeviceCopyWith<$Res> get data;
}

/// @nodoc
class _$DevicesReqCreateDeviceCopyWithImpl<$Res,
        $Val extends DevicesReqCreateDevice>
    implements $DevicesReqCreateDeviceCopyWith<$Res> {
  _$DevicesReqCreateDeviceCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesReqCreateDevice
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
              as DevicesCreateDevice,
    ) as $Val);
  }

  /// Create a copy of DevicesReqCreateDevice
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $DevicesCreateDeviceCopyWith<$Res> get data {
    return $DevicesCreateDeviceCopyWith<$Res>(_value.data, (value) {
      return _then(_value.copyWith(data: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$DevicesReqCreateDeviceImplCopyWith<$Res>
    implements $DevicesReqCreateDeviceCopyWith<$Res> {
  factory _$$DevicesReqCreateDeviceImplCopyWith(
          _$DevicesReqCreateDeviceImpl value,
          $Res Function(_$DevicesReqCreateDeviceImpl) then) =
      __$$DevicesReqCreateDeviceImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({DevicesCreateDevice data});

  @override
  $DevicesCreateDeviceCopyWith<$Res> get data;
}

/// @nodoc
class __$$DevicesReqCreateDeviceImplCopyWithImpl<$Res>
    extends _$DevicesReqCreateDeviceCopyWithImpl<$Res,
        _$DevicesReqCreateDeviceImpl>
    implements _$$DevicesReqCreateDeviceImplCopyWith<$Res> {
  __$$DevicesReqCreateDeviceImplCopyWithImpl(
      _$DevicesReqCreateDeviceImpl _value,
      $Res Function(_$DevicesReqCreateDeviceImpl) _then)
      : super(_value, _then);

  /// Create a copy of DevicesReqCreateDevice
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_$DevicesReqCreateDeviceImpl(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as DevicesCreateDevice,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DevicesReqCreateDeviceImpl implements _DevicesReqCreateDevice {
  const _$DevicesReqCreateDeviceImpl({required this.data});

  factory _$DevicesReqCreateDeviceImpl.fromJson(Map<String, dynamic> json) =>
      _$$DevicesReqCreateDeviceImplFromJson(json);

  @override
  final DevicesCreateDevice data;

  @override
  String toString() {
    return 'DevicesReqCreateDevice(data: $data)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DevicesReqCreateDeviceImpl &&
            (identical(other.data, data) || other.data == data));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, data);

  /// Create a copy of DevicesReqCreateDevice
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesReqCreateDeviceImplCopyWith<_$DevicesReqCreateDeviceImpl>
      get copyWith => __$$DevicesReqCreateDeviceImplCopyWithImpl<
          _$DevicesReqCreateDeviceImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesReqCreateDeviceImplToJson(
      this,
    );
  }
}

abstract class _DevicesReqCreateDevice implements DevicesReqCreateDevice {
  const factory _DevicesReqCreateDevice(
      {required final DevicesCreateDevice data}) = _$DevicesReqCreateDeviceImpl;

  factory _DevicesReqCreateDevice.fromJson(Map<String, dynamic> json) =
      _$DevicesReqCreateDeviceImpl.fromJson;

  @override
  DevicesCreateDevice get data;

  /// Create a copy of DevicesReqCreateDevice
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesReqCreateDeviceImplCopyWith<_$DevicesReqCreateDeviceImpl>
      get copyWith => throw _privateConstructorUsedError;
}
