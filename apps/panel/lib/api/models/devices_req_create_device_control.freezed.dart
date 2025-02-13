// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_req_create_device_control.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesReqCreateDeviceControl _$DevicesReqCreateDeviceControlFromJson(
    Map<String, dynamic> json) {
  return _DevicesReqCreateDeviceControl.fromJson(json);
}

/// @nodoc
mixin _$DevicesReqCreateDeviceControl {
  DevicesCreateDeviceControl get data => throw _privateConstructorUsedError;

  /// Serializes this DevicesReqCreateDeviceControl to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesReqCreateDeviceControl
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesReqCreateDeviceControlCopyWith<DevicesReqCreateDeviceControl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesReqCreateDeviceControlCopyWith<$Res> {
  factory $DevicesReqCreateDeviceControlCopyWith(
          DevicesReqCreateDeviceControl value,
          $Res Function(DevicesReqCreateDeviceControl) then) =
      _$DevicesReqCreateDeviceControlCopyWithImpl<$Res,
          DevicesReqCreateDeviceControl>;
  @useResult
  $Res call({DevicesCreateDeviceControl data});

  $DevicesCreateDeviceControlCopyWith<$Res> get data;
}

/// @nodoc
class _$DevicesReqCreateDeviceControlCopyWithImpl<$Res,
        $Val extends DevicesReqCreateDeviceControl>
    implements $DevicesReqCreateDeviceControlCopyWith<$Res> {
  _$DevicesReqCreateDeviceControlCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesReqCreateDeviceControl
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
              as DevicesCreateDeviceControl,
    ) as $Val);
  }

  /// Create a copy of DevicesReqCreateDeviceControl
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $DevicesCreateDeviceControlCopyWith<$Res> get data {
    return $DevicesCreateDeviceControlCopyWith<$Res>(_value.data, (value) {
      return _then(_value.copyWith(data: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$DevicesReqCreateDeviceControlImplCopyWith<$Res>
    implements $DevicesReqCreateDeviceControlCopyWith<$Res> {
  factory _$$DevicesReqCreateDeviceControlImplCopyWith(
          _$DevicesReqCreateDeviceControlImpl value,
          $Res Function(_$DevicesReqCreateDeviceControlImpl) then) =
      __$$DevicesReqCreateDeviceControlImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({DevicesCreateDeviceControl data});

  @override
  $DevicesCreateDeviceControlCopyWith<$Res> get data;
}

/// @nodoc
class __$$DevicesReqCreateDeviceControlImplCopyWithImpl<$Res>
    extends _$DevicesReqCreateDeviceControlCopyWithImpl<$Res,
        _$DevicesReqCreateDeviceControlImpl>
    implements _$$DevicesReqCreateDeviceControlImplCopyWith<$Res> {
  __$$DevicesReqCreateDeviceControlImplCopyWithImpl(
      _$DevicesReqCreateDeviceControlImpl _value,
      $Res Function(_$DevicesReqCreateDeviceControlImpl) _then)
      : super(_value, _then);

  /// Create a copy of DevicesReqCreateDeviceControl
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_$DevicesReqCreateDeviceControlImpl(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as DevicesCreateDeviceControl,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DevicesReqCreateDeviceControlImpl
    implements _DevicesReqCreateDeviceControl {
  const _$DevicesReqCreateDeviceControlImpl({required this.data});

  factory _$DevicesReqCreateDeviceControlImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DevicesReqCreateDeviceControlImplFromJson(json);

  @override
  final DevicesCreateDeviceControl data;

  @override
  String toString() {
    return 'DevicesReqCreateDeviceControl(data: $data)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DevicesReqCreateDeviceControlImpl &&
            (identical(other.data, data) || other.data == data));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, data);

  /// Create a copy of DevicesReqCreateDeviceControl
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesReqCreateDeviceControlImplCopyWith<
          _$DevicesReqCreateDeviceControlImpl>
      get copyWith => __$$DevicesReqCreateDeviceControlImplCopyWithImpl<
          _$DevicesReqCreateDeviceControlImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesReqCreateDeviceControlImplToJson(
      this,
    );
  }
}

abstract class _DevicesReqCreateDeviceControl
    implements DevicesReqCreateDeviceControl {
  const factory _DevicesReqCreateDeviceControl(
          {required final DevicesCreateDeviceControl data}) =
      _$DevicesReqCreateDeviceControlImpl;

  factory _DevicesReqCreateDeviceControl.fromJson(Map<String, dynamic> json) =
      _$DevicesReqCreateDeviceControlImpl.fromJson;

  @override
  DevicesCreateDeviceControl get data;

  /// Create a copy of DevicesReqCreateDeviceControl
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesReqCreateDeviceControlImplCopyWith<
          _$DevicesReqCreateDeviceControlImpl>
      get copyWith => throw _privateConstructorUsedError;
}
