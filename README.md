# nao-fair-frontend

*Operator UI for one NAO at a fair or exhibition.*

![Node](https://img.shields.io/badge/node-20.19%20%7C%2022.12%2B-blue?style=flat-square)
![CI](https://img.shields.io/github/actions/workflow/status/icampus-wildau/nao-fair-frontend/ci.yml?style=flat-square&label=CI)
![License: Apache 2.0](https://img.shields.io/badge/license-Apache%20License%202.0-blue)

Vue UI for one robot. Install, local start, and the production container are in the [nao-fair repository](https://github.com/icampus-wildau/nao-fair). A robot is not required to edit and apply configuration.

## Start

Needs Git, pnpm, and Node.js 20.19+ or 22.12+.

```bash
git clone --recurse-submodules https://github.com/icampus-wildau/nao-fair.git
cd nao-fair
./install.sh

# Run the UI
./start-nao-fair.sh       # built UI at http://127.0.0.1:8000

# ... or start in development mode
./start-nao-fair-dev.sh   # http://127.0.0.1:5173, API stays on port 8000
```

This directory alone, when the server is already running:

```bash
pnpm install --frozen-lockfile
pnpm run dev     # proxies /api, including WebSocket, to the backend
pnpm run build   # writes dist/; the fair server serves it on the next start
```

`NAO_FAIR_API_URL` overrides the proxy target. The default is `http://127.0.0.1:8000`. `pnpm run dev` and `pnpm run build` run on the host, even when the server is in the Dev Container. The container shares the host network.

## Conversation without a NAO

Under **System → Tests**, **Mikrofontest starten** runs the applied pipeline with a transcript, input level, and browser speech. Opening the tests does not start the microphone. **Test beenden**, or leaving the test area, releases it. With no robot connected, **Gespräch ohne NAO testen** on the dashboard opens that screen.

Requirements are the server's [browser pipeline packages](https://github.com/icampus-wildau/nao-fair-server#test-the-conversation-without-a-nao), the API keys, and microphone permission on localhost or HTTPS.

## Development documentation

[requirements.md](requirements.md) describes the current four main areas and
Studio workflow; [AGENTS.md](AGENTS.md) points to implementation boundaries.
The server owns the shared [glossary](https://github.com/icampus-wildau/nao-fair-server/blob/main/GLOSSARY.md),
[behavior rules](https://github.com/icampus-wildau/nao-fair-server/blob/main/docs/behavior.md),
and [decisions](https://github.com/icampus-wildau/nao-fair-server/tree/main/docs/adr).
Dated reports under `docs/` are historical UX evidence.

## Checks

```bash
pnpm test
pnpm run typecheck
pnpm run test:e2e
```

`pnpm run test:e2e` builds the production client and starts a test server on port 8001 and a preview on port 4183. Both ports must be free. The test server uses a temporary directory and no stored secrets.

It needs the Python environment of the neighboring `nao-fair-server` checkout and Chromium. Installed Chromium or Brave is detected. Otherwise set `CHROME_PATH`, or run `pnpm exec playwright install chromium`. `NAO_FAIR_TEST_PYTHON` overrides the Python path. The default is `.venv/Scripts/python.exe` on Windows and `.venv/bin/python` on Linux, in the neighboring server checkout. Run the browser check in WSL when the backend is in WSL.

```powershell
$env:NAO_FAIR_TEST_PYTHON = "C:\nao-fair\nao-fair-server\.venv\Scripts\python.exe"
pnpm run test:e2e
```
