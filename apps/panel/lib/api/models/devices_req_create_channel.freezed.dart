// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_req_create_channel.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesReqCreateChannel _$DevicesReqCreateChannelFromJson(
    Map<String, dynamic> json) {
  return _DevicesReqCreateChannel.fromJson(json);
}

/// @nodoc
mixin _$DevicesReqCreateChannel {
  DevicesCreateChannel get data => throw _privateConstructorUsedError;

  /// Serializes this DevicesReqCreateChannel to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesReqCreateChannel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesReqCreateChannelCopyWith<DevicesReqCreateChannel> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesReqCreateChannelCopyWith<$Res> {
  factory $DevicesReqCreateChannelCopyWith(DevicesReqCreateChannel value,
          $Res Function(DevicesReqCreateChannel) then) =
      _$DevicesReqCreateChannelCopyWithImpl<$Res, DevicesReqCreateChannel>;
  @useResult
  $Res call({DevicesCreateChannel data});

  $DevicesCreateChannelCopyWith<$Res> get data;
}

/// @nodoc
class _$DevicesReqCreateChannelCopyWithImpl<$Res,
        $Val extends DevicesReqCreateChannel>
    implements $DevicesReqCreateChannelCopyWith<$Res> {
  _$DevicesReqCreateChannelCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesReqCreateChannel
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
              as DevicesCreateChannel,
    ) as $Val);
  }

  /// Create a copy of DevicesReqCreateChannel
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $DevicesCreateChannelCopyWith<$Res> get data {
    return $DevicesCreateChannelCopyWith<$Res>(_value.data, (value) {
      return _then(_value.copyWith(data: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$DevicesReqCreateChannelImplCopyWith<$Res>
    implements $DevicesReqCreateChannelCopyWith<$Res> {
  factory _$$DevicesReqCreateChannelImplCopyWith(
          _$DevicesReqCreateChannelImpl value,
          $Res Function(_$DevicesReqCreateChannelImpl) then) =
      __$$DevicesReqCreateChannelImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({DevicesCreateChannel data});

  @override
  $DevicesCreateChannelCopyWith<$Res> get data;
}

/// @nodoc
class __$$DevicesReqCreateChannelImplCopyWithImpl<$Res>
    extends _$DevicesReqCreateChannelCopyWithImpl<$Res,
        _$DevicesReqCreateChannelImpl>
    implements _$$DevicesReqCreateChannelImplCopyWith<$Res> {
  __$$DevicesReqCreateChannelImplCopyWithImpl(
      _$DevicesReqCreateChannelImpl _value,
      $Res Function(_$DevicesReqCreateChannelImpl) _then)
      : super(_value, _then);

  /// Create a copy of DevicesReqCreateChannel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_$DevicesReqCreateChannelImpl(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as DevicesCreateChannel,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DevicesReqCreateChannelImpl implements _DevicesReqCreateChannel {
  const _$DevicesReqCreateChannelImpl({required this.data});

  factory _$DevicesReqCreateChannelImpl.fromJson(Map<String, dynamic> json) =>
      _$$DevicesReqCreateChannelImplFromJson(json);

  @override
  final DevicesCreateChannel data;

  @override
  String toString() {
    return 'DevicesReqCreateChannel(data: $data)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DevicesReqCreateChannelImpl &&
            (identical(other.data, data) || other.data == data));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, data);

  /// Create a copy of DevicesReqCreateChannel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesReqCreateChannelImplCopyWith<_$DevicesReqCreateChannelImpl>
      get copyWith => __$$DevicesReqCreateChannelImplCopyWithImpl<
          _$DevicesReqCreateChannelImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesReqCreateChannelImplToJson(
      this,
    );
  }
}

abstract class _DevicesReqCreateChannel implements DevicesReqCreateChannel {
  const factory _DevicesReqCreateChannel(
          {required final DevicesCreateChannel data}) =
      _$DevicesReqCreateChannelImpl;

  factory _DevicesReqCreateChannel.fromJson(Map<String, dynamic> json) =
      _$DevicesReqCreateChannelImpl.fromJson;

  @override
  DevicesCreateChannel get data;

  /// Create a copy of DevicesReqCreateChannel
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesReqCreateChannelImplCopyWith<_$DevicesReqCreateChannelImpl>
      get copyWith => throw _privateConstructorUsedError;
}
