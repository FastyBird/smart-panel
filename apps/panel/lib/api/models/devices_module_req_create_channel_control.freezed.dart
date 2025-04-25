// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_module_req_create_channel_control.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesModuleReqCreateChannelControl
    _$DevicesModuleReqCreateChannelControlFromJson(Map<String, dynamic> json) {
  return _DevicesModuleReqCreateChannelControl.fromJson(json);
}

/// @nodoc
mixin _$DevicesModuleReqCreateChannelControl {
  DevicesModuleCreateChannelControl get data =>
      throw _privateConstructorUsedError;

  /// Serializes this DevicesModuleReqCreateChannelControl to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesModuleReqCreateChannelControl
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesModuleReqCreateChannelControlCopyWith<
          DevicesModuleReqCreateChannelControl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesModuleReqCreateChannelControlCopyWith<$Res> {
  factory $DevicesModuleReqCreateChannelControlCopyWith(
          DevicesModuleReqCreateChannelControl value,
          $Res Function(DevicesModuleReqCreateChannelControl) then) =
      _$DevicesModuleReqCreateChannelControlCopyWithImpl<$Res,
          DevicesModuleReqCreateChannelControl>;
  @useResult
  $Res call({DevicesModuleCreateChannelControl data});

  $DevicesModuleCreateChannelControlCopyWith<$Res> get data;
}

/// @nodoc
class _$DevicesModuleReqCreateChannelControlCopyWithImpl<$Res,
        $Val extends DevicesModuleReqCreateChannelControl>
    implements $DevicesModuleReqCreateChannelControlCopyWith<$Res> {
  _$DevicesModuleReqCreateChannelControlCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesModuleReqCreateChannelControl
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
              as DevicesModuleCreateChannelControl,
    ) as $Val);
  }

  /// Create a copy of DevicesModuleReqCreateChannelControl
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $DevicesModuleCreateChannelControlCopyWith<$Res> get data {
    return $DevicesModuleCreateChannelControlCopyWith<$Res>(_value.data,
        (value) {
      return _then(_value.copyWith(data: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$DevicesModuleReqCreateChannelControlImplCopyWith<$Res>
    implements $DevicesModuleReqCreateChannelControlCopyWith<$Res> {
  factory _$$DevicesModuleReqCreateChannelControlImplCopyWith(
          _$DevicesModuleReqCreateChannelControlImpl value,
          $Res Function(_$DevicesModuleReqCreateChannelControlImpl) then) =
      __$$DevicesModuleReqCreateChannelControlImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({DevicesModuleCreateChannelControl data});

  @override
  $DevicesModuleCreateChannelControlCopyWith<$Res> get data;
}

/// @nodoc
class __$$DevicesModuleReqCreateChannelControlImplCopyWithImpl<$Res>
    extends _$DevicesModuleReqCreateChannelControlCopyWithImpl<$Res,
        _$DevicesModuleReqCreateChannelControlImpl>
    implements _$$DevicesModuleReqCreateChannelControlImplCopyWith<$Res> {
  __$$DevicesModuleReqCreateChannelControlImplCopyWithImpl(
      _$DevicesModuleReqCreateChannelControlImpl _value,
      $Res Function(_$DevicesModuleReqCreateChannelControlImpl) _then)
      : super(_value, _then);

  /// Create a copy of DevicesModuleReqCreateChannelControl
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_$DevicesModuleReqCreateChannelControlImpl(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as DevicesModuleCreateChannelControl,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DevicesModuleReqCreateChannelControlImpl
    implements _DevicesModuleReqCreateChannelControl {
  const _$DevicesModuleReqCreateChannelControlImpl({required this.data});

  factory _$DevicesModuleReqCreateChannelControlImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DevicesModuleReqCreateChannelControlImplFromJson(json);

  @override
  final DevicesModuleCreateChannelControl data;

  @override
  String toString() {
    return 'DevicesModuleReqCreateChannelControl(data: $data)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DevicesModuleReqCreateChannelControlImpl &&
            (identical(other.data, data) || other.data == data));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, data);

  /// Create a copy of DevicesModuleReqCreateChannelControl
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesModuleReqCreateChannelControlImplCopyWith<
          _$DevicesModuleReqCreateChannelControlImpl>
      get copyWith => __$$DevicesModuleReqCreateChannelControlImplCopyWithImpl<
          _$DevicesModuleReqCreateChannelControlImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesModuleReqCreateChannelControlImplToJson(
      this,
    );
  }
}

abstract class _DevicesModuleReqCreateChannelControl
    implements DevicesModuleReqCreateChannelControl {
  const factory _DevicesModuleReqCreateChannelControl(
          {required final DevicesModuleCreateChannelControl data}) =
      _$DevicesModuleReqCreateChannelControlImpl;

  factory _DevicesModuleReqCreateChannelControl.fromJson(
          Map<String, dynamic> json) =
      _$DevicesModuleReqCreateChannelControlImpl.fromJson;

  @override
  DevicesModuleCreateChannelControl get data;

  /// Create a copy of DevicesModuleReqCreateChannelControl
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesModuleReqCreateChannelControlImplCopyWith<
          _$DevicesModuleReqCreateChannelControlImpl>
      get copyWith => throw _privateConstructorUsedError;
}
