# ACP spike

Recorded against `grok agent --no-leader stdio` (not `--always-approve`) on 2026-09-21. Transcripts live in the implementer scratch dir (`probe-report.json`, `probe2-transcript.jsonl`, `probe3-transcript.jsonl`, `probe5.json`, `probe6.json`).

## Initialize

`initialize` returns `protocolVersion`, `agentCapabilities`, `authMethods`, `_meta`.

Advertised agent capabilities:

- `loadSession: true`
- `promptCapabilities`: image `false`, audio `false`, embeddedContext `true`
- `sessionCapabilities`: `list`, `resume`, `close`
- `_meta`: `x.ai/fs_notify`, `x.ai/hooks` (`pre_tool_use`, `stop`, `subagent_stop`), `x.ai/capabilities.toolOverrides`

`_meta` also names client features the binary implements (`cancelRewind`, `sessionRecap`, `availableCommands`). It does not list extension RPC names. Those respond only when called with a `_x.ai/` prefix.

## Session

`session/new` returns `sessionId`, `models`, `configOptions`, `_meta`.

Config options the agent exposes: `model` (select, current `grok-4.7`) and `reasoning_effort` (`low` / `medium` / `high` / `xhigh`). `session/set_config_option` with `{ sessionId, configId, value }` returns the updated `configOptions` list. Verified: `reasoning_effort` moved from `high` to `medium`.

Permission mode is not a config option. `session/set_mode` with `{ sessionId, modeId }` accepts `plan`, `auto`, `default`, and `always_approve` and returns `{}`. `_meta.yoloMode: false` on `session/new` is reflected as `yolo: false` on `_x.ai/sessions/changed`.

## Methods the chat uses

| Call | Result |
| --- | --- |
| `session/prompt` | streams updates, resolves `{ stopReason }` |
| `session/set_config_option` | updated option list |
| `session/set_mode` | `{}` for `plan`, `auto`, `default`, `always_approve` |
| `session/list` | `{ sessions }` |
| `session/load` | resume |
| `_x.ai/prompt_history` | `{ sessionId, cwd }` → `{ prompts: string[] }` |
| `_x.ai/rewind/points` | `{ rewind_points: [{ prompt_index, prompt_preview, has_file_changes }] }` |
| `_x.ai/rewind/execute` | `{ sessionId, targetPromptIndex, mode }` with `mode` one of `all`, `conversation_only`, `code_only`, `files_only`. On this build a conversation-only rewind of a stdio session returns `{ success: false, error: null }` and leaves `prompt_history` unchanged. The chat still truncates its own transcript and does not restore files. |
| `_x.ai/compact_conversation` | accepted (long-running) |
| `_x.ai/session/fork` | requires `sourceSessionId` and `sourceCwd` |
| `_x.ai/subagent/cancel` | `{ sessionId, subagentId }` → `{ result }` |
| `_x.ai/session/usage` | `{ usage: { totalTokens, numTurns, ... } }` |
| `session/cancel`, `x.ai/session/cancel`, `_x.ai/session/cancel` | `Method not found`, including during a running turn. Idle and in-flight both returned `-32601`. |
| `_x.ai/toggle_plan_mode` | `unknown ACP extension method` |

`initialize._meta.cancelRewind` is `true`, but this binary has no `session/cancel` RPC. The chat still emits `session/cancel` (verification requires the call) and treats method-not-found as a visible skip.

## Permission payload

With `yolo: false`, a bash tool does not emit `session/request_permission`. The agent notifies `_x.ai/session_notification` `{ sessionUpdate: "pending_interaction", kind: "permission", tool_call_id }` and then sends a client request the process must answer:

```json
{"jsonrpc":"2.0","id":0,"method":"terminal/create","params":{"sessionId":"…","command":"/bin/bash -lc 'echo cockpit-perm'"}}
```

The chat holds that request until the user accepts or declines. Accept replies `{ terminalId }`. Decline replies an error so the tool does not run. File tools use the same blocking pattern on `fs/write_text_file` / `fs/read_text_file`.

## Plan payload

`enter_plan_mode` arrives as `session/update` `tool_call`:

```json
{"sessionUpdate":"tool_call","toolCallId":"call-…-2","title":"enter_plan_mode","rawInput":{},"_meta":{"x.ai/tool":{"name":"enter_plan_mode","kind":"enter_plan"}}}
```

Followed by `tool_call_update` title `Plan: Enter`, `rawInput.variant` `EnterPlanMode`, and `pending_interaction` kind `permission`. The saved plan is `~/.grok/sessions/<encoded-cwd>/<session-id>/plan.md`. Empty or missing file is the empty-plan state. Approve / request-changes / comment / quit are plan decisions on that surface, not a follow-up prompt.

## Question payload

`ask_user_question` is a client request, not a tool result:

```json
{"jsonrpc":"2.0","id":1,"method":"_x.ai/ask_user_question","params":{"sessionId":"…","toolCallId":"call-…-0","questions":[{"question":"Pick a color","options":[{"label":"red","description":"Red"},{"label":"blue","description":"Blue"}],"multiSelect":null}],"mode":"default"}}
```

The turn stays blocked until the client replies `{ outcome: "accepted", answers: { "<question>": ["<label>"] } }`. The agent then reports that answer.

## Subagent payload

```json
{"sessionUpdate":"tool_call","toolCallId":"call-…-1","title":"spawn_subagent","rawInput":{"description":"echo hi","prompt":"reply hi"},"_meta":{"subagentBackground":true,"x.ai/tool":{"name":"spawn_subagent","kind":"task"}}}
```

Then `_x.ai/session_notification` `subagent_spawned` with `subagent_id` / `child_session_id`, and `subagent_finished` with `status` and `output`. Stop calls `_x.ai/subagent/cancel` with that id.

## Commands

`available_commands_update` advertises agent builtins including `compact`, `always-approve`, `context`, `session-info`, `feedback`. Pager builtins (`model`, `effort`, `plan`, `view-plan`, `rewind`, `copy`, `export`, `rename`, `fork`, `history`, `btw`, `usage`, `new`/`clear`) are client commands. The menu merges both and runs the client command locally or sends `/name` when the agent advertised it.
