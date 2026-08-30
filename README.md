# AILEXSI Word Reader

A personal manuscript listening tool for **M.G.M. (AILEXSI / MONDAY)**.

Open a Word manuscript and hear it read aloud in a calm system voice. Follow the highlighted paragraph, pause, come back later, and continue from the same place. The original `.docx` is never modified.

This is a listening module — not an audiobook studio, editor, or writing assistant.

## Run locally

```bash
npm install
npm run dev
```

Then open the URL Vite prints (default: `http://127.0.0.1:47291`).

```bash
npm test          # parser, structure, chunking, position store
npm run build     # production build
npm run generate:sample
```

No backend and no API keys. Narration uses the browser **Web Speech API** (`speechSynthesis`). German **de-DE** neural/natural system voices are preferred when the OS provides them.

## How to use

1. Drop a `.docx` on the start screen, or click **Manuskript öffnen**.
2. Chapters appear in the left sidebar. The parser uses Word heading styles when they exist; if they do not (common), it still finds lines such as *Vorwort*, *Teil I — …*, *Kapitel 1* plus a following subtitle.
3. Press **Play**. The current paragraph highlights and scrolls into view. Verse lines keep their breaks and are spoken with short pauses — not as one run-on sentence.
4. Pause, skip a paragraph, jump to a chapter, or change speed / voice.
5. Close the tab. Reopen the app: **Fortsetzen**, **Von vorn**, or pick a chapter.

If the browser supports the File System Access API, the last file handle is remembered so reopening is smoother. Otherwise pick the file again — extracted text and reading position live in IndexedDB / localStorage, keyed by file name, size, and a content hash. Nothing is written back into the Word file.

Bundled stand-ins (not the author’s private files):

- **SAIOS anhören** — lyrical German manuscript in the shape of `SAIOS1.docx` (`SAIOS – Die wahre Fassung`). Short verse lines, `<w:br>` breaks, mixed German/Latin, images that are not narrated.
- **Langes Beispiel** — unstyled literary book with Vorwort, Teil I–VII, Kapitel + subtitle lines, and long body paragraphs.

### Keyboard

| Key | Action |
| --- | --- |
| Space | Play / pause |
| Escape | Stop |
| ← | Back ~10 seconds |
| → | Forward ~30 seconds |
| ↑ / ↓ | Previous / next paragraph |
| `[` / `]` | Previous / next chapter |

Click a paragraph or chapter to start from there.

## What it does

- Parses `.docx` in the browser (ZIP + Word XML). Headers, footers, drawings/images, and page-number junk are skipped.
- Detects chapters from heading styles **or** from short standalone German heading lines. Dialogue and one-sentence beats are not treated as chapters.
- Normalizes formatting only (whitespace, hyphenation at line wraps). Verse line breaks are kept. Prose is not rewritten.
- Chunks by paragraph (and by verse line / sentence when needed) so a long book is never one SpeechSynthesis call.
- Remembers voice, speed (default 1.0×), volume, and reading position per manuscript.

## Voice architecture

`NarrationEngine` talks to a `NarrationProvider`. v1 ships `WebSpeechProvider` (system TTS). An API provider can be added later without changing highlighting, chapter jump, or position persistence.
