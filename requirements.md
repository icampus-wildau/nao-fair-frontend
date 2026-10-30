NAO Fair is a browser-based operator console for configuring, monitoring, and controlling **one NAO v6 humanoid robot** during a university trade fair. It is intended primarily for staff without programming experience, while exposing enough detail for technical administrators. The application is **not visitor-facing**.

This specification describes the intended MVP, the five approved UI areas, data and runtime semantics, backend boundaries, and implementation acceptance criteria. Existing robot/voice functionality should be reused rather than reimplemented. The initial interface language is German; this engineering specification is in English.

# Product Goals and Scope

**Goals**

- Let an operator connect to one NAO v6 by IP address and see its actual name and connection status.

- Provide immediate, safe controls for conversation, speech playback, microphone, and movement.

- Show live conversation state, a scrollable STT/NAO transcript, and touch-sensor feedback.

- Make LLM instructions, Markdown knowledge, context, personality, TTS word replacements, and STT vocabulary editable without exposing multiple editors at once.

- Save each configuration component as a reusable preset, compose presets into named setups, and activate setups on the running system.

- Distinguish unapplied edits from runtime state with explicit **Apply** and **Reset** behavior.

**MVP limits**

- Only one connected robot at a time.

- One action per physical sensor trigger; multi-action sequences are a future enhancement.

- Markdown content is entered and managed in the UI; PDF/RAG document ingestion is out of scope.

- No visitor-facing kiosk, multi-robot fleet management, detailed analytics, or historical telemetry dashboard.

- Integration with existing Python/Pipecat and NAOqi components is preferred; do not replace the audio pipeline as part of UI development.

# Application Shell and Design

The navigation tabs are **Dashboard**, **Robot**, **LLM Studio**, **Interactions**, **Setups**, and **Keys**, in that order. Keys is where the operator sets the OpenAI and Gladia secrets. It is not a general settings page. Use a compact, desktop-first layout with the approved Swiss-industrial design: charcoal header, light neutral surfaces, lime-green active states, thin dividers, squared controls, accessible contrast, and dense but readable operator panels.

The persistent top bar contains:

- App title **NAO Fair**.

- Editable robot IP address, Connect/Disconnect action, input validation and clear feedback on failure.

- Actual robot name retrieved from the backend, and the current connection state. The picture includes no battery level.

- Navigation remains usable when the robot is offline; hardware actions are disabled with an explanation.

- No hardcoded robot name, IP address, or invented connection data. The robot name appears only while a robot is connected.

**Command semantics:** A button that immediately speaks, moves, starts/stops a conversation, or tests an action sends a command immediately and reports success/failure. Editable configuration is kept as a draft until **Apply**. **Reset** discards unapplied edits and reloads the last applied configuration; it is not a factory reset. Warn before navigating away with unsaved edits.

**Apply** and **Setup aktivieren** update the applied configuration even when no robot is connected. When a conversation pipeline is running, both rebuild it and stop the current conversation. Volume is sent to the robot at once. Speech speed, TTS language, and pronunciation replacements are used on the next phrase. The model, the prompt, the four timeouts, Gladia settings, custom vocabulary, and sensor bindings belong to the rebuilt pipeline. The model's conversation context is discarded. The transcript stays on screen.

**Disconnect** stops the conversation. The model context is discarded, the state is Idle, and no pipeline keeps running. Speech stops immediately, an in-flight gesture is cancelled, and the posture stays where it is. The transcript is cleared. The laptop closes its microphone-bridge socket. The bridge process on the robot stays up and releases the microphone itself. The applied configuration is unchanged. The next successful connection builds a new pipeline from that configuration. Connecting a different IP while a robot is connected is that disconnect, then a connect, and the new robot receives the applied configuration.

The server does not SSH to the robot and does not collect the robot password. The bridge is installed once and started on the robot. Connect succeeds only when that bridge accepts a client. A closed port is a failed connect, and the header stays disconnected and shows the failure.

If the bridge socket drops while the operator has not disconnected, the server keeps dialing that same bridge until the operator disconnects or connects a different robot. The header stays connected and the conversation stays as it was. If the NAOqi link drops or the pipeline fails, that is a disconnect: the header shows the failure, and the operator connects again.

The transcript is also cleared whenever the conversation context is emptied, including the context-reset timeout and an action that empties the context immediately. Stopping a conversation without emptying the context leaves the lines until that timeout or a disconnect.

The console and the backend both run with no robot connected. Commands that need the robot are disabled until a connection succeeds. Prompts, knowledge, and settings can be edited and applied with no robot, and a successful connection sends that applied configuration to the robot. There is no operator-facing simulator and no fake conversation or sensor events.

