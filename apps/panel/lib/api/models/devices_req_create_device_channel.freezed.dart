// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_req_create_device_channel.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesReqCreateDeviceChannel _$DevicesReqCreateDeviceChannelFromJson(
    Map<String, dynamic> json) {
  return _DevicesReqCreateDeviceChannel.fromJson(json);
}

/// @nodoc
mixin _$DevicesReqCreateDeviceChannel {
  DevicesCreateDeviceChannel get data => throw _privateConstructorUsedError;

  /// Serializes this DevicesReqCreateDeviceChannel to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesReqCreateDeviceChannel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesReqCreateDeviceChannelCopyWith<DevicesReqCreateDeviceChannel>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesReqCreateDeviceChannelCopyWith<$Res> {
  factory $DevicesReqCreateDeviceChannelCopyWith(
          DevicesReqCreateDeviceChannel value,
          $Res Function(DevicesReqCreateDeviceChannel) then) =
      _$DevicesReqCreateDeviceChannelCopyWithImpl<$Res,
          DevicesReqCreateDeviceChannel>;
  @useResult
  $Res call({DevicesCreateDeviceChannel data});

  $DevicesCreateDeviceChannelCopyWith<$Res> get data;
}

/// @nodoc
class _$DevicesReqCreateDeviceChannelCopyWithImpl<$Res,
        $Val extends DevicesReqCreateDeviceChannel>
    implements $DevicesReqCreateDeviceChannelCopyWith<$Res> {
  _$DevicesReqCreateDeviceChannelCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesReqCreateDeviceChannel
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
              as DevicesCreateDeviceChannel,
    ) as $Val);
  }

  /// Create a copy of DevicesReqCreateDeviceChannel
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $DevicesCreateDeviceChannelCopyWith<$Res> get data {
    return $DevicesCreateDeviceChannelCopyWith<$Res>(_value.data, (value) {
      return _then(_value.copyWith(data: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$DevicesReqCreateDeviceChannelImplCopyWith<$Res>
    implements $DevicesReqCreateDeviceChannelCopyWith<$Res> {
  factory _$$DevicesReqCreateDeviceChannelImplCopyWith(
          _$DevicesReqCreateDeviceChannelImpl value,
          $Res Function(_$DevicesReqCreateDeviceChannelImpl) then) =
      __$$DevicesReqCreateDeviceChannelImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({DevicesCreateDeviceChannel data});

  @override
  $DevicesCreateDeviceChannelCopyWith<$Res> get data;
}

/// @nodoc
class __$$DevicesReqCreateDeviceChannelImplCopyWithImpl<$Res>
    extends _$DevicesReqCreateDeviceChannelCopyWithImpl<$Res,
        _$DevicesReqCreateDeviceChannelImpl>
    implements _$$DevicesReqCreateDeviceChannelImplCopyWith<$Res> {
  __$$DevicesReqCreateDeviceChannelImplCopyWithImpl(
      _$DevicesReqCreateDeviceChannelImpl _value,
      $Res Function(_$DevicesReqCreateDeviceChannelImpl) _then)
      : super(_value, _then);

  /// Create a copy of DevicesReqCreateDeviceChannel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_$DevicesReqCreateDeviceChannelImpl(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as DevicesCreateDeviceChannel,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DevicesReqCreateDeviceChannelImpl
    implements _DevicesReqCreateDeviceChannel {
  const _$DevicesReqCreateDeviceChannelImpl({required this.data});

  factory _$DevicesReqCreateDeviceChannelImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DevicesReqCreateDeviceChannelImplFromJson(json);

  @override
  final DevicesCreateDeviceChannel data;

  @override
  String toString() {
    return 'DevicesReqCreateDeviceChannel(data: $data)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DevicesReqCreateDeviceChannelImpl &&
            (identical(other.data, data) || other.data == data));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, data);

  /// Create a copy of DevicesReqCreateDeviceChannel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesReqCreateDeviceChannelImplCopyWith<
          _$DevicesReqCreateDeviceChannelImpl>
      get copyWith => __$$DevicesReqCreateDeviceChannelImplCopyWithImpl<
          _$DevicesReqCreateDeviceChannelImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesReqCreateDeviceChannelImplToJson(
      this,
    );
  }
}

abstract class _DevicesReqCreateDeviceChannel
    implements DevicesReqCreateDeviceChannel {
  const factory _DevicesReqCreateDeviceChannel(
          {required final DevicesCreateDeviceChannel data}) =
      _$DevicesReqCreateDeviceChannelImpl;

  factory _DevicesReqCreateDeviceChannel.fromJson(Map<String, dynamic> json) =
      _$DevicesReqCreateDeviceChannelImpl.fromJson;

  @override
  DevicesCreateDeviceChannel get data;

  /// Create a copy of DevicesReqCreateDeviceChannel
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesReqCreateDeviceChannelImplCopyWith<
          _$DevicesReqCreateDeviceChannelImpl>
      get copyWith => throw _privateConstructorUsedError;
}
