// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_module_req_create_device_control.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesModuleReqCreateDeviceControl
    _$DevicesModuleReqCreateDeviceControlFromJson(Map<String, dynamic> json) {
  return _DevicesModuleReqCreateDeviceControl.fromJson(json);
}

/// @nodoc
mixin _$DevicesModuleReqCreateDeviceControl {
  DevicesModuleCreateDeviceControl get data =>
      throw _privateConstructorUsedError;

  /// Serializes this DevicesModuleReqCreateDeviceControl to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesModuleReqCreateDeviceControl
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesModuleReqCreateDeviceControlCopyWith<
          DevicesModuleReqCreateDeviceControl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesModuleReqCreateDeviceControlCopyWith<$Res> {
  factory $DevicesModuleReqCreateDeviceControlCopyWith(
          DevicesModuleReqCreateDeviceControl value,
          $Res Function(DevicesModuleReqCreateDeviceControl) then) =
      _$DevicesModuleReqCreateDeviceControlCopyWithImpl<$Res,
          DevicesModuleReqCreateDeviceControl>;
  @useResult
  $Res call({DevicesModuleCreateDeviceControl data});

  $DevicesModuleCreateDeviceControlCopyWith<$Res> get data;
}

/// @nodoc
class _$DevicesModuleReqCreateDeviceControlCopyWithImpl<$Res,
        $Val extends DevicesModuleReqCreateDeviceControl>
    implements $DevicesModuleReqCreateDeviceControlCopyWith<$Res> {
  _$DevicesModuleReqCreateDeviceControlCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesModuleReqCreateDeviceControl
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
              as DevicesModuleCreateDeviceControl,
    ) as $Val);
  }

  /// Create a copy of DevicesModuleReqCreateDeviceControl
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $DevicesModuleCreateDeviceControlCopyWith<$Res> get data {
    return $DevicesModuleCreateDeviceControlCopyWith<$Res>(_value.data,
        (value) {
      return _then(_value.copyWith(data: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$DevicesModuleReqCreateDeviceControlImplCopyWith<$Res>
    implements $DevicesModuleReqCreateDeviceControlCopyWith<$Res> {
  factory _$$DevicesModuleReqCreateDeviceControlImplCopyWith(
          _$DevicesModuleReqCreateDeviceControlImpl value,
          $Res Function(_$DevicesModuleReqCreateDeviceControlImpl) then) =
      __$$DevicesModuleReqCreateDeviceControlImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({DevicesModuleCreateDeviceControl data});

  @override
  $DevicesModuleCreateDeviceControlCopyWith<$Res> get data;
}

/// @nodoc
class __$$DevicesModuleReqCreateDeviceControlImplCopyWithImpl<$Res>
    extends _$DevicesModuleReqCreateDeviceControlCopyWithImpl<$Res,
        _$DevicesModuleReqCreateDeviceControlImpl>
    implements _$$DevicesModuleReqCreateDeviceControlImplCopyWith<$Res> {
  __$$DevicesModuleReqCreateDeviceControlImplCopyWithImpl(
      _$DevicesModuleReqCreateDeviceControlImpl _value,
      $Res Function(_$DevicesModuleReqCreateDeviceControlImpl) _then)
      : super(_value, _then);

  /// Create a copy of DevicesModuleReqCreateDeviceControl
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_$DevicesModuleReqCreateDeviceControlImpl(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as DevicesModuleCreateDeviceControl,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DevicesModuleReqCreateDeviceControlImpl
    implements _DevicesModuleReqCreateDeviceControl {
  const _$DevicesModuleReqCreateDeviceControlImpl({required this.data});

  factory _$DevicesModuleReqCreateDeviceControlImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DevicesModuleReqCreateDeviceControlImplFromJson(json);

  @override
  final DevicesModuleCreateDeviceControl data;

  @override
  String toString() {
    return 'DevicesModuleReqCreateDeviceControl(data: $data)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DevicesModuleReqCreateDeviceControlImpl &&
            (identical(other.data, data) || other.data == data));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, data);

  /// Create a copy of DevicesModuleReqCreateDeviceControl
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesModuleReqCreateDeviceControlImplCopyWith<
          _$DevicesModuleReqCreateDeviceControlImpl>
      get copyWith => __$$DevicesModuleReqCreateDeviceControlImplCopyWithImpl<
          _$DevicesModuleReqCreateDeviceControlImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesModuleReqCreateDeviceControlImplToJson(
      this,
    );
  }
}

abstract class _DevicesModuleReqCreateDeviceControl
    implements DevicesModuleReqCreateDeviceControl {
  const factory _DevicesModuleReqCreateDeviceControl(
          {required final DevicesModuleCreateDeviceControl data}) =
      _$DevicesModuleReqCreateDeviceControlImpl;

  factory _DevicesModuleReqCreateDeviceControl.fromJson(
          Map<String, dynamic> json) =
      _$DevicesModuleReqCreateDeviceControlImpl.fromJson;

  @override
  DevicesModuleCreateDeviceControl get data;

  /// Create a copy of DevicesModuleReqCreateDeviceControl
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesModuleReqCreateDeviceControlImplCopyWith<
          _$DevicesModuleReqCreateDeviceControlImpl>
      get copyWith => throw _privateConstructorUsedError;
}