**Opening picture.** When a browser opens, or its event socket reconnects, the server sends one picture: the connection, the conversation state, the finished transcript lines, and the applied configuration, including which setup is active. The console replaces the on-screen transcript with those lines. Drafts, operator secrets, and trigger presses are not in the picture. A reload drops drafts. The picture includes no battery level. The conversation state is Idle, Listening, Thinking, or Speaking. A disconnected console shows Idle, including before the first connection. Hardware controls stay disabled because there is no connection.

The transcript in that picture is finished visitor and robot lines only. A partial recognition is not held and is not replayed.

The robot address in the picture is the one this server process last used, including after a clean disconnect. The browser remembers that address and uses it after a server restart, when the process has none. An address typed but not yet used for Connect is a draft. Clearing the field clears the remembered address. While the server still has an address, the next picture fills the field again. The robot name is in the picture only while connected.

A refused connect, a NAOqi drop, or a pipeline failure leaves a failure on the picture: disconnected, the address, no name, Idle, and an empty transcript. The failure remains until the next connect attempt starts or a connect succeeds. A clean disconnect has no failure. While Connect has not finished, the picture stays disconnected, with the address being tried, no name, Idle, and no failure. The console that sent Connect may show a pending state locally. A reload drops that pending state. Disconnect aborts the attempt, and a late success does not attach the robot. A bridge redial leaves the picture unchanged and stays connected.

Apply and Setup aktivieren replace the applied configuration in the picture, keep the transcript, and set the state to Idle. When this console did not apply or activate and its draft is dirty, the draft stays and the console shows a dismissible notice. A clean console updates with no notice. The wording of a failure, of that notice, and of any reconnecting label is a separate decision.

# Functional Requirements

## 1. Dashboard

The home page is a compact operational overview, not a large system-ready hero.

- **Connection:** Persistent header shows the connected robot and connection action.

- **Live conversation:** Show exactly four authoritative states: Idle, Listening, Thinking, and Speaking. Provide context-sensitive Start/Stop controls; do not show “Start conversation” as active while a conversation is already running.

- **Transcript:** Scrollable chronological finished lines from visitor speech and NAO output, with speaker, timestamp, and content. Support auto-scroll and manual scrollback. The lines are held in server memory. A browser that opens or reconnects receives them and replaces the on-screen transcript. A partial recognition is not held. A disconnect, a different robot, emptying the conversation context, or a server restart clears the lines. Apply keeps them. A reload shows the lines still held.

- **Robot sensors:** Front view with press/touch indicators, a separate top-down head view, active hotspot feedback, and last sensor event. Available sensor IDs must come from the adapter's supported capabilities rather than assumptions made by a mockup.

- **Quick controls:** Output volume and speech speed; wave left/right, nod, shake head, sit down, stand up, and stop movement. Show clear success/error feedback.

- **Active setup:** Setup name, a Switch Setup action, and direct links to its constituent presets: personality, system prompt, knowledge, voice, and model (plus other configured components when relevant).

- **Mapped actions:** Compact list of active sensor-to-action mappings. This is a configuration overview, **not** an event history.

## 2. Robot

Group settings into **Speech & Audio**, **Conversation Control**, **Microphone & Recognition**, **Direct Motions**, and **Text-to-Speech Test**.

- Voice output volume, speech speed, available voice selection, language selection.

- Microphone enabled/disabled, STT enabled/disabled, and LLM conversation enabled/disabled where supported.

- Four numeric timing settings with seconds as the unit:

  - **listening_timeout_secs:** Time without recognized speech before Listening returns to Idle.

  - **context_reset_timeout_secs:** Time after Idle after which the current conversation context is discarded and the transcript is cleared.

  - **thinking_timeout_secs:** Maximum time to wait for an LLM response.

  - **unmute_delay_secs:** Delay after TTS playback before the microphone is unmuted.

- Provide clear human-language labels, short help text, validation, and configurable ranges established by the backend. Support fractional seconds where appropriate.

- **Do not expose microphone sensitivity:** It is not supported by the current robot/application.

- Immediate motion actions: wave left, wave right, nod, shake head, sit down, stand up, return to a safe/basic posture (if supported), and stop current movement.

- A text area to send arbitrary test text to NAO's TTS with output status and a Stop Speaking action.

- Persistent Apply and Reset buttons for configurable settings; emergency and test actions do not wait for Apply.

## 3. LLM Studio

This tab edits the content and generation settings used by the existing language pipeline. Use **large vertical subnavigation tiles on the far left**, each showing a short summary of its current configuration; render **one active editor** in the central pane. Keep **Model & Generation** settings in a separate right-hand panel and a compact **Component Presets** area beneath.

