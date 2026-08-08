# MCP Client Compatibility Verification

This record captures the release-gate checks for the initial static bearer-token MCP transport. It is test evidence,
not end-user setup documentation.

## Verified clients

Verification was performed on 2026-08-08 against the loopback Streamable HTTP fixture in
`apps/backend/test/support/mcp-host-smoke-server.ts`. The fixture requires an `Authorization: Bearer` header, advertises
one tool, and returns `MCP Phase 11 host smoke test` when the tool is called.

| Client                     | Version | Bearer configuration                  | Result                                                    |
| -------------------------- | ------- | ------------------------------------- | --------------------------------------------------------- |
| OpenAI Codex CLI           | 0.136.0 | `--bearer-token-env-var` equivalent   | Connected, discovered the tool, and called it successfully |
| Anthropic Claude Code      | 2.1.225 | HTTP MCP `headers.Authorization`      | Connected, discovered the tool, and called it successfully |
| Official MCP TypeScript SDK | 2.0.0   | Streamable HTTP request headers       | Modern and stateless legacy endpoint E2E suites pass       |

The Codex and Claude Code checks used noninteractive no-approval modes only for the harmless fixture tool. The bearer
value was synthetic and was not an installation credential.

## Repeatable host fixture

Start the fixture from `apps/backend`:

```bash
pnpm exec ts-node test/support/mcp-host-smoke-server.ts
```

The process prints its loopback endpoint and the bearer-token environment-variable name. Use the synthetic
`phase-11-host-smoke-token` value and stop the fixture with `SIGINT` after the host checks.

## Unsupported client profiles

- Hosts that cannot attach a preconfigured bearer token or custom `Authorization` header are unsupported by the
  initial release. Hosts that support only standards-based remote authorization require the planned OAuth 2.1 and MCP
  protected-resource discovery follow-up.
- Stdio-only and legacy HTTP+SSE-only clients are unsupported. OAuth alone does not make those transports compatible;
  the host must support Streamable HTTP.
- Legacy clients that require a persistent server session are unsupported. The initial release supports the bounded
  SDK stateless legacy path; such clients must upgrade or demonstrate a concrete need before a stateful adapter is
  added.
- Public-internet use is not a supported authorization profile for static tokens. The first release is intended for
  trusted LAN or VPN deployments, preferably behind HTTPS.
