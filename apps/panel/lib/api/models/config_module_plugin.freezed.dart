// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'config_module_plugin.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

ConfigModulePlugin _$ConfigModulePluginFromJson(Map<String, dynamic> json) {
  return _ConfigModulePlugin.fromJson(json);
}

/// @nodoc
mixin _$ConfigModulePlugin {
  /// Configuration plugin type
  String get type => throw _privateConstructorUsedError;

  /// Serializes this ConfigModulePlugin to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ConfigModulePlugin
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ConfigModulePluginCopyWith<ConfigModulePlugin> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ConfigModulePluginCopyWith<$Res> {
  factory $ConfigModulePluginCopyWith(
          ConfigModulePlugin value, $Res Function(ConfigModulePlugin) then) =
      _$ConfigModulePluginCopyWithImpl<$Res, ConfigModulePlugin>;
  @useResult
  $Res call({String type});
}

/// @nodoc
class _$ConfigModulePluginCopyWithImpl<$Res, $Val extends ConfigModulePlugin>
    implements $ConfigModulePluginCopyWith<$Res> {
  _$ConfigModulePluginCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ConfigModulePlugin
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = null,
  }) {
    return _then(_value.copyWith(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$ConfigModulePluginImplCopyWith<$Res>
    implements $ConfigModulePluginCopyWith<$Res> {
  factory _$$ConfigModulePluginImplCopyWith(_$ConfigModulePluginImpl value,
          $Res Function(_$ConfigModulePluginImpl) then) =
      __$$ConfigModulePluginImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String type});
}

/// @nodoc
class __$$ConfigModulePluginImplCopyWithImpl<$Res>
    extends _$ConfigModulePluginCopyWithImpl<$Res, _$ConfigModulePluginImpl>
    implements _$$ConfigModulePluginImplCopyWith<$Res> {
  __$$ConfigModulePluginImplCopyWithImpl(_$ConfigModulePluginImpl _value,
      $Res Function(_$ConfigModulePluginImpl) _then)
      : super(_value, _then);

  /// Create a copy of ConfigModulePlugin
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = null,
  }) {
    return _then(_$ConfigModulePluginImpl(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$ConfigModulePluginImpl implements _ConfigModulePlugin {
  const _$ConfigModulePluginImpl({this.type = 'custom-plugin'});

  factory _$ConfigModulePluginImpl.fromJson(Map<String, dynamic> json) =>
      _$$ConfigModulePluginImplFromJson(json);

  /// Configuration plugin type
  @override
  @JsonKey()
  final String type;

  @override
  String toString() {
    return 'ConfigModulePlugin(type: $type)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ConfigModulePluginImpl &&
            (identical(other.type, type) || other.type == type));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, type);

  /// Create a copy of ConfigModulePlugin
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ConfigModulePluginImplCopyWith<_$ConfigModulePluginImpl> get copyWith =>
      __$$ConfigModulePluginImplCopyWithImpl<_$ConfigModulePluginImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$ConfigModulePluginImplToJson(
      this,
    );
  }
}

abstract class _ConfigModulePlugin implements ConfigModulePlugin {
  const factory _ConfigModulePlugin({final String type}) =
      _$ConfigModulePluginImpl;

  factory _ConfigModulePlugin.fromJson(Map<String, dynamic> json) =
      _$ConfigModulePluginImpl.fromJson;

  /// Configuration plugin type
  @override
  String get type;

  /// Create a copy of ConfigModulePlugin
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ConfigModulePluginImplCopyWith<_$ConfigModulePluginImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