**Editable sub-sections**

1. **System Prompt (always present):** Exactly one required active Markdown system prompt. The operator may edit, select, duplicate, and save prompt presets; the system prompt cannot be disabled.

2. **Background Knowledge (multi-select):** Any number of Markdown snippets may be selected and combined. Support create, rename, edit, delete, enable/disable, and save a selected combination as a reusable knowledge preset. A file list plus one active Markdown editor is sufficient.

3. **Local Context (single-select):** Choose exactly one named Markdown context describing the robot's location or situation, e.g., a particular trade fair or room. Provide an editor and reusable context presets.

4. **Personality (single-select):** Choose exactly one personality definition describing how NAO should respond (tone, style, length, behavior). Provide a Markdown editor and presets.

5. **TTS Replacements:** Editable ordered list of source words/phrases and their replacement spellings for pronunciation before TTS. Use a two-column editable table with Add/Delete, enabled state, validation for empty/duplicate source entries, and a preview/test input. In the MVP, use deterministic literal/word-boundary matching rather than arbitrary user regex.

6. **STT Custom Vocabulary:** Editable list of terms sent as vocabulary hints to the configured STT service. Support add/edit/remove, deduplication, enable state, and provider-aware validation. The adapter must report when a provider does not support vocabulary hints rather than silently pretending they were applied.

**Model & Generation settings:** Provider, model identifier, temperature (where supported), response-length or token budget, streaming mode, and other provider-supported parameters. API keys are written on the Keys tab, stay on the server, and are never returned to the browser.

**Composition semantics:** The backend composes the required system prompt with the selected personality, exactly one local context, and all enabled background snippets in a deterministic order. TTS replacements are applied in the outgoing speech pipeline; STT vocabulary is passed to the STT provider adapter. These are separate runtime processing steps, not additional paragraphs in the LLM prompt.

Each independent component may be saved as a preset. A selection of Markdown knowledge snippets may also be saved as a knowledge-bundle preset. Provide actions to Save Preset, Duplicate, and Combine as Setup.

## 4. Interactions

Configure physical NAO button/touch events to immediate speech or robot/application actions.

- Display a robot front view plus top-down head view with visual sensor hotspots.

- List supported trigger IDs from the backend (examples include chest button, head touch positions, and left/right foot bumpers).

- Select a trigger and edit its assigned action in one dedicated form.

- MVP allows **one action per trigger**; the underlying action data model should be extensible to future sequences.

- Initial action types: Speak Text, Start Conversation, Stop Conversation, Stop Speech, and supported robot motion/animation. Setup switching may be supported through an extensible action registry when safe.

- For Speak Text, edit the exact phrase and voice. For motion actions, select a supported motion identifier. Provide an explicit Test Action button.

- Show the current bindings in a compact table with enabled switches; no chronological history.

- **Mapping preset management:** Load a named interaction-mapping preset, Save changes to it, Save As a new preset, duplicate, and expose saved mapping presets to the Setups tab.

- Applying a mapping preset should update registered runtime behavior without requiring a frontend reload; handle sensor subscription changes safely.

## 5. Setups

A **Setup** is a named, reusable configuration assembled from component presets, not merely a copy of one settings form.

- Browse, search, create, rename, duplicate, and delete saved setups (with confirmation for deletion).

- Edit setup name and optional description.

- Choose a preset for each compatible slot: system prompt, knowledge bundle, local context, personality, LLM config, voice/audio settings, STT vocabulary, TTS replacements, and interaction mappings. Show only applicable configured slots; do not invent unsupported robot capabilities.

- Display a compact summary of linked preset names and a clear active indicator.

- Save a composition as a new setup or update an existing setup.

- Activate a setup for the currently connected robot/application and show whether activation succeeded. Activation uses the same rebuild and interrupt as Apply.

- Reset discards uncommitted changes. Switching setups with dirty edits prompts to apply, discard, or cancel.

**Important pending decision:** Whether edits to an existing preset automatically propagate to setups using that preset. Recommended safe default: store versioned presets and have setups reference a specific revision; explicitly offer an Update to Latest action. This prevents a previously tested trade-fair setup from changing unexpectedly.

# Data and State Model

Suggested core entities; names are illustrative and may be refined during implementation:

