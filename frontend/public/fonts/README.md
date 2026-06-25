# Fonts

This directory holds **`OpenDyslexic-Regular.otf`**, which powers the "Dyslexic"
font option in Settings → Display → Font.

## Source

Download (open licence) from the `antijingoist/open-dyslexic` repo — the OTFs live
in the **`otf/`** directory (not `compiled/`, which was the old, now-stale path):

- Repo: https://github.com/antijingoist/open-dyslexic
- File: `otf/OpenDyslexic-Regular.otf`
- Raw URL: `https://raw.githubusercontent.com/antijingoist/open-dyslexic/master/otf/OpenDyslexic-Regular.otf`
- Project homepage: https://opendyslexic.org

The `@font-face` rule in `app/globals.css` expects the file at
`/fonts/OpenDyslexic-Regular.otf`.

## Committed intentionally — do NOT gitignore

The `.otf` binary **is committed to the repo on purpose** so the Dyslexic font
works out of the box for every clone and deploy with no extra setup step. Do not
add it (or `*.otf` / this directory) to `.gitignore`.

If the file is ever missing, the "Dyslexic" option gracefully falls back to
Hanken Grotesk (via the `--font-body` fallback chain) — the control still works,
it just won't render in OpenDyslexic.
