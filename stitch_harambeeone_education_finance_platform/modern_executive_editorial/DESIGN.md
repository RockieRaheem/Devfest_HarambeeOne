---
name: Modern Executive Editorial
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#45464d'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#1d4ed8'
  on-secondary: '#ffffff'
  secondary-container: '#4069f2'
  on-secondary-container: '#fffbff'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#002114'
  on-tertiary-container: '#069669'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#dce1ff'
  secondary-fixed-dim: '#b7c4ff'
  on-secondary-fixed: '#001551'
  on-secondary-fixed-variant: '#0039b5'
  tertiary-fixed: '#85f8c4'
  tertiary-fixed-dim: '#68dba9'
  on-tertiary-fixed: '#002114'
  on-tertiary-fixed-variant: '#005137'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Public Sans
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  display-sm:
    fontFamily: Public Sans
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  display-sm-mobile:
    fontFamily: Public Sans
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 34px
    letterSpacing: -0.015em
  headline-lg:
    fontFamily: Public Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Public Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Public Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
  tabular-numeric:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: -0.01em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system establishes an institutional-grade financial standard tailored for educational governance and fiscal management. Combining the crisp structural clarity of Swiss modernism with the dynamic precision of tier-one fintech interfaces, the aesthetic balances high-density utility with executive poise. 

The emotional tone is authoritative, luminous, and calm. We completely reject the sterile emptiness of stark unstyled wireframes and the degraded legibility of faux-vintage palettes. Instead, interfaces project computational authority through deliberate surface contrast, razor-sharp typographic scale, optical hierarchy, and intentional whitespace.

Key architectural tenants:
- **Luminous Comfort:** Utilizing soft mist neutrals for extensive canvas backdrops to dramatically cut down optical glare during long operational shifts.
- **Architectural Elevation:** Distinct layering through pure white elevated planes, crisp micro-borders, and diffused multi-tier ambient shadows.
- **High-Velocity Scanning:** Dense tabular and analytical arrangements framed by ample rhythmic padding to support zero-error operational workflows.

## Colors

The palette operates on a strict functional hierarchy designed to communicate stability, dynamic state feedback, and institutional trust:

- **Canvas & Primary Ink:** 
  - Base canvas is anchored in a soft mist `#f8fafc` to `#f1f5f9` range, reducing eye fatigue.
  - Surface cards and interactive panels sit in pure `#ffffff` to create immediate visual lift.
  - Primary text and structural borders leverage Deep Obsidian Navy (`#0f172a`), providing decisive contrast without the harshness of pure black.

- **Interactive Accent (Imperial Cobalt):**
  - `#1d4ed8` anchors interactive primary affordances, active navigational indicators, and high-priority states.
  - Interactive hover transitions shift to `#2563eb`, with translucent focus halos structured with 15% alpha tints.

- **Financial Integrity & Reconciled States (Trust Emerald):**
  - `#059669` is reserved for fiscal balances, completed ledger events, positive yield trends, and compliant statuses. Accompanied by `#ecfdf5` background tints for pill badges.

- **Operational Risk & Exceptions:**
  - Amber (`#d97706`) signals pending disbursements, compliance warnings, or unmatched invoices.
  - Crimson (`#dc2626`) is strictly disciplined, triggered only for audit discrepancies, default risks, or critical system alerts.

- **System Slate Hierarchy:**
  - Primary Labels / Headers: `#0f172a`
  - Secondary Data / Captions: `#475569`
  - Subtle Metadata / Placeholders: `#64748b`
  - Hairline Dividers: `#e2e8f0`

## Typography

The typographical engine leverages the geometric authority of **Public Sans** for display, structural headings, and metric callouts, paired seamlessly with **Inter** for data tables, micro-copy, and form controls.

Typographic Rules:
- **Tabular Alignment:** All financial, numeric, date, and identification figures must enforce `font-feature-settings: "tnum" 1, "cv05" 1` to guarantee rigid vertical alignment across accounts, ledger lines, and statistical summaries.
- **Editorial Micro-Caps:** Status pills, tabular headers, and analytical meta-labels utilize `label-sm` or `label-md` with controlled uppercase transformation and expanded letter spacing (`+0.02em` to `+0.04em`) to establish crisp section delineations.
- **Contrast Ratios:** Pure text never drops below `#475569` against canvas surfaces, strictly maintaining WCAG AAA compliant optical ratios for critical workflows.

## Layout & Spacing

The layout model is governed by an 8pt architectural rhythm structured across a 12-column fluid grid.

Breakpoints & Grids:
- **Desktop (>= 1280px):** 12-column grid, max canvas clamp of `1536px`, outer page margins at `space-xl` (`2.5rem`), column gutters at `gutter` (`1.5rem`).
- **Tablet (768px - 1279px):** 8-column layout, adaptive side-rail collapses to icon-rail, outer margin at `margin` (`2rem`).
- **Mobile (< 768px):** 4-column layout, edge margins adjust to `margin-mobile` (`1rem`), card gutters drop to `gutter-mobile` (`1rem`). Complex tables reflow to structured card-stack lists with sticky key indicators.