| Entity | Essential fields |
| - | - |
| RobotConnection | address, name, connection_state, capabilities, last_seen |
| RuntimeConfiguration | audio/voice settings, microphone/STT toggles, four timing values, active setup/version |
| ContentItem | id, kind (system_prompt, knowledge, local_context, personality), name, markdown, timestamps |
| TTSReplacementList | id, name, ordered entries (source, replacement, enabled) |
| STTVocabularyList | id, name, ordered terms, enabled state |
| Preset | id, kind, name, description, revision, payload/reference IDs, timestamps |
| Setup | id, name, description, selected preset references/revisions, active flag |
| SensorMapping | sensor_id, action_type, action_payload, enabled |
| ConversationEvent | id/sequence, timestamp, session_id, event_type, payload |

Use strict schema validation in the API. The backend is authoritative for connection state, active runtime state, supported capabilities, and applied configuration. The frontend maintains a separate editable draft and dirty state.

Presets and setups must survive application restart. The connection and the transcript do not. The transcript stays in server memory and is cleared on disconnect, on a different robot, when the conversation context is emptied, and on a server restart. A reload shows the lines still held. Avoid storing secrets in presets, setup exports, or client-side persistence.

When applying a setup/configuration, validate the complete payload first, report per-component failures, and avoid leaving UI and backend with different presumed active states. Use revision/concurrency checks for updates.

# Backend Integration and Realtime Contract

**Existing architecture:** The project already uses a modern Python application with Pipecat to coordinate STT, LLM, and TTS, with NAOqi access and a separate NAO-compatible audio bridge. Reuse these components through a well-defined backend adapter; do not recreate a browser audio pipeline or connect directly from browser JavaScript to NAOqi.

**Recommended separation**

- **Frontend:** UI, editing drafts, validation feedback, realtime visualization, and operator commands.

- **FastAPI control API:** Authentication, CRUD for presets/setups, applied configuration, action dispatch, and event publishing.

- **Conversation runtime adapter:** Pipecat state/turn-taking, STT and LLM requests, context lifecycle, TTS replacements, STT vocabulary.

- **NAO adapter:** NAOqi connection, robot naming/status, sensors, speech playback, movement commands, and existing audio bridge.

- **Persistence:** SQLite for structured config, metadata, presets, and setups; store Markdown content in the database or as referenced versioned text assets, consistently.

**Illustrative HTTP API (not a fixed contract)**

- POST /api/robot/connect, POST /api/robot/disconnect, GET /api/robot/status, GET /api/robot/capabilities

- GET /api/config/applied, POST /api/config/apply (validated draft + expected revision)

- POST /api/conversation/start, POST /api/conversation/stop

- POST /api/speech/speak, POST /api/speech/stop

- POST /api/motions/execute, POST /api/motions/stop

- CRUD for /api/content, /api/presets, and /api/setups

- POST /api/setups/{id}/activate

- GET /api/interaction-mappings and write/apply operations

**Realtime endpoint:** WebSocket /api/events, with typed messages such as:

- robot.status_changed

- conversation.state_changed (Idle, Listening, Thinking, Speaking)

- transcript.message (speaker visitor/nao, text, timestamp)

- sensor.pressed / sensor.released (sensor ID and timestamp)

- config.applied / config.apply_failed

- action.started / action.completed / action.failed

- connection.error

Events need a session or robot identifier, monotonically increasing sequence number or equivalent ordering. A browser that opens or reconnects receives the whole picture and replaces its transcript. Live events should not be persisted in the configuration database by default. The same API serves an operator while no robot is connected, and that opening picture is sent either way. Live robot events are emitted only while a robot is connected.

# Runtime, Safety, and Nonfunctional Requirements

- Conversation state transitions are supplied by the backend; do not derive the state from button clicks alone.

- Respect the configured listening, context-reset, thinking, and microphone-unmute timers. A user-visible error/timeout state should accompany failures without inventing successful outcomes.

- Muting during TTS and the unmute delay should prevent robot speech from being fed back into STT; the existing Pipecat/runtime owns the behavior.

- Immediate actions must be visibly disabled when unavailable, disconnected, or unsafe. Include Stop Speaking and Stop Movement as prominent controls where appropriate.

- Never run potentially unsafe motion commands simply because a component mounted or a WebSocket reconnected.

- Restrict access to trusted operators on a controlled LAN; use authentication/authorization for control endpoints and secure handling of LLM/STT/TTS credentials. Do not expose the robot or its NAOqi port directly to the public internet.

- Keep UI rendering responsive while the robot is unreachable or the LLM is slow; commands should time out with actionable feedback.

- Support desktop-first responsive layouts; keyboard navigation, focus states, labels, clear error messages, and sufficient contrast are required.

- UI labels should be German. Internal API names and source code may be English.

- Design tokens and shared components must keep the five tabs visually consistent.

# Acceptance Criteria for MVP

1. An operator can enter a robot IP address, connect to exactly one robot, see its backend-reported name/status, and disconnect. Failure and reconnect paths are visible.

