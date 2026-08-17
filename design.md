# Design spec — "Vidiprinter" theme

Concept: old-school BBC football vidiprinter / scoreboard under floodlights. Dark pitch-green background, phosphor-green ticker text, amber scoreboard accents. Not a generic dark mode — it should feel specifically like football results coming through on a teleprinter.

## Colour palette

| Role | Hex | Use |
|---|---|---|
| Background | `#0B1210` | page background |
| Panel background | `#101B17` | cards/panels |
| Panel border | `#1E2C27` | borders, dividers |
| Input/button background | `#0B1512` | text inputs, unselected buttons |
| Input/button border | `#274238` | default border on inputs/buttons |
| Ticker background | `#060A08` | vidiprinter strip |
| Primary accent (green) | `#39FF6A` | selected states, alive/success, ticker text |
| Secondary accent (gold) | `#F2B705` | headings/eyebrows, current-pick highlight |
| Danger (red) | `#E5484D` | eliminated/out states |
| Text primary | `#EDEDED` / `#F5F5F0` | body text, headings |
| Text muted | `#7F9089` | secondary/help text |
| Text faint | `#55655D` | "v" separators, tertiary labels |

## Typography
Google Fonts: `Teko` (display), `IBM Plex Sans` (body/UI), `IBM Plex Mono` (data/ticker/labels).

```css
@import url('https://fonts.googleapis.com/css2?family=Teko:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
```

- **Teko** — page title / big headings, condensed athletic look, letter-spacing ~0.5px
- **IBM Plex Sans** — everything else (buttons, body copy, player names)
- **IBM Plex Mono** — eyebrows/labels (uppercase, small, letter-spaced), the ticker feed, secondary data like used-team lists and points

## Signature component: the vidiprinter ticker
A scrolling strip under the header showing recent results/eliminations, phosphor green on near-black, monospace, items separated by `***`. Should auto-scroll continuously (CSS `@keyframes` translateX loop); respect `prefers-reduced-motion` by disabling the animation.

```
RICH ELIMINATED (Wolves)  ***  MARTIN WINS RUN 3!  ***  KEV ELIMINATED (Stoke)
```

## Component states
- **Team pick button**: default = dark bg, `#274238` border, `#EDEDED` text. Selected = `#39FF6A` border + text, translucent green fill. Used/disabled = 35% opacity, strikethrough, not clickable.
- **Player select button** (screen 1): same pattern but gold (`#F2B705`) for selected instead of green, since it's a different kind of choice (identity, not a pick).
- **Eyebrow labels**: small, uppercase, monospace, letter-spaced, gold (`#F2B705`) — used above every section to label what it is (e.g. "WEEK 6 · ONE WINNER FROM EACH LEAGUE").
- **Alive/eliminated chips** (leaderboard): pill-shaped, green outline+text for alive, red outline+text+strikethrough for eliminated.
- **Tabs**: plain text buttons, active tab gets a 2px gold bottom border, inactive tabs are muted grey text.

## Reference implementation
A full working example of this theme already exists — the interactive mockup and the earlier artifact both use this exact palette/fonts/component styling. Point Claude Code at the mockup shown earlier in this chat, or paste it this file plus ask it to match the vidiprinter aesthetic described above when it rebuilds the current black-and-white screens.