Layout Philosophy:
- **Component Padding:** Functional cards employ `space-lg` internal breathing room; compact ledger rows utilize `space-md` vertical padding for optimal scan-to-touch area balance.
- **Visual Chunking:** Group related metric panels and reconciliation summaries using consistent vertical rhythm (`space-lg`), separating disparate functional groups with `space-xl`.

## Elevation & Depth

Visual hierarchy uses physical depth without heavy, dated drop shadows. Depth is achieved via crisp hairline surface boundaries paired with soft, low-opacity ambient occlusion.

Surface Layering Architecture:
- **Level 0 (Canvas Base):** Background wash in `#f8fafc`. Flat, absorbing, and non-reflective.
- **Level 1 (Card & Module Surfaces):** Pristine `#ffffff` fill framed with a hairline border (`1px solid #e2e8f0`) and subtle ambient depth:
  `box-shadow: 0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.02)`.
- **Level 2 (Interactive Hover & Flyouts):** Active state for cards, popovers, and table floating toolbars:
  `box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.06), 0 2px 4px -2px rgba(15, 23, 42, 0.04)`.
  Hairline border elevates subtly to `#cbd5e1`.
- **Level 3 (Modals & Command Palettes):** Deep visual separation:
  `box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.04)`.
  Accompanied by a 20% backdrop-blur mist (`backdrop-filter: blur(8px); background: rgba(15, 23, 42, 0.4)`).

## Shapes

The geometric form language adopts a refined, soft-cornered modernist stance (`roundedness: 1`), reinforcing precision, discipline, and architectural authority:

- **Base Elements (Buttons, Inputs, Checkboxes):** Formed with `rounded` (`0.25rem` / `4px`) to `rounded-md` (`0.375rem` / `6px`) radii. This preserves sharp silhouette delineation across dense data screens.
- **Structural Containers (Cards, Modals, Panels):** Formed with `rounded-lg` (`0.5rem` / `8px`) radii, providing a tailored, premium framework without excessive circular softness.
- **Pills & Status Chips:** Fully radiused (`9999px`) to immediately distinguish contextual status badges from actionable rectangular components.

## Components

### Buttons & Interactive Triggers
- **Primary:** Background `#0f172a`, text `#ffffff`, hairline border transparent. Subtle hover transition to `#1e293b`. For distinct kinetic accent flows, background `#1d4ed8` transitioning to `#2563eb`. Height: 36px (compact) or 40px (standard).
- **Secondary / Outline:** Background `#ffffff`, text `#0f172a`, border `1px solid #e2e8f0`. Hover initiates `#f8fafc` background and `#cbd5e1` border tint.
- **Ghost / Tertiary:** Background transparent, text `#475569`. Hover triggers `#f1f5f9` fill with `#0f172a` text color.

### Form Inputs & Controls
- **Text Inputs:** Pristine white background, `1px solid #cbd5e1` border, 8px horizontal padding, 6px border-radius. Inactive text `#0f172a`, placeholder `#94a3b8`.
- **Focus State:** Razor-sharp focus ring: border changes to `#1d4ed8`, accompanied by an outer micro-glow `box-shadow: 0 0 0 3px rgba(29, 78, 216, 0.12)`.
- **Checkboxes & Radios:** High-contrast slate check indicator on `#0f172a` fill when active; subtle `#cbd5e1` border on pure white when unchecked.

### Badges & Pill Chips
- **Reconciled / Healthy:** Emerald text `#059669` nested inside `#ecfdf5` fill with a fine `1px solid #a7f3d0` stroke. Includes a 6px solid emerald status dot.
- **Pending / In Review:** Amber text `#b45309` nested inside `#fffbeb` fill with `1px solid #fde68a` stroke.
- **Risk / Discrepancy:** Crimson text `#b91c1c` nested inside `#fef2f2` fill with `1px solid #fecaca` stroke.
- **Neutral / Metadata:** Slate text `#475569` nested inside `#f1f5f9` fill with `1px solid #e2e8f0` stroke.

### Cards & Executive Metric Blocks
- Pure white container with standard Level 1 elevation and hairline border.
- Header row features clean micro-caps label (`label-sm`), trailing action or icon, followed by an authoritative primary metric in `display-sm` (`Public Sans`, 32px).
- Bottom edge accommodates mini trend indicators (percentage deltas with inline sparklines or micro-progress tracks).

### Tabular Ledger Architecture
- Header rows utilize `#f8fafc` background, `1px solid #e2e8f0` bottom divider, with uppercase tracking on `label-sm` labels (`#64748b`).
- Row items feature alternating subtle hover states (`#f8fafc`), `48px` row heights for standard density, with strict numerical right-alignment and currency code normalization.