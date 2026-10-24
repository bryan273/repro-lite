# Repro Lite Design

## Direction & Layout
- Purpose: an honest, calm lab notebook for checking one small research claim in the browser. Mood: academic, restrained, trustworthy. It should feel like a careful referee's report, not a flashy AI product.
- Defining idea: the hero is a large Fraunces headline on the left (60%) with the claim form as a paper-like sheet on the right (40%). Below it, a vertical numbered "lab protocol" timeline (Plan, Write and run, Clean re-run, Audit, Verdict) with a thin blue spine.
- Reference: printed journal referee reports and the Distill.pub article layout.
- Max width 1120px; 12-column grid on desktop, single column below 900px. Section spacing 72px desktop and 48px mobile; card gap 20px.
- Breakpoints: 390 (mobile, padding 16px), 640, 900 (two columns), 1120. Code blocks wrap or scroll inside their own box only. The page never scrolls horizontally.
- Do: thin hairline borders, numbered steps, tabular numbers for metrics. Don't: gradients, glow, glassmorphism, emoji, purple, or colored left-border cards.

## Tokens
- Light: bg #F6F8FB, surface #FFFFFF, surface-2 #EEF2F7, border #DCE3EC, text #14202E, text-muted #5B6878, primary #1F5FA8, primary-hover #184C87, primary-soft #E3EDF9.
- Dark: bg #0E141B, surface #151D27, surface-2 #1C2633, border #2A3646, text #E6ECF3, text-muted #93A1B3, primary #6FA3E0, primary-soft #1A2B40.
- Status colors: reproduced #1E7A4F, partial #A66A00, not reproduced #B4372F, could not run #5B6878. Each is used only on its verdict badge and verdict card.
- Type: headlines in Fraunces (600; display 52/1.05, h2 30/1.2, h3 20/1.3); body in IBM Plex Sans (400/500, 16/1.6); captions 13/1.5; code in IBM Plex Mono 13/1.55.
- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 72. Radii: buttons and inputs 8px, cards 12px, badges 999px.
- Elevation: 1px borders by default; one subtle shadow (0 1px 2px rgba(20,32,46,.06)) on cards; a sticky header with a bottom border.

## Shared Patterns & States
- StepCard: a numbered circle (32px) on the spine with a title and a status (waiting, running with a spinner, done, failed).
- Timeline entry: tool name, a code block (a collapsible pre element) and the stdout/stderr output in a muted box. stderr text uses the not-reproduced color.
- VerdictCard: a large status label, a measured vs target grid in tabular numbers, and a list of flags.
- Gallery card: the claim (3 lines max), a verdict badge and the measured value.
- States: a friendly notice for rate limits (429), an empty gallery state and a disabled run button while running. Focus ring: 2px primary with a 2px offset. Tap targets are at least 40px.
- Motion: 150ms ease-out color transitions only. No reveal animations.

## Media
- An operational tool, so no photography is used. The visual identity comes from typography and the protocol timeline.
