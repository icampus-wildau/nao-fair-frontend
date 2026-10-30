# Umgesetzte UX-Punkte, zweite Runde am 29. Oktober 2026

Ausgangspunkt ist die UX-Nachbetrachtung mit 24 Vorschlägen. Die Ergänzungen zur Preset-Verwaltung, zum System-Tab, zu Vergleichen hinter Info-Icons und zur alphabetischen Sortierung sind berücksichtigt.

| Punkt | Umsetzung |
| --- | --- |
| 1 Auswahl / übernommen | Auswahl bleibt Checkbox/Radio. Ein separater Marker zeigt tatsächlich übernommene Bausteine. Presets zeigen, ob ihr Inhalt der Auswahl oder dem übernommenen Stand entspricht. |
| 2 Setup-Abweichung | „Aktiv“ / „Angepasst“ mit Vergleich ausschließlich hinter einem Info-Icon. |
| 3 Gesprächsunterbrechung | Hinweis im Info-Dialog der Änderungsleiste. Reine Sensorzuordnungen erhalten jetzt das Gespräch; Audio bleibt direkt. Andere Konfiguration und Setup-Aktivierung bauen die Pipeline weiter neu auf. |
| 4 Löschabhängigkeiten | Verwendung in Presets/Setups wird vor dem Löschen angezeigt. Referenzierte Elemente benötigen Ersatz derselben Art. Backend schützt laufende Inhalte und ersetzt Referenzen atomar. |
| 5 Änderungsvergleich | Info-Icon im Footer; Tooltip und Dialog können viele Änderungen zeigen, ohne den Footer zu vergrößern. |
| 6 Wiederherstellung | Optionale lokale Sicherung von Konfigurations-, Text- und Setup-Entwürfen; explizite Wiederherstellung. Zurücksetzen und bestätigtes Verwerfen entfernen die Sicherung. Schlüsselwerte werden nie gesichert. |
| 7 Betriebsbereitschaft | Neuer System-Tab mit NAO, Mikrofonbrücke/Stream und Status von OpenAI-/Gladia-Schlüsseln. Die Schlüsselverwaltung ist dorthin umgezogen; die alte Route leitet weiter. |
| 8 Fehleraktionen | Zugang zur Systemdiagnose, Adressprüfung, erneuter Prüfung und kopierbaren technischen Details. Alte Backend-Versionen werden verständlich gemeldet. |
| 9 Textsuche | Suche in Namen und Bausteintext mit kurzem Ausschnitt. |
| 10 Sortierung / Filter | Deutsche alphabetische Standardsortierung für Datenlisten und Auswahloptionen. Inhaltslisten lassen sich auch nach Änderungsdatum sortieren und auf ausgewählte Elemente begrenzen. Such- und Scrollzustand bleiben pro Untertab erhalten. TTS-Priorität und chronologische Transkripte behalten ihre fachliche Reihenfolge. |
| 11 Promptgröße | Gemeinsame Wort-/Tokenschätzung aller gewählten Promptteile hinter Info-Icon. |
| 12 Editorzustand | Breite, zuletzt geöffneter Baustein und Öffnungszustand bleiben gespeichert. |
| 13 Markdown-Vorschau | Umschalter im Editor. Bestehender Markdown-Parser, HTML bleibt Text; keine zusätzliche Laufzeitabhängigkeit. |
| 14 Tastatur | Strg/Cmd+K sucht, Alt+E öffnet den Editor, Escape klappt ein, Strg/Cmd+Enter übernimmt. Die Kürzel stehen im Info-Dialog. |
| 15 TTS-Überschneidungen | Vorschau hebt Ersetzungen hervor; mögliche Überschneidungen sind hinter Info-Icon einsehbar. Sichtbare Priorität bleibt unabhängig von alphabetischer Ansicht. |
| 16 Vokabularimport | Mehrere Begriffe aus Text oder Datei übernehmen; Dubletten werden vor der Übernahme gezeigt und ausgelassen. |
| 17 Dashboard-Sprechen | Kompakte direkte Texteingabe statt Wechsel zum Roboter-Tab. |
| 18 Schnellwahl | Sätze lokal anheften, auswählen und entfernen; zuletzt gesprochene Sätze stehen in der Schnellwahl. Auswahl allein führt keine Hardwareaktion aus. |
| 19 Transkript | Suche, Größenänderung, Kopieren und Export der sichtbaren Zeilen. Neue Nachrichten erhalten eine hochgescrollte Leseposition. |
| 20 Sensorerkennung | Expliziter Einmalmodus wählt die nächste reale Berührung. Ohne diesen Modus springt die Auswahl nicht. |
| 21 Seltene Einstellungen | Weitere Audioeinstellungen und Gesprächszeiten einklappbar, Öffnungszustand wird gemerkt. Direkte Audio- und Bewegungsaktionen bleiben offen. |
| 22 Setup-Aktivierung | Vergleich hinter Info-Icon. Zusätzliche Bestätigung nur während einer laufenden Unterhaltung. |
| 23 Audio-Rückmeldung | Kleine reservierte Statusfläche am Slider für Speichern, Erfolg oder Fehler, ohne Toast bei jedem Loslassen. |
| 24 Mobiler Header | Bleibt gemäß ursprünglicher ausdrücklicher Abgrenzung eine separate Untersuchung in Issue #1. |

## Ergänzende Änderungen

- Presets sind im Studio der erste, optisch abgesetzte Untertab. Verwaltung aller Preset-Arten an einer Stelle, einschließlich Stimme und Interaktionen. Die bisherigen Fußbereiche unter Inhaltslisten sind entfernt. Geladene, seitdem unveränderte Presets lassen sich von dort zu einem neuen Setup kombinieren.
- STT-, TTS-, Inhalts- und Presetlisten verwenden gemeinsame kompakte Zeilen und weiße Eingabefelder. Inhaltszeilen sind von 64 auf 46 Pixel Mindesthöhe reduziert, einfache Regel-/Vokabularzeilen auf 40 Pixel. Bearbeiten und Ändern der TTS-Priorität behalten Zeile und Tastaturfokus bei derselben Regel.
- Der gemeldete Audio-404 wurde zweimal am laufenden Dienst reproduziert: Der Prozess auf Port 8000 hatte den neuen Audio-Endpunkt noch nicht geladen. Der bestätigte NAO-Fair-Prozess wurde mit seinen bisherigen Umgebungswerten und Daten neu gestartet. Eine API-Versionsprüfung verhindert künftig eine nichtssagende Meldung bei diesem Fall.


## Abschließende Prüfung

- 31 Browsertests, 28 Backendtests und 7 Frontend-Modelltests bestanden.
- Vue/TypeScript-Prüfung und Produktionsbuild erfolgreich.
- Neun Ansichten bzw. Studio-Untertabs bei 1440, 768 und 390 Pixeln geprüft; keine Inspector-Fehler.
- Laufender regulärer Dienst auf Port 8000 und Frontend-Proxy auf Port 5173: System-Endpunkt mit API-Version 2 und Audio-Änderung jeweils HTTP 200.
- Hardware- und Cloudabläufe mit Testtreiber bzw. Adaptertests geprüft; kein echter NAO in diesem Prüflauf.

Die visuelle Prüfung mit Screenshots und begründeten Layoutwarnungen steht in `../../.taste-skill/round-2/REPORT.md`.
