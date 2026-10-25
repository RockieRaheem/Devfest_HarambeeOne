---
name: Harambee Ledger
colors:
  surface: '#fcf9f5'
  surface-dim: '#dcdad6'
  surface-bright: '#fcf9f5'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3ef'
  surface-container: '#f0edea'
  surface-container-high: '#ebe8e4'
  surface-container-highest: '#e5e2de'
  on-surface: '#1c1c1a'
  on-surface-variant: '#43474e'
  inverse-surface: '#31302e'
  inverse-on-surface: '#f3f0ec'
  outline: '#74777f'
  outline-variant: '#c4c6cf'
  surface-tint: '#455f88'
  primary: '#002045'
  on-primary: '#ffffff'
  primary-container: '#1a365d'
  on-primary-container: '#86a0cd'
  inverse-primary: '#adc7f7'
  secondary: '#605e59'
  on-secondary: '#ffffff'
  secondary-container: '#e6e2db'
  on-secondary-container: '#66645f'
  tertiary: '#321b00'
  on-tertiary: '#ffffff'
  tertiary-container: '#4f2e00'
  on-tertiary-container: '#c6955e'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d6e3ff'
  primary-fixed-dim: '#adc7f7'
  on-primary-fixed: '#001b3c'
  on-primary-fixed-variant: '#2d476f'
  secondary-fixed: '#e6e2db'
  secondary-fixed-dim: '#cac6c0'
  on-secondary-fixed: '#1c1c18'
  on-secondary-fixed-variant: '#484742'
  tertiary-fixed: '#ffddba'
  tertiary-fixed-dim: '#f2bc82'
  on-tertiary-fixed: '#2b1700'
  on-tertiary-fixed-variant: '#633f0f'
  background: '#fcf9f5'
  on-background: '#1c1c1a'
  surface-variant: '#e5e2de'
typography:
  headline-xl:
    fontFamily: Source Serif 4
    fontSize: 40px
    fontWeight: '600'
    lineHeight: 48px
  headline-xl-mobile:
    fontFamily: Source Serif 4
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 38px
  headline-lg:
    fontFamily: Source Serif 4
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Source Serif 4
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 34px
  headline-md:
    fontFamily: Source Serif 4
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Source Serif 4
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 28px
  body-lg:
    fontFamily: Public Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
  body-md:
    fontFamily: Public Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Public Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Public Sans
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.06em
  label-sm:
    fontFamily: Public Sans
    fontSize: 10px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.08em
  numeric-data:
    fontFamily: Public Sans
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: -0.01em
spacing:
  gutter: 1.5rem
  margin: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system conveys institutional permanence, meticulous stewardship, and intellectual clarity. Designed for educational administrators, bursars, and council members in Uganda, the visual language departs entirely from ephemeral tech aesthetics to honor the gravity of physical ledgers, institutional charters, and academic governance.

The aesthetic philosophy is **Editorial Neoclassical**:
- **Human-Crafted Permanence**: Interfaces feel printed onto heavy, warm-wove paper rather than projected onto illuminated glass.
- **Physical Ledger Structure**: Information is organized via ruled lines, clear typographic alignments, and deliberate ledger columns rather than floating cards or plastic drop shadows.
- **Dignified Restraint**: Color is withheld as an instrument of necessity, applied strictly to mark active verification, critical reconciliation, or authoritative signatures.

## Colors

The palette simulates the tactile reality of archival document stocks, carbon ink, and official municipal stamps. It eschews pure synthetic blacks and high-vibrancy accents in favor of light-absorbing earth and mineral tones.

### Palette Architecture
- **Primary Ink (`#1a365d`)**: Oxford Navy. Reserved exclusively for definitive actions, active selection states, verified school marks, and formal focus indicators. It acts as an authoritative institutional seal.
- **Neutral Core (`#1c1c1a`)**: Charcoal Carbon. Used for body text, numerical ledger records, table headers, and structural linework requiring absolute clarity.
- **Secondary Ink (`#62605b`)**: Muted Slate. Used for metadata, column sub-units, ledger timestamps, and secondary operational guidance.
- **Paper Stocks**:
  - Base Document Canvas: `#ffffff`
  - Subtle Ledger Fill (Tint 1): `#fbfbfa`
  - Structural Recess & Well (Tint 2): `#f7f7f6`
  - Ruled Hairline Border: `#e8e7e4`

### Application Rules
- Disallow full-bleed saturated fills; keep interactive buttons dense and matte.
- Disallow multi-color status pill collections. Status states must rely on typography, ruled brackets, or stamped seals utilizing `#1a365d` for verified records and `#62605b` for pending entries.

## Typography

The typographic hierarchy pairs the editorial discipline of **Source Serif 4** with the institutional utility of **Public Sans**. 