2. While a robot is connected, the Dashboard receives conversation states, transcript messages, and sensor events in near real time via the event stream. With no robot, those controls are disabled and show no invented activity.

3. Direct controls can speak text, start/stop a conversation, and invoke supported motions, with immediate feedback. Unsupported actions are disabled.

4. Robot settings include all four named timing fields, with validation; microphone sensitivity does not appear.

5. LLM Studio has six internal sections; only one editor is visible at a time. System prompt is always present, background knowledge allows multi-selection, and local context/personality each allow one selection.

6. TTS replacement pairs and STT vocabulary entries can be edited and are passed through backend adapters at the correct pipeline stage.

7. Sensor mappings support one action per trigger, testing, enable/disable, and saving/loading mapping presets.

8. Individual component presets and composite setups can be created, updated, duplicated, and persisted across restarts.

9. Apply changes the authoritative active configuration; Reset discards only unapplied edits. Dirty-state navigation and conflict handling work.

10. Frontend tests, backend tests, and a browser test exercise editing prompts and settings, and the disabled hardware controls, without a physical NAO. Those three layers also cover live conversation states, transcript lines, and trigger presses. A driver that only the test server starts sends the reports. The fair server does not start it, and the operator has no control for it. One browser test walks from a disconnected console through the four conversation states, a visitor line, a robot line, and one trigger press. A second case, on all three layers, ends the connection from Speaking and expects Idle, an empty transcript, dark trigger rows, and disabled hardware controls.

# Recommended Technical Stack and Delivery Plan

| Layer | Recommended choice | Rationale |
| - | - | - |
| Client | Vue 3, Vite, TypeScript, Vue Router | A browser-only operator SPA does not require SSR |
| UI | Nuxt UI 4, Tailwind CSS | Familiar accessible components, custom industrial theme; supports standalone Vue/Vite |
| Shared client state | Pinia | Connection, live conversation, active setup, draft configuration |
| Markdown editor | CodeMirror 6 | Inline Markdown editing with syntax highlighting |
| Control/API backend | Python, FastAPI, Pydantic | Reuse existing Python/Pipecat code and expose typed OpenAPI/WebSocket endpoints |
| Persistence | SQLite, SQLAlchemy, Alembic | Simple single-site deployment with migrations |
| Tests | Vitest, Playwright, pytest | Component, browser, and integration verification |
| Delivery | Existing DevContainer; containerized deployment | Preserve NAOqi and audio-bridge development constraints |

Adapt the source layout based on the existing repos and append reasonable further source dirs.

**Implementation order**

1. Build all five UI screens from the approved mockups against the real API, including the disconnected state; define shared design tokens and API schemas.

2. Implement persistent content items, presets, setups, draft/apply/reset semantics, and migrations.

3. Integrate robot connection/status, direct speech/motion controls, and sensor events through the existing NAO adapter.

4. Integrate Pipecat conversation state/transcript and the runtime timing, prompt composition, TTS replacements, and STT vocabulary.

5. Validate error paths, safety/access controls, restart persistence, and a real-device acceptance session.

Official stack references:

- [Nuxt UI for Vue/Vite](https://ui.nuxt.com/docs/getting-started)

- [Pinia state management](https://pinia.vuejs.org/introduction.html)

- [FastAPI WebSockets](https://fastapi.tiangolo.com/advanced/websockets/)

- [FastAPI and OpenAPI](https://fastapi.tiangolo.com/features/)

# Open Decisions to Confirm Before Production Integration

1. **Preset propagation:** Should existing setups stay pinned to a preset revision (recommended) or always use the latest revision? --> Always use the latest revision.

2. **Context timeout semantics:** Exactly which activity restarts context_reset_timeout_secs (last user speech, NAO reply, or any conversation event)? --> any conversation event.

3. **STT vocabulary support:** Which STT providers are in use and what vocabulary/hint formats do their adapters accept? --> for now we only use Gladia, so adapt to the current approach in the pipecat app.

4. **Motion and sensor capabilities:** Which NAOqi services/events are available in the current v6 installation, and which postures are safe for operators to execute during a fair? --> devide yourself based on the pipecat app and the naoqi-control lib.

5. **Persistence and privacy:** Should live transcripts be stored or exported, or remain in memory only? What retention policy applies? --> In server memory. A browser that opens or reconnects receives the lines still held. A disconnect, a different robot, emptying the conversation context, or a server restart clears them. Apply keeps them. A reload shows them again.

6. **Operator access:** Is the application single-operator on a dedicated machine, or should several staff browsers connect concurrently with a control lock? --> For now single-operator.