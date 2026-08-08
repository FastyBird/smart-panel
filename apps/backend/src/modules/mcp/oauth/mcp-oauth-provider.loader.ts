import type * as OidcProvider from 'oidc-provider';

type OidcProviderModule = typeof OidcProvider;

type NativeImport = (specifier: string) => Promise<OidcProviderModule>;

// TypeScript rewrites import() to require() when compiling this CommonJS backend. Constructing the import expression
// at runtime keeps Node's native ESM loader intact for the ESM-only oidc-provider package.
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const nativeImport = new Function('specifier', 'return import(specifier);') as NativeImport;

export const loadMcpOAuthProvider = async (): Promise<OidcProviderModule> => nativeImport('oidc-provider');