### Typographic Principles
- **Headlines (Source Serif 4)**: Applied to page titles, ledger summary titles, and school term headings. Conveys academic gravitas and historical continuity.
- **Body & Controls (Public Sans)**: Engineered for maximum legible clarity under bright sunlight and across modest display hardware.
- **Tabular Numerics**: All currency figures, enrollment counts, and bursary balance amounts must enforce font feature settings `font-variant-numeric: tabular-nums` to guarantee vertical decimal alignment across ledgers.
- **Caps & Spacing**: All micro-labels, ledger balance indicators, and table headers must be rendered in uppercase with deliberate tracking (`0.06em` to `0.08em`) to echo traditional bookbinding labels.

## Layout & Spacing

Layouts follow an editorial broadsheet cadence rather than fragmented application dashboards. 

### Grid Architecture
- **Desktop (1200px and up)**: 12-column grid, `margin: 2.5rem`, `gutter: 1.5rem`. Layouts prioritize structured dual-pane sheets (e.g., Ledger Registry left, Transaction Detail right).
- **Tablet (768px - 1199px)**: 8-column grid, `margin: 2rem`, `gutter: 1.25rem`. Complex sheets stack vertically into indexed ledger bands.
- **Mobile (below 768px)**: 4-column grid, `margin: 1rem`, `gutter: 1rem`. Tabular grids reflow into ruled list manifests with clear key-value alignments.

### Rhythm & Alignment
- Margins and paddings prioritize vertical pacing: generous space surrounds high-level summaries, while tabular rows remain compact and information-dense (`space-sm` vertical padding).
- Content zones are grouped using edge-to-edge `#e8e7e4` horizontal ruling rather than floating containers.

## Elevation & Depth

This design system rejects synthetic drop shadows, elevated layered z-indexes, and blur filters. Depth is established through **tonal layers** and **ruled hairlines**.

### Surface Hierarchy
- **Canvas Base**: `#ffffff` serves as the primary document plane.
- **Document Wells (`#fbfbfa`)**: Applied to side navigation, summary ledger footers, and table alternating strips to create subtle grounding.
- **Secondary Recesses (`#f7f7f6`)**: Applied to read-only fiscal calculation wells, audit detail backdrops, and disabled field enclosures.
- **Hairline Partitioning**: A single 1px solid border (`#e8e7e4`) provides structural definition. No element carries multiple outline weights.
- **Layer Stacking**: Elevated modals or sliding ledger drawers use a solid `#ffffff` fill framed by a crisp 1px `#1c1c1a` boundary line, accompanied by a flat, unblurred offset shadow: `box-shadow: 4px 4px 0px 0px rgba(28, 28, 26, 0.08)`.

## Shapes

The shape system is strictly architectural (`roundedness: 0`).

- **Sharp Geometry**: All containers, inputs, table rows, buttons, and stamp badges feature square `0px` corners.
- **Philosophy**: Avoids soft or pill-shaped containers to preserve the structured, formal character of physical fiscal reports, municipal certificates, and binding documents.
- **Separators**: Linear dividers are exactly 1px thick, spanning full component widths.

## Components

### Buttons
- **Primary**: Solid `#1a365d` background, `#ffffff` text, square corners, 0px border. Padding: `0.625rem 1.25rem`. Text: `Public Sans`, 13px, weight 600, uppercase, letter-spacing `0.05em`. Active press shifts the element 1px down and right.
- **Secondary / Ledger Action**: `#ffffff` background, 1px solid `#1c1c1a` border, `#1c1c1a` text. Hover shifts background to `#fbfbfa`.
- **Tertiary**: Transparent background, underline text decoration in `#62605b`, hovering to `#1a365d`.

### Input Fields & Controls
- **Text Inputs**: Flat `#ffffff` background, bounded by a 1px `#e8e7e4` hairline border on top, right, and left, with a prominent 1.5px `#62605b` bottom rule. On focus, the entire border shifts to 1px `#1a365d` with zero blur halo.
- **Checkboxes & Radios**: Rigid square boxes (16x16px), 1px solid `#62605b` border, `#ffffff` background. When checked, the box is solid `#1a365d` with a sharp, geometric white checkmark.

### Tabular Ledger (Data Tables)
- **Table Header**: Background `#fbfbfa`, 1px solid `#e8e7e4` top and bottom rules. Text is uppercase `Public Sans` 11px, weight 600, color `#62605b`.
- **Table Rows**: Minimal height (44px), alternating with `#ffffff` and transparent `#fbfbfa`. Separated by a hairline 1px `#e8e7e4` rule.
- **Ledger Alignment**: Text aligns strictly left; currency and numerical balances align strictly right and utilize `font-variant-numeric: tabular-nums`.

### Cards & Document Folios
- Cards avoid floating elevation. They are structured as **Document Folios**: a `#ffffff` body framed by a 1px `#e8e7e4` perimeter border, featuring an optional `#fbfbfa` header block separated by a hairline rule.

### Stamped Verification Indicators
- Replaces standard SaaS notification pills.
- Rendered as a rectangular bordered stamp: 1px solid border in `#1a365d` (Verified) or `#62605b` (Pending/Audited).
- Text: 10px uppercase `Public Sans`, tracking `0.1em`. Embedded with an ink-stamp texture simulation using high contrast and subtle border inset rules.