// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_req_update_device.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesReqUpdateDevice _$DevicesReqUpdateDeviceFromJson(
    Map<String, dynamic> json) {
  return _DevicesReqUpdateDevice.fromJson(json);
}

/// @nodoc
mixin _$DevicesReqUpdateDevice {
  DevicesUpdateDevice get data => throw _privateConstructorUsedError;

  /// Serializes this DevicesReqUpdateDevice to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesReqUpdateDevice
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesReqUpdateDeviceCopyWith<DevicesReqUpdateDevice> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesReqUpdateDeviceCopyWith<$Res> {
  factory $DevicesReqUpdateDeviceCopyWith(DevicesReqUpdateDevice value,
          $Res Function(DevicesReqUpdateDevice) then) =
      _$DevicesReqUpdateDeviceCopyWithImpl<$Res, DevicesReqUpdateDevice>;
  @useResult
  $Res call({DevicesUpdateDevice data});

  $DevicesUpdateDeviceCopyWith<$Res> get data;
}

/// @nodoc
class _$DevicesReqUpdateDeviceCopyWithImpl<$Res,
        $Val extends DevicesReqUpdateDevice>
    implements $DevicesReqUpdateDeviceCopyWith<$Res> {
  _$DevicesReqUpdateDeviceCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesReqUpdateDevice
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
              as DevicesUpdateDevice,
    ) as $Val);
  }

  /// Create a copy of DevicesReqUpdateDevice
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $DevicesUpdateDeviceCopyWith<$Res> get data {
    return $DevicesUpdateDeviceCopyWith<$Res>(_value.data, (value) {
      return _then(_value.copyWith(data: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$DevicesReqUpdateDeviceImplCopyWith<$Res>
    implements $DevicesReqUpdateDeviceCopyWith<$Res> {
  factory _$$DevicesReqUpdateDeviceImplCopyWith(
          _$DevicesReqUpdateDeviceImpl value,
          $Res Function(_$DevicesReqUpdateDeviceImpl) then) =
      __$$DevicesReqUpdateDeviceImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({DevicesUpdateDevice data});

  @override
  $DevicesUpdateDeviceCopyWith<$Res> get data;
}

/// @nodoc
class __$$DevicesReqUpdateDeviceImplCopyWithImpl<$Res>
    extends _$DevicesReqUpdateDeviceCopyWithImpl<$Res,
        _$DevicesReqUpdateDeviceImpl>
    implements _$$DevicesReqUpdateDeviceImplCopyWith<$Res> {
  __$$DevicesReqUpdateDeviceImplCopyWithImpl(
      _$DevicesReqUpdateDeviceImpl _value,
      $Res Function(_$DevicesReqUpdateDeviceImpl) _then)
      : super(_value, _then);

  /// Create a copy of DevicesReqUpdateDevice
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_$DevicesReqUpdateDeviceImpl(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as DevicesUpdateDevice,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DevicesReqUpdateDeviceImpl implements _DevicesReqUpdateDevice {
  const _$DevicesReqUpdateDeviceImpl({required this.data});

  factory _$DevicesReqUpdateDeviceImpl.fromJson(Map<String, dynamic> json) =>
      _$$DevicesReqUpdateDeviceImplFromJson(json);

  @override
  final DevicesUpdateDevice data;

  @override
  String toString() {
    return 'DevicesReqUpdateDevice(data: $data)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DevicesReqUpdateDeviceImpl &&
            (identical(other.data, data) || other.data == data));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, data);

  /// Create a copy of DevicesReqUpdateDevice
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesReqUpdateDeviceImplCopyWith<_$DevicesReqUpdateDeviceImpl>
      get copyWith => __$$DevicesReqUpdateDeviceImplCopyWithImpl<
          _$DevicesReqUpdateDeviceImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesReqUpdateDeviceImplToJson(
      this,
    );
  }
}

abstract class _DevicesReqUpdateDevice implements DevicesReqUpdateDevice {
  const factory _DevicesReqUpdateDevice(
      {required final DevicesUpdateDevice data}) = _$DevicesReqUpdateDeviceImpl;

  factory _DevicesReqUpdateDevice.fromJson(Map<String, dynamic> json) =
      _$DevicesReqUpdateDeviceImpl.fromJson;

  @override
  DevicesUpdateDevice get data;

  /// Create a copy of DevicesReqUpdateDevice
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesReqUpdateDeviceImplCopyWith<_$DevicesReqUpdateDeviceImpl>
      get copyWith => throw _privateConstructorUsedError;
}
