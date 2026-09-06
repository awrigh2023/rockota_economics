# Mobile Rockwell — design note

Captured 2026-09-05. A plan for getting Rockwell (and the parts of Rockota that
matter on the go) onto a phone, with the model cost kept near zero. Not built yet
— this is the starting point for the build session.

## What the mobile version is for

Primary use, in priority order:
1. **Keep track of what I've been working on** — see tasks, complete tasks, add
   notes to the vault.
2. **Ask questions answered with my vault as context** (RAG).
3. **Daily briefing** — "tell me about my day."
4. **Voice** (talk to it, it talks back) — a later phase, not day one.

## The key constraint

Claude is **text-only**, and today's Rockwell is **BYOM over localhost** — the
browser talks to a model on the same machine (Ollama `:11434`, or the
`rockwell-bridge` wrapping the Claude subscription at `:4025`). A phone has no
localhost model and can't run the Claude Code CLI, so the desktop model path does
not exist on mobile. The model has to live somewhere the phone can reach.

## Architecture shift: model + vault grounding move server-side

On desktop the browser does the vault search and calls the model directly. For
mobile, add one backend endpoint (e.g. `POST /rockwell/chat`) that:

1. takes the user's text,
2. runs the vault search server-side (RAG) — the backend already has vault access,
3. builds the prompt with persona + today's tasks/context, using **prompt
   caching** on the stable parts,
4. streams the model reply back.

The mobile app is then a thin client: capture input, stream text, read/complete
tasks and add notes over the existing authenticated API. Desktop keeps its
local/bridge path unchanged; mobile uses the backend proxy.

Most of use case #1 ("keep track") is **pure data ops** through the existing vault
+ task API — no model tokens, effectively free. Only summarizing/answering spends
tokens.

## The model behind mobile Rockwell — cost-minimizing strategy

Order of preference so the API is barely touched:

1. **Home bridge stays primary.** Expose `rockwell-bridge` to the phone over a
   private tunnel — **Tailscale** preferred (private mesh, nothing public; never
   open a raw port). When the home machine is on and reachable, chat runs on the
   Claude **subscription** = $0. API is only the fallback.
2. **API fallback, cheapest model that fits the job.** When away and the machine
   is off, the backend proxy calls the API. Use **Haiku for routine work**
   (daily briefing, "what did I work on" summaries) and reserve **Sonnet** for
   real conversation.
3. **Prompt caching** on persona + standing context — every turn resends the same
   setup, so caching cuts the repeated input cost.
4. **Concise outputs + lean RAG** — output tokens are the pricey side (5× input on
   Sonnet); only feed the top few vault snippets, not a dump.
5. **History trimming** — already implemented in `RockwellDock` (~24k-char cap);
   apply the same bound server-side.

### Cost estimate (verified 2026-09-05)

- **Sonnet 5:** $2 / million input tokens, $10 / million output.
  (Source: https://platform.claude.com/docs/en/about-claude/pricing)
- A typical grounded turn ≈ 3,000 input + 500 output ≈ **~$0.011** (about a penny).
- At the described usage — a briefing plus ~5–15 questions a day — **~$1–3/month**
  on Sonnet; less with Haiku-for-briefings + caching; **$0 on days the home bridge
  is reachable**.
- Haiku rates: cheaper than Sonnet (exact numbers TBD — pull before finalizing).

## Voice (later phase)

Voice is two layers bolted around the text model: **STT in front, TTS after.**
Flow: speak → STT → text → backend (vault RAG + model) → text → TTS → Rockwell
speaks.

- **STT:** phase 1 on-device (iOS Speech / Android SpeechRecognizer) — free, low
  latency. Phase 2 cloud (Deepgram / Whisper) for accuracy + streaming.
- **TTS:** phase 1 native device TTS (free, robotic). Phase 2 a cloud voice
  (ElevenLabs / Cartesia / OpenAI TTS) to give Rockwell a real voice; stream
  sentences as they arrive for a conversational feel; barge-in (interrupt) later.
- **Cost:** small at this scale — STT a fraction of a cent per minute, a spoken
  briefing a few cents of TTS. Exact vendor rates TBD.

## App shape

- **PWA first** (installable web app): reuses the whole existing React app + API;
  fastest way to get tasks/vault/chat on the phone. Weakness: iOS web push is
  limited.
- **React Native (Expo) later** when you want reliable **push notifications**
  (the morning-briefing tap is the strongest reason), native feel, and offline.

## "Tell me about my day"

A server-side routine, not a chat turn: backend pulls today's tasks from
`board.md`, recent vault activity, calendar if integrated, composes context, and
asks the model (Haiku is fine) for a spoken-style briefing. Natural fit for a
**morning push notification** — tap it and Rockwell reads the day. Push is the
main reason this phase wants React Native over a PWA.

## Suggested build sequence

1. **Backend `/rockwell/chat`** — server-side vault RAG + model call, with a
   source toggle (home bridge when reachable → cheap API fallback) and prompt
   caching. Proves the model + vault path end to end.
2. **Mobile text client** (PWA to start) — tasks (view/complete), add-to-vault,
   and text chat against that endpoint.
3. **Daily briefing** — the server-side routine; surface it in the app.
4. **Voice** — on-device STT/TTS first, cloud + streaming + barge-in later.
5. **React Native + push** — when the morning-briefing notification and native
   feel are worth it.

Steps 1–3 mostly reuse existing vault + task plumbing; the genuinely new
engineering is the backend chat endpoint and (later) the voice layer.
