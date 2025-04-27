// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'config_module_req_update_plugin.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

ConfigModuleReqUpdatePlugin _$ConfigModuleReqUpdatePluginFromJson(
    Map<String, dynamic> json) {
  return _ConfigModuleReqUpdatePlugin.fromJson(json);
}

/// @nodoc
mixin _$ConfigModuleReqUpdatePlugin {
  ConfigModuleUpdatePlugin get data => throw _privateConstructorUsedError;

  /// Serializes this ConfigModuleReqUpdatePlugin to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ConfigModuleReqUpdatePlugin
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ConfigModuleReqUpdatePluginCopyWith<ConfigModuleReqUpdatePlugin>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ConfigModuleReqUpdatePluginCopyWith<$Res> {
  factory $ConfigModuleReqUpdatePluginCopyWith(
          ConfigModuleReqUpdatePlugin value,
          $Res Function(ConfigModuleReqUpdatePlugin) then) =
      _$ConfigModuleReqUpdatePluginCopyWithImpl<$Res,
          ConfigModuleReqUpdatePlugin>;
  @useResult
  $Res call({ConfigModuleUpdatePlugin data});

  $ConfigModuleUpdatePluginCopyWith<$Res> get data;
}

/// @nodoc
class _$ConfigModuleReqUpdatePluginCopyWithImpl<$Res,
        $Val extends ConfigModuleReqUpdatePlugin>
    implements $ConfigModuleReqUpdatePluginCopyWith<$Res> {
  _$ConfigModuleReqUpdatePluginCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ConfigModuleReqUpdatePlugin
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
              as ConfigModuleUpdatePlugin,
    ) as $Val);
  }

  /// Create a copy of ConfigModuleReqUpdatePlugin
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $ConfigModuleUpdatePluginCopyWith<$Res> get data {
    return $ConfigModuleUpdatePluginCopyWith<$Res>(_value.data, (value) {
      return _then(_value.copyWith(data: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$ConfigModuleReqUpdatePluginImplCopyWith<$Res>
    implements $ConfigModuleReqUpdatePluginCopyWith<$Res> {
  factory _$$ConfigModuleReqUpdatePluginImplCopyWith(
          _$ConfigModuleReqUpdatePluginImpl value,
          $Res Function(_$ConfigModuleReqUpdatePluginImpl) then) =
      __$$ConfigModuleReqUpdatePluginImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({ConfigModuleUpdatePlugin data});

  @override
  $ConfigModuleUpdatePluginCopyWith<$Res> get data;
}

/// @nodoc
class __$$ConfigModuleReqUpdatePluginImplCopyWithImpl<$Res>
    extends _$ConfigModuleReqUpdatePluginCopyWithImpl<$Res,
        _$ConfigModuleReqUpdatePluginImpl>
    implements _$$ConfigModuleReqUpdatePluginImplCopyWith<$Res> {
  __$$ConfigModuleReqUpdatePluginImplCopyWithImpl(
      _$ConfigModuleReqUpdatePluginImpl _value,
      $Res Function(_$ConfigModuleReqUpdatePluginImpl) _then)
      : super(_value, _then);

  /// Create a copy of ConfigModuleReqUpdatePlugin
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_$ConfigModuleReqUpdatePluginImpl(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as ConfigModuleUpdatePlugin,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$ConfigModuleReqUpdatePluginImpl
    implements _ConfigModuleReqUpdatePlugin {
  const _$ConfigModuleReqUpdatePluginImpl({required this.data});

  factory _$ConfigModuleReqUpdatePluginImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$ConfigModuleReqUpdatePluginImplFromJson(json);

  @override
  final ConfigModuleUpdatePlugin data;

  @override
  String toString() {
    return 'ConfigModuleReqUpdatePlugin(data: $data)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ConfigModuleReqUpdatePluginImpl &&
            (identical(other.data, data) || other.data == data));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, data);

  /// Create a copy of ConfigModuleReqUpdatePlugin
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ConfigModuleReqUpdatePluginImplCopyWith<_$ConfigModuleReqUpdatePluginImpl>
      get copyWith => __$$ConfigModuleReqUpdatePluginImplCopyWithImpl<
          _$ConfigModuleReqUpdatePluginImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$ConfigModuleReqUpdatePluginImplToJson(
      this,
    );
  }
}

abstract class _ConfigModuleReqUpdatePlugin
    implements ConfigModuleReqUpdatePlugin {
  const factory _ConfigModuleReqUpdatePlugin(
          {required final ConfigModuleUpdatePlugin data}) =
      _$ConfigModuleReqUpdatePluginImpl;

  factory _ConfigModuleReqUpdatePlugin.fromJson(Map<String, dynamic> json) =
      _$ConfigModuleReqUpdatePluginImpl.fromJson;

  @override
  ConfigModuleUpdatePlugin get data;

  /// Create a copy of ConfigModuleReqUpdatePlugin
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ConfigModuleReqUpdatePluginImplCopyWith<_$ConfigModuleReqUpdatePluginImpl>
      get copyWith => throw _privateConstructorUsedError;
}
