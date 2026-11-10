# RolimBox design direction: Placar da Casa

**The concept in one sentence:** a stadium scoreboard that a sign painter hung on the wall of
grandma's house — strict black-and-chalk timing-tower grids, giant condensed numerals, one hot
pink signal, and a few loud hand-lettered words in Portuguese.

## What each moment should feel like

| Moment                | Feeling                       | How the UI gets there                                                                                                                                                      |
| --------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Opening before class  | Anticipation, a little dread  | The WoD lands as a **poster**: name fitted to the full width, format in a scoreboard strip, and a taped-on "VAI DOER" label naming the worst movement. Details come after. |
| Reading it in the box | Zero thinking from two metres | **Placar mode**: one section per screen, reps in a tower column, type scaled to fill the phone. Rows, hairlines and numbers, never paragraphs.                             |
| Timer running         | Adrenaline, tunnel vision     | A **tower clock**: minutes stacked over seconds, as tall as the phone. The whole screen changes colour on phase changes. One slab-sized button for the one thing you need. |
| Finishing             | Earned pride                  | A **finish line**, not a dialog: chequered band, pink flood, the result as big as the clock was, a hand-painted "ACABOU!", and "Manda no grupo" to share it.               |
| Coach programming     | The craft of a good tool      | Everything editable in place, a live preview of the athletes' board, keyboard shortcuts, nothing modal.                                                                    |

## Type

Three faces, all self-hosted (work offline), each with one job:

- **Archivo (variable, width 62–125)** is the scoreboard. Width 62 / weight 900, upper-case, for
  names, numerals and the clock (tabular figures). Width 100 / weight 500 for anything people read.
- **Martian Mono (variable, width 75)** is the instrument legend: small upper-case labels,
  indexes (`01`, `02`), formats, status. Never below 11px, always tracked out.
- **Londrina Solid Black** is the sign painter. Londrina was drawn from São Paulo street
  lettering. It is used for at most one phrase per screen, tilted, with a hard drop shade:
  _Vai doer_, _Bora!_, _Acabou!_, _Descanso_. If a screen has two, one is wrong.

## Colour

Two grounds and one signal. **Pink means move.**

- **Noite** (dark, default in a dark environment): floor `#0C0C0D`, chalk `#F3EFE6`.
- **Sol** (light, for the morning sun in the box): whitewash `#F1EDE3`, ink `#0E0E10`.
  Follows the system, can be forced in Settings.
- **Pink `#FF2E93`** (the existing RolimBox pink, turned up): the main WoD, today, GO, the work
  phase, the finish. Text on pink is always black (5.7:1). Pink is never decoration.
- **Hazard yellow `#FFC400`** means stop or careful: paused, offline, the "vai doer" tape.
  Red is only for destroying things and refused changes. Green only confirms.
- No gradients, no shadows, no blur. Depth comes from hairlines and solid blocks.

## Grid and shape

- A visible 4-column grid on phones, 12 on desktop, 16px gutters. Modules are separated by 1px
  hairlines and 2px rules, not by cards. Corners are square (2px at most).
- Every module is labelled like a panel on an instrument: mono legend top-left, index or value
  top-right.
- Buttons are 56px tall, small controls never under 44px; the primary action of a screen is a
  full-width slab of 72px or more, anchored where a thumb or a chalky knuckle lands.
- Numbers are right-aligned or in their own column. Reps never sit inside a sentence.

## Motion

- **Hard cuts.** State changes are instant colour changes or mechanical moves of 120–180ms.
  No opacity fades, no springs, no parallax.
- Things arrive the way a scoreboard updates: a shutter wipe (clip-path), a slam (scale 1.12 → 1),
  a slap (the tape rotates in).
- The clock never animates its digits. Only the frame around them moves: the screen floods pink
  on GO / work / new round, the last ten seconds beat once per second.
- `prefers-reduced-motion`: every animation is removed. Phase changes stay as plain colour cuts,
  which is information, not decoration.

## Signature moments (the screenshots people send)

1. **The reveal.** First open of the day: date stamp, then the name slams in at full width, the
   format strip shutters open, and the yellow "VAI DOER: THRUSTERS" tape slaps on crooked.
2. **The tower clock.** `04` over `32`, each digit pair as wide as the phone, the screen flooding
   pink at "BORA!" and on every new round.
3. **The finish line.** Chequered band, pink flood, `ACABOU!` in sign paint, the final time in
   black, and a "Manda no grupo" button that shares the result with the family chat.

## Rules of thumb

- If a screen could belong to a SaaS dashboard, it is wrong: remove the card, show the grid.
- English for function (CrossFit's own vocabulary), Portuguese for voice. One painted phrase per
  screen.
- Legibility beats style every time: chalk on floor is 17:1, ink on whitewash 16:1, small text
  never below 4.5:1, nothing important smaller than 15px.
