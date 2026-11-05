# NAO Fair frontend

Read [requirements.md](requirements.md) for current UI scope and [README.md](README.md)
for setup and checks. For configuration, dialogs, or lifecycle changes, read the
sibling server's [glossary](../nao-fair-server/GLOSSARY.md) and relevant
[behavior section](../nao-fair-server/docs/behavior.md). In a standalone clone,
these documents are in the `icampus-wildau/nao-fair-server` repository.

- UI labels are German; engineering terminology follows the glossary.
- `src/stores/console.ts` handles API actions and draft state; `src/model/` holds
  pure state/comparison logic; `src/api/` holds transport and API calls.
- The backend supplies connection, conversation, transcript, and applied state.
  Keep editable drafts separate from those reports. Selecting a scenario fills
  drafts; Apply changes runtime configuration.
- The four main areas are Dashboard, Roboter, LLM-Studio, and System. Interactions,
  dialogs, and scenarios live within Studio; legacy paths redirect there.
- Update `src/model/types.ts`, `src/api/client.ts`, and server payloads together
  when changing the API. Keep tests for reconnects and revision conflicts relevant.
- `docs/ux-*-2026-10-29.md` are historical reports, not current requirements.

Run the checks listed in the README for the affected layer. Browser tests use a
temporary server store; use those fixtures rather than operator data or keys.
