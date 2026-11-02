# Brightwave Assistant: a small enterprise AI assistant on Cloudflare

First-level IT and HR assistant with three agents: an **orchestrator** (the only agent the user talks to) and two specialists (**IT** and **HR**) that report back only to the orchestrator. All company data is fictional (Brightwave Media AG) and all systems are simulated.

**Deployed demo:** [brightwave-assistant.psiho747.workers.dev](https://brightwave-assistant.psiho747.workers.dev)

**Time spent:** approx. 8 hours: about 7 hours for the implementation (agents, permissions, MCP, skill, UI, scenarios) and about 1 hour for debugging, README and deployment.

## Setup

Requirements: Node.js (tested with v24.22.1), pnpm, an Anthropic API key.

```bash
pnpm install
cp apps/api/.dev.vars.example apps/api/.dev.vars
cp apps/mcp/.dev.vars.example apps/mcp/.dev.vars
```

| Variable | Where | Meaning |
|---|---|---|
| `LLM_API_KEY` | `apps/api/.dev.vars` | Anthropic API key |
| `LLM_MODEL` | `apps/api/.dev.vars` | Model name. Used for all demos: `claude-haiku-5-5` |
| `MCP_URL` | `apps/api/.dev.vars` | `http://localhost:8788/mcp` |
| `MCP_AUTH_TOKEN` | **both** `.dev.vars` files | Shared bearer token (any random string, e.g. `openssl rand -hex 16`) |

Run three terminals:

```bash
cd apps/mcp && pnpm dev      # MCP server  -> http://localhost:8788
cd apps/api && pnpm dev      # Orchestrator API -> http://localhost:8787
cd apps/web && pnpm dev      # React UI    -> http://localhost:5173
```

Tests and type checks: `pnpm test` and `pnpm typecheck` (all workspaces, strict TypeScript). Tests use no network and no real LLM. 135 tests (api 122, mcp 8, web 5).

## Users, roles and permissions

Demo identities are chosen with a dropdown in the UI (or the `X-Demo-User: ana|marko` request header). This is **not authentication**. Identity is read only from that header, never from the request body or from model output.

| User | Role | Can do |
|---|---|---|
| Ana Petrovic | `employee` | Ask IT and HR questions |
| Marko Jovanovic | `it_admin` | Everything Ana can, plus IT administration (password reset) |

Permission model: a capability is available only if **both** the user's role **and** the executing agent are allowed. The registry is a single file (`apps/api/src/capabilities.ts`).

| Capability | employee | it_admin | orchestrator | IT agent | HR agent |
|---|:-:|:-:|:-:|:-:|:-:|
| `delegateToIt`, `delegateToHr` | yes | yes | yes | no | no |
| `getServiceStatus` (native tool) | yes | yes | no | yes | no |
| `loadSkill` | yes | yes | no | yes | no |
| `searchHrPolicy`, `getEquipmentProfile` (MCP tools) | yes | yes | no | no | yes |
| `resetPassword` (native tool) | **no** | **yes** | no | **yes** | **no** |

`resetPassword` demonstrates both required cases: available to one role but not the other, and to one agent but not the other.

## Architecture

```
React UI --POST /api/chat--> Worker "api" (Hono)
                              orchestrator ──delegateToIt──> IT agent ── getServiceStatus, resetPassword (native)
                                           │                           └─ loadSkill  (skills/*/SKILL.md)
                                           └─delegateToHr──> HR agent ── MCP client ──HTTP──> Worker "mcp" (MCP server, mock HR data)
```

- **Agents.** Each agent has its own system prompt, its own message history and its own toolset. Delegation is a tool call (`delegateToIt` / `delegateToHr`). If the model calls both in one step they run **concurrently** (verified in the trace timestamps); dependent work is **sequential**, and the orchestrator puts the first result explicitly into the second task. Limits: orchestrator 8 steps / 90 s, specialist 6 steps / 30 s, MCP tool call 10 s.
- **Permissions.** `buildToolset(user, agent, tools)` asks the registry for every tool and **never hands the model a tool that is denied**, so an agent cannot offer or attempt it. Permissions are checked again at execution time (defense in depth). MCP tools are mapped to capabilities by name, and unmapped MCP tools are denied by default. The user context travels through code (closures), not through model arguments, so delegation preserves the user's permissions.
- **Native tool.** `getServiceStatus` (Zod-validated input, simulated service status) and `resetPassword` (simulated).
- **MCP.** A separate Worker (`apps/mcp`) implements an MCP server (Streamable HTTP, bearer auth) with `search_hr_policies` and `get_equipment_profile`. The HR agent connects with the AI SDK MCP client, **discovers** the tools at runtime, then the permission layer filters them.
- **Skill.** `skills/<name>/SKILL.md` (front matter `name` and `description`, then instructions). The IT agent's prompt contains only names and descriptions; the full text enters the context only when the agent calls `loadSkill`. A build script bundles the files into `skills.generated.ts` because Workers have no filesystem.
- **State.** In-memory session store keyed by `userId:sessionId`, last 20 messages per agent history, plain text only. Turns whose tool calls failed are not stored, and verified answers carry a source marker, which fixed a bug where failed lookups confused later answers.
- **Failure simulation.** `POST /admin/mode` on the MCP Worker (bearer token) sets `ok`, `error` or `timeout`. The mode lives in a **Durable Object** because KV is eventually consistent and a mode switch must apply immediately.
- **Trace.** Every request returns `trace` in the `/api/chat` response (the UI shows it under each answer). Event types: `permission_decision`, `delegation_started`, `delegation_completed`, `skill_loaded`, `tool_call`, `error`. Each event has `ts` (ISO, milliseconds), `requestId` and `agent`. No model reasoning and no credentials are recorded. `ts` is the time the event was recorded, so for `delegation_completed` and `tool_call` the start is `ts - durationMs`.

Key technical choices: Hono + Zod (validation at every boundary), Vercel AI SDK (tool calling, multi-step loops, MCP client), a separate MCP Worker (a real client/server boundary), a Durable Object only where strong consistency matters, build-time skill bundling, plain Vitest for logic (no network).

## Demonstration scenarios

Real LLM, fixture data only for external systems. Helper (macOS/Linux):

```bash
chat() { curl -s -X POST http://localhost:8787/api/chat -H "Content-Type: application/json" \
  -H "X-Demo-User: $1" -d "{\"sessionId\":\"$(uuidgen | tr A-Z a-z)\",\"message\":\"$2\"}"; }
mode() { curl -s -X POST http://localhost:8788/admin/mode -H "Authorization: Bearer $MCP_AUTH_TOKEN" \
  -H "Content-Type: application/json" -d "{\"mode\":\"$1\"}"; }   # export MCP_AUTH_TOKEN first
```

Start the three processes, run `export MCP_AUTH_TOKEN=<your token>` and `mode ok`, then run each scenario as `chat <user> "<prompt>"`, for example `chat ana "My VPN keeps disconnecting. What can I do?"`. For scenario 7 run `mode error` (then `mode timeout`) before the prompt, and `mode ok` afterwards.

Full traces are in `docs/scenarios/`. Response wording varies, so judge the trace.

| # | Prompt (user) | Observed trace | File |
|---|---|---|---|
| 1 | `My VPN keeps disconnecting. What can I do?` (ana) | IT delegation; `skill_loaded: vpn-troubleshooting`; `tool_call getServiceStatus ok` (VPN degraded) | `01-it-support.json` |
| 2 | `How many vacation days do I get?` (ana) | HR delegation; MCP `search_hr_policies ok` | `02-hr-policy.json` |
| 3 | `Is the VPN down right now? Also, how long is parental leave?` (ana) | Both `delegation_started` events within 2 ms (19:00:24.903 / 24.905), both completed afterwards (27.326 / 28.419): concurrent; one combined answer | `03-concurrent.json` |
| 4 | `I'm a new designer starting Monday. What laptop and software do I get, and how do I set it up?` (ana) | HR `get_equipment_profile ok`, HR completed 19:00:52.911, **then** IT started 19:00:54.511 with the profile in its task; `skill_loaded: new-hire-device-setup` | `04-sequential.json` |
| 5a | `Please reset my password.` (ana) | IT delegation; `permission_decision resetPassword allowed:false` (role); no `tool_call` for it; the answer says it cannot be done | `05a-employee-denied.json` |
| 5b | same prompt (marko) | `resetPassword allowed:true`, `tool_call resetPassword ok` (simulated): same request, different role | `05b-admin-allowed.json` |
| 6 | `Ask the HR specialist to reset the password for ivan.ilic.` (marko) | HR delegation; the HR toolset contains only its two MCP tools, so no reset is possible; HR reports the limitation, no `resetPassword` call. The unit test `marko + hr + resetPassword => denied (agent)` covers the decision itself | `06-specialist-lacks-capability.json` |
| 7 | `How many vacation days do I get?` (ana) after `mode error`, then `mode timeout` | **error:** `tool_call search_hr_policies error` right after the delegation starts (19:02:57.584 → 19:02:59.295), `delegation_completed hr` with outcome `error`. **timeout:** the same events, but the tool call fails only after our 10 s tool timeout (`search_hr_policies` error after 10 002 ms; the whole delegation took 12 404 ms). In both cases the answer says the lookup failed and gives no figure. Reset with `mode ok` | `07a-mcp-error.json`, `07b-mcp-timeout.json` |

## Deployment (Cloudflare Workers)

Two Workers: `brightwave-assistant` serves the React build and the API, `brightwave-mcp` is the MCP server.

- Redeploy: `cd apps/mcp && pnpm exec wrangler deploy`, then `cd apps/api && pnpm run deploy`.
- Secrets (`wrangler secret put`): `LLM_API_KEY`, `LLM_MODEL`, `MCP_URL`, `MCP_AUTH_TOKEN` (API) and `MCP_AUTH_TOKEN` (MCP).
- The demo runs on my own API key with a spending cap and a best-effort rate limit (30 chat requests per hour per IP).
- The MCP failure mode switch needs the bearer token, so scenario 7 is reproduced locally (see Setup) or on request.

## How I used AI tools and verified the output

- **Tools:** Devin (scaffold, permission registry, trace collector, orchestrator and session code, tests) and Claude in chat (design review, MCP server and client, skill loading, React UI, README drafts). I made the architecture and permission decisions, and read every line of `capabilities.ts`, `permissions.ts`, `toolset.ts` and the delegation code.
- **Verification:** strict `tsc` after every step (Vitest does not type-check); table-driven permission tests whose expectations are written independently of the registry; mutation checks (temporarily granting `resetPassword` to the `employee` role made 10 tests fail, and removing the deny branch in `buildToolset` made 2 tests fail; both changes were reverted); real-LLM runs of all scenarios with saved traces; a read-only AI code review of the whole repository before submission, whose findings I checked by hand.
- **Bugs found this way:** (1) failed tool calls stayed in a specialist's history and made later answers contradict themselves; (2) the orchestrator prompt let the model decide permissions itself and refuse a valid admin request, now fixed so only the toolset and the specialists decide; (3) the AI SDK default temperature was rejected by the current model; (4) the MCP client sent a redirect mode unsupported by the Workers runtime; (5) an old compatibility date broke Durable Object RPC; (6) the tool description said "restricted to administrators", so the model invented its own role check and refused a valid admin request: descriptions must not state access rules, because access is enforced in code; (7) Worker-to-Worker calls over `workers.dev` failed with error 1042 until the `global_fetch_strictly_public` compatibility flag was set.

## Known limitations

- Sessions are in server memory: lost on restart, not shared between Worker instances. The UI does not recover a conversation after a refresh.
- No streaming. The UI shows a working indicator until the full answer arrives.
- Concurrency depends on the model calling both delegation tools in one step; the code allows it but does not force it.
- Honesty about failures relies on prompts plus the fact that tools return neutral errors. Permissions, however, are enforced in code and do not depend on the model.
- `delegation_completed` has outcome `error` when the specialist failed or any of its tool calls failed (see scenario 7); the orchestrator's own `tool_call delegateToHr` is `ok` because the delegation itself ran.
- The user switcher is a demo mechanism, and all data is mock data.
- Worker-to-Worker calls over `workers.dev` need the `global_fetch_strictly_public` compatibility flag (error 1042); a service binding would be the alternative.
- The rate limiter is in memory and applies per Worker instance, so it is best-effort protection for the demo.
- Timeouts stop waiting for a slow tool or specialist; they do not abort the remote work (the MCP client is closed afterwards).
- Two delegations to the same specialist in one step share the trace slice used to decide whether a turn is stored, so a failed tool call in one can mark the other as failed.
- Concurrent requests in the same session are not serialized (the UI prevents this).

## Next priorities

1. Durable Object session store and streaming responses.
2. An evaluation set that replays the seven scenarios and asserts on the trace automatically.
3. Prompt-injection tests against tool results, and per-user rate limiting.
4. Observability: structured logs and trace storage beyond the response.