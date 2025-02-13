// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_req_create_channel_control.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesReqCreateChannelControl _$DevicesReqCreateChannelControlFromJson(
    Map<String, dynamic> json) {
  return _DevicesReqCreateChannelControl.fromJson(json);
}

/// @nodoc
mixin _$DevicesReqCreateChannelControl {
  DevicesCreateChannelControl get data => throw _privateConstructorUsedError;

  /// Serializes this DevicesReqCreateChannelControl to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesReqCreateChannelControl
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesReqCreateChannelControlCopyWith<DevicesReqCreateChannelControl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesReqCreateChannelControlCopyWith<$Res> {
  factory $DevicesReqCreateChannelControlCopyWith(
          DevicesReqCreateChannelControl value,
          $Res Function(DevicesReqCreateChannelControl) then) =
      _$DevicesReqCreateChannelControlCopyWithImpl<$Res,
          DevicesReqCreateChannelControl>;
  @useResult
  $Res call({DevicesCreateChannelControl data});

  $DevicesCreateChannelControlCopyWith<$Res> get data;
}

/// @nodoc
class _$DevicesReqCreateChannelControlCopyWithImpl<$Res,
        $Val extends DevicesReqCreateChannelControl>
    implements $DevicesReqCreateChannelControlCopyWith<$Res> {
  _$DevicesReqCreateChannelControlCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesReqCreateChannelControl
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
              as DevicesCreateChannelControl,
    ) as $Val);
  }

  /// Create a copy of DevicesReqCreateChannelControl
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $DevicesCreateChannelControlCopyWith<$Res> get data {
    return $DevicesCreateChannelControlCopyWith<$Res>(_value.data, (value) {
      return _then(_value.copyWith(data: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$DevicesReqCreateChannelControlImplCopyWith<$Res>
    implements $DevicesReqCreateChannelControlCopyWith<$Res> {
  factory _$$DevicesReqCreateChannelControlImplCopyWith(
          _$DevicesReqCreateChannelControlImpl value,
          $Res Function(_$DevicesReqCreateChannelControlImpl) then) =
      __$$DevicesReqCreateChannelControlImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({DevicesCreateChannelControl data});

  @override
  $DevicesCreateChannelControlCopyWith<$Res> get data;
}

/// @nodoc
class __$$DevicesReqCreateChannelControlImplCopyWithImpl<$Res>
    extends _$DevicesReqCreateChannelControlCopyWithImpl<$Res,
        _$DevicesReqCreateChannelControlImpl>
    implements _$$DevicesReqCreateChannelControlImplCopyWith<$Res> {
  __$$DevicesReqCreateChannelControlImplCopyWithImpl(
      _$DevicesReqCreateChannelControlImpl _value,
      $Res Function(_$DevicesReqCreateChannelControlImpl) _then)
      : super(_value, _then);

  /// Create a copy of DevicesReqCreateChannelControl
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_$DevicesReqCreateChannelControlImpl(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as DevicesCreateChannelControl,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DevicesReqCreateChannelControlImpl
    implements _DevicesReqCreateChannelControl {
  const _$DevicesReqCreateChannelControlImpl({required this.data});

  factory _$DevicesReqCreateChannelControlImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DevicesReqCreateChannelControlImplFromJson(json);

  @override
  final DevicesCreateChannelControl data;

  @override
  String toString() {
    return 'DevicesReqCreateChannelControl(data: $data)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DevicesReqCreateChannelControlImpl &&
            (identical(other.data, data) || other.data == data));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, data);

  /// Create a copy of DevicesReqCreateChannelControl
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesReqCreateChannelControlImplCopyWith<
          _$DevicesReqCreateChannelControlImpl>
      get copyWith => __$$DevicesReqCreateChannelControlImplCopyWithImpl<
          _$DevicesReqCreateChannelControlImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesReqCreateChannelControlImplToJson(
      this,
    );
  }
}

abstract class _DevicesReqCreateChannelControl
    implements DevicesReqCreateChannelControl {
  const factory _DevicesReqCreateChannelControl(
          {required final DevicesCreateChannelControl data}) =
      _$DevicesReqCreateChannelControlImpl;

  factory _DevicesReqCreateChannelControl.fromJson(Map<String, dynamic> json) =
      _$DevicesReqCreateChannelControlImpl.fromJson;

  @override
  DevicesCreateChannelControl get data;

  /// Create a copy of DevicesReqCreateChannelControl
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesReqCreateChannelControlImplCopyWith<
          _$DevicesReqCreateChannelControlImpl>
      get copyWith => throw _privateConstructorUsedError;
}
