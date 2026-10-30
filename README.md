# NAO Fair

Deutsche Bedienkonsole für einen NAO am Messestand.

## Installation und Start

Die Konsole benötigt den [NAO Fair Server](https://github.com/icampus-wildau/nao-fair-server). Die vollständige Anleitung zum Klonen beider Repositories sowie für Linux, Windows mit WSL und den Dev Container steht in der [Server-Installationsanleitung](https://github.com/icampus-wildau/nao-fair-server/blob/main/INSTALL.md). Benötigt werden Git, npm und Node.js 20.19+ oder 22.12+.

Wenn der Server bereits läuft, im Frontend-Repository ausführen:

```bash
npm ci
npm run dev
```

Die Konsole öffnet unter [http://127.0.0.1:5173](http://127.0.0.1:5173). Ein Roboter ist zum Bearbeiten und Übernehmen der Konfiguration nicht nötig. Für den Betrieb unter Port 8000 `npm run build` ausführen; der Server muss das erzeugte `dist`-Verzeichnis lesen können.

Unter **System → Tests** testet **Mikrofontest starten** die übernommene Pipeline
ohne NAO, mit Transkript, Eingangspegel und Browser-Sprachausgabe. Das verwendete
Setup und der Konfigurationsstand stehen daneben. Ohne Roboterverbindung führt
im Dashboard **Gespräch ohne NAO testen** direkt dorthin. Das Öffnen der Tests
startet das Mikrofon noch nicht.
Voraussetzungen sind die [Browser-Pipeline-Pakete des Servers](https://github.com/icampus-wildau/nao-fair-server#test-the-conversation-without-a-nao),
die benötigten API-Schlüssel und Mikrofonfreigabe über localhost oder HTTPS.
**Test beenden** oder das Verlassen des Testbereichs gibt das Mikrofon frei.
Das Dashboard zeigt das Roboter-Gespräch ohne Audioquellen-Auswahl und ohne
Transkript-Suche; Kopieren und Export bleiben im Transkript-Menü verfügbar.

Für die Entwicklung nach der Server-Einrichtung zwei Terminals öffnen,
jeweils im gemeinsamen Verzeichnis der beiden Checkouts:

```bash
# Terminal 1: Backend
cd nao-fair-server
uv run nao-fair
```

```bash
# Terminal 2: Frontend
cd nao-fair-frontend
npm ci # Einmalig bzw. nach Änderungen der Abhängigkeiten
npm run dev
```

Der Entwicklungsserver unter [http://127.0.0.1:5173](http://127.0.0.1:5173)
leitet `/api` einschließlich WebSocket zum Backend auf Port 8000 weiter.
`NAO_FAIR_API_URL` überschreibt das Proxy-Ziel. `npm run build` erzeugt `dist/`,
das der Fair-Server beim nächsten Start automatisch ausliefert.

`npm run dev` und `npm run build` laufen auf dem Host, auch wenn der Server im
[Dev Container](https://github.com/icampus-wildau/nao-fair-server/blob/main/INSTALL.md) läuft. Der Container teilt das
Host-Netz, daher bleibt das Proxy-Ziel `127.0.0.1:8000`.

Beenden mit **Strg+C** im jeweiligen Terminal. Backend-Codeänderungen benötigen
einen Neustart; Frontend-Änderungen erscheinen automatisch. Vor einem neuen
Backend-Start einen bereits laufenden Server auf Port 8000 beenden.

## Prüfungen ohne Roboter

```bash
npm test
npm run typecheck
npm run test:e2e
```

Die Browserprüfung baut den Produktionsclient und startet selbst einen Testserver
auf Port 8001 sowie eine Vorschau auf Port 4183. Beide Ports müssen frei sein.
Der Testserver verwendet ein temporäres Verzeichnis und keine gespeicherten
Schlüssel oder Daten des Bedieners. Er ist ausschließlich Teil der Tests.

Benötigt werden die Python-Umgebung des benachbarten `nao-fair-server` und ein
Chromium-Browser. Installiertes Chromium oder Brave wird automatisch erkannt;
alternativ `CHROME_PATH` setzen oder `npx playwright install chromium` ausführen.
`NAO_FAIR_TEST_PYTHON` kann den Python-Pfad überschreiben. Standardmäßig wird auf Windows `.venv/Scripts/python.exe` und auf Linux `.venv/bin/python` im benachbarten Server-Checkout verwendet. Für ein Backend in WSL die Browserprüfung ebenfalls in WSL ausführen. Beispiel für eine andere Windows-Umgebung in PowerShell:

```powershell
$env:NAO_FAIR_TEST_PYTHON = "C:\nao-fair\nao-fair-server\.venv\Scripts\python.exe"
npm run test:e2e
```

Geprüft werden Offline-Bearbeitung, Übernehmen/Zurücksetzen, Presets und Setups,
Schlüssel ohne Rückgabe des Geheimnisses sowie Zustände, Transkript und Sensoren
über einen ausschließlich im Testserver gestarteten Treiber. Screenshots aller
sechs Ansichten in drei Breiten liegen nach dem Lauf unter
`../.taste-skill/after/screens/`.

## Bedienverhalten

Auf dem Desktop reichen Dashboard und System-Arbeitsflächen bis zum unteren
Fensterrand. Inhalte bleiben oben kompakt; die Transkripte im Dashboard und unter
System → Tests nutzen die zusätzliche Höhe und scrollen längere Gespräche intern.
In kurzen Fenstern und auf kleinen Displays bleiben alle Gruppen über die
Seitenscrollung erreichbar. Dort lässt sich die Transkripthöhe weiterhin verändern.

Lautstärke und Sprechtempo werden beim Loslassen des Sliders direkt gespeichert,
auch ohne verbundenen Roboter. Andere Konfigurationsänderungen werden im unteren
Fensterbereich mit **Übernehmen** bzw. **Zurücksetzen** bestätigt. Ein bestätigter
Wechsel des Haupttabs verwirft offene Entwürfe. Innerhalb des LLM Studios bleiben
Entwürfe beim Wechsel zwischen Bausteinen und Untertabs erhalten.

Ein Klick wählt einen Textbaustein; ein Doppelklick oder **Bearbeiten** im Menü
öffnet den einklappbaren Editor. Der Trenner lässt sich ziehen oder mit den
Pfeiltasten verschieben. Informationen hinter Info-Icons erscheinen nach 600 ms
oder per Klick als Dialog. Verbindungsfehler stehen direkt am Status.

Weitere Vorschläge stehen in der [UX-Nachbetrachtung](docs/ux-review-2026-10-29.md).
Das spätere Mobile-Header-Thema ist als [Issue #1](https://github.com/icampus-wildau/nao-fair-frontend/issues/1) erfasst.


Die [zweite UX-Runde](docs/ux-implementation-2026-10-29.md) ergänzt einen zentralen
**Presets**-Untertab, den Bereich **System** mit Diagnose und Schlüsseln, lokale
Entwurfswiederherstellung sowie Such-, Import- und Schnellwahlfunktionen.
Vergleiche bleiben hinter Info-Icons. Datenlisten sind standardmäßig alphabetisch;
TTS-Ausführungspriorität und Gesprächsreihenfolge bleiben erhalten.

**System** zeigt API-Version und Serverstart; eine veraltete
API erzeugt einen verständlichen Hinweis statt „Not Found“.
