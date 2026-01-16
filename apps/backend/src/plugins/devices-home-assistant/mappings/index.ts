// Export mapping types
export * from './mapping.types';

// Export mapping loader service
export { MappingLoaderService } from './mapping-loader.service';

// Export transformer registry
export { TransformerRegistry, BUILTIN_TRANSFORMERS } from './transformers/transformer.registry';

// Export transformer creation functions
export { createTransformer, createInlineTransformer, PassthroughTransformer } from './transformers/transformers';

// Export transformer interfaces (with type prefix to avoid conflicts)
export type {
	ITransformer,
	TransformContext,
	InlineTransform,
	TransformerType,
} from './transformers/transformer.types';
