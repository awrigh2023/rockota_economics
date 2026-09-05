# Rockwell chat — robustness & level-up backlog

Tracking improvements to the Rockwell BYOM chat (`src/components/rockwell/RockwellDock.tsx`,
`src/lib/localModel.ts`). Newest work at the top.

## Done (2026-09-05)

- **Auto-reconnect.** While the dock is open but the model is unreachable, re-probe
  with backoff (3s → 15s) and re-check on window focus. Clears the "started Ollama
  or the bridge after the page loaded" dead state. (`RockwellDock` effect.)
- **Actionable errors.** Failures now map to specific, source-aware messages
  (`rockwellError`): server unreachable (local vs bridge, with the fix), bridge not
  authorized (`claude login`), model-not-found (404), and 5xx mid-generation.
- **Stall watchdog + Retry.** A 45s no-token timer aborts a hung stream and shows a
  "went quiet" message; failed turns surface a **Retry last message** button above
  the input that re-sends the last user text.
- **History trimming.** Conversation history is capped to a ~24k-char budget (most
  recent turns kept) before each request, so long chats don't overflow small local
  models' context windows.

## Planned — level-up (not yet built)

- **Message affordances:** Regenerate last response, edit-and-resend a prior user
  message, and copy buttons on assistant messages / code blocks.
- **Slash commands:** `/task`, `/search`, `/note`, `/clear` in the input.
- **Keyboard:** Esc-to-stop, ↑ to edit the last message (Cmd/Ctrl+K already toggles).
- **Tool transparency (Claude path):** the local path shows "Searching your vault…",
  but the Claude bridge's actual tool calls are opaque. Surface "ran N vault searches"
  / which notes were read, to build trust and aid debugging.
- **Grounding feedback:** when vault search fails, note "answered without vault
  context" instead of failing silently.
- **Detect reason surfaced in the status pill:** distinguish "server down" vs
  "running but no models" in the connection indicator, not just on send.
- **Resume-after-reload:** a turn interrupted by a page reload leaves a blank
  assistant bubble; mark it incomplete and offer Retry.
- **Per-chat persona / custom instructions:** let the user tweak the system persona
  or add standing instructions per conversation.

## Notes

- BYOM design: browser talks directly to the user's OpenAI-compatible endpoint
  (Ollama `:11434` or the Rockwell bridge `:4025`); the cloud backend can't reach
  the user's machine. Grounding is retrieval-injection for local models and real
  read-only tools (via the bridge's MCP server) for the Claude path.
