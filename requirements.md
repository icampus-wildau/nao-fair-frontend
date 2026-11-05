# NAO Fair frontend requirements

Current UI scope, reconciled with the implementation on 2026-11-05. NAO Fair is
an operator app for one NAO, initially targeting v6 at university fairs. UI labels
are German; engineering documentation is English. Visitors do not operate it.

Domain definitions and runtime rules are owned by the server repository:
[GLOSSARY.md](https://github.com/icampus-wildau/nao-fair-server/blob/main/GLOSSARY.md),
[behavior](https://github.com/icampus-wildau/nao-fair-server/blob/main/docs/behavior.md),
and [ADRs](https://github.com/icampus-wildau/nao-fair-server/tree/main/docs/adr).
In the combined checkout they are in `../nao-fair-server/`.
The dated [UX review](docs/ux-review-2026-10-29.md) and
[implementation report](docs/ux-implementation-2026-10-29.md) record earlier work.

## Shell and navigation

Four main areas: **Dashboard**, **Roboter**, **LLM-Studio**, **System**. The
persistent header contains the robot address, known-robot suggestions,
connect/disconnect controls, actual connected name, and backend connection state.
Navigation and configuration editing remain usable without a robot; hardware
actions explain their availability. Display backend reports rather than invented
robot names, battery levels, connection success, or sensor activity.

Studio contains **Szenario**, **System-Prompt**, **Hintergrundwissen**,
**Örtlicher Kontext**, **Persönlichkeit**, **TTS-Ersetzungen**, **STT-Vokabular**,
**Modell / Generierung**, **Interaktionen**, and **Dialoge**. Legacy `/setups`,
`/interaktionen`, and `/schluessel` paths redirect to their current locations.

Keep the established compact visual system: charcoal header, neutral surfaces,
lime active states, thin dividers, squared controls, and IBM Plex typography.
Support smaller screens, keyboard navigation, visible focus, labels, and readable
contrast. Use shared controls and tokens from the existing app.

## Editing and commands

- Backend applied state, browser drafts, saved content, and selected scenario are
  separate. Indicate dirty state and applied content without confusing selection
  with activation. A selected scenario may differ from the draft and runtime.
- **Übernehmen** applies configuration; **Zurücksetzen** discards draft changes.
  Studio coordinates language/content and interactions through separate requests.
  Show interruption consequences for language/robot Apply; interaction-only Apply
  and direct audio controls preserve the conversation.
- Loading a scenario fills the Studio draft. Saving or **Aktualisieren** stores
  the combination without applying it. Handle unsaved edits before replacement;
  show comparisons on demand. Robot/audio settings remain outside scenarios.
- Speech, conversation, motion, and explicit action tests run immediately. Audio
  volume/speed sliders persist on release and show local save/error feedback.
  Mounting a component or reconnecting a socket does not execute hardware actions.
- Confirm leaving a main area with dirty edits. Optional local draft recovery
  requires explicit restoration; it never includes secret input. Server updates
  preserve dirty drafts and notify their window; clean drafts follow applied state.
- Use expected revisions for Apply, expose conflicts, and avoid reporting success
  when the backend rejects or cannot complete a command.

## Dashboard and Roboter

- Dashboard shows the backend's Idle, Listening, Thinking, and Speaking states;
  context-sensitive conversation controls; sensor feedback; assigned gestures;
  direct speech and common motions; and direct volume/speed controls.
- Transcript shows chronological finished visitor/NAO utterances with timestamps,
  manual scrollback, search, copy/export, and resizing. Opening/reconnecting a
  browser replaces its lines with the server snapshot. Runtime retention is
  specified by the server behavior document.
- Sensor display uses the seven supported sensors, including the top-down head
  view. Press indicators are transient feedback, not event history.
- Roboter groups audio/speech, conversation controls and timers, recognition,
  direct motions, and speech tests. Use backend capabilities and validation ranges.
  Microphone sensitivity and alternate voices are currently unsupported.
- Expose listening, idle-context-reset, thinking, and microphone-unmute timing in
  seconds with help text. Keep rarely changed settings collapsible. Supported
  motions are wave left/right, nod, shake, sit, stand, and stop.

## Studio content and model settings

- Exactly one system prompt, one personality, an optional local context, and any number of
  knowledge items are selected. Manage Markdown items with search, sorting,
  duplication, editing, and a source/preview switch, using one active text editor.
- New installations contain generic system-prompt and personality items only.
  Knowledge, local context, TTS/STT lists, dialogs, scenarios, and gesture actions
  start empty; a saved scenario may have no local context selected.
- Applied content is protected from deletion. For content referenced by saved
  scenarios, show dependencies and require a compatible replacement. Keep
  deletion checks on the backend as well as in the UI.
- Show combined prompt size estimates on demand. Persist useful editor/list state
  and expose existing keyboard shortcuts through help.
- TTS rules have source, replacement, enabled state, ordered priority, preview,
  and overlap information. STT vocabulary supports enabled terms, deduplication,
  and bulk import. These feed separate speech-processing steps.
- Model settings target the existing OpenAI integration; recognition uses Gladia.
  Offer only settings supported by the adapters. Cloud keys belong under System.

## Studio interactions and dialogs

- Seven triggers each have tap, double-tap, and long-press bindings, independent
  enabled switches, one action per gesture, and an explicit test action. The
  chest button and arm chord are not assignable actions.
- Actions cover fixed speech, conversation controls, speech stop, supported
  motion/stop, and next/previous/repeat/reset of the active dialog. Show fields
  appropriate to the selected action, including delivery and next-line yield.
- Dialogs are a library with at most one active dialog. Lines have stable ids;
  robot lines have a delivery, while human planning lines are unspoken. Provide
  ordering, Wrap, idle reset in minutes, and tests of applied playback.
- The Armed switch controls Standby, separately from whether the app holds the
  triggers. Follow the robot-reported switch and assignment-sync status.
- Playback position, interruption rules, and gesture timing follow server behavior
  and its robot-side counterpart; the browser does not simulate those rules.

## System and browser microphone test

System contains NAO/bridge/autostart diagnostics, robot program installation,
OpenAI/Gladia key management, and tests. Key fields are write-only and report
presence/source without retrieving a stored value. SSH installation has explicit
host-key and password steps; assignment sync uses the existing NAOqi connection.

**Gespräch ohne NAO testen** opens the tests while disconnected. Only
**Mikrofontest starten** requests the microphone and starts the cloud pipeline.
**Test beenden** or leaving the test area releases it. Show transcript, input
level, and browser speech; provide clear errors for missing prerequisites.
This browser test is distinct from the deterministic test-server driver.

## API, persistence, and checks

The frontend uses FastAPI HTTP commands and `/api/events` WebSocket reports, never
direct NAOqi access. Keep payloads aligned with server `models.py`/`app.py` and
client `src/model/types.ts`/`src/api/client.ts`. A picture replaces reported state
on open/reconnect. Config/content/scenarios and known robots persist on the
server; transcript is memory-only; optional draft/UI state is browser-local.

Reuse Vue, Pinia, CodeMirror, and the existing NAO/Pipecat adapters. The server
uses SQLite directly. The local operator app has no login and binds to localhost
by default; do not describe a LAN authentication layer as already implemented.
PDF/RAG ingestion, a visitor kiosk, fleets, and historical telemetry remain
outside current scope.

Changes should preserve these acceptance paths:

1. Edit and apply while disconnected, then connect and receive the applied values.
2. Load/save a scenario without applying; apply language versus interactions and
   observe their different interruption behavior.
3. Receive a picture after reconnect, preserve dirty edits, and handle stale Apply.
4. Display real reported conversation/sensor events; on disconnect show Idle,
   clear transcript/presses, and disable hardware controls.
5. Edit/test gestures and dialogs, including planning lines and active selection.
6. Start/stop the browser microphone test only through its explicit controls.

Run the model tests, type check, and relevant Playwright checks described in
[README.md](README.md#checks). Browser fixtures use a temporary server store;
hardware/cloud acceptance needs a separate explicit run.
