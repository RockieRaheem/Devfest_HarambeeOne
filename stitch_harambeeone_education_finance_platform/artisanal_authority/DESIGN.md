---
name: Artisanal Authority
colors:
  surface: '#faf9f7'
  surface-dim: '#dadad8'
  surface-bright: '#faf9f7'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f3f1'
  surface-container: '#efeeec'
  surface-container-high: '#e9e8e6'
  surface-container-highest: '#e3e2e0'
  on-surface: '#1a1c1b'
  on-surface-variant: '#43474f'
  inverse-surface: '#2f3130'
  inverse-on-surface: '#f1f1ef'
  outline: '#747780'
  outline-variant: '#c4c6d0'
  surface-tint: '#405f91'
  primary: '#001736'
  on-primary: '#ffffff'
  primary-container: '#002b5b'
  on-primary-container: '#7594ca'
  inverse-primary: '#a9c7ff'
  secondary: '#506354'
  on-secondary: '#ffffff'
  secondary-container: '#d0e5d2'
  on-secondary-container: '#546758'
  tertiary: '#271209'
  on-tertiary: '#ffffff'
  tertiary-container: '#3f261c'
  on-tertiary-container: '#b08b7d'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d6e3ff'
  primary-fixed-dim: '#a9c7ff'
  on-primary-fixed: '#001b3d'
  on-primary-fixed-variant: '#264778'
  secondary-fixed: '#d3e8d5'
  secondary-fixed-dim: '#b7ccb9'
  on-secondary-fixed: '#0e1f13'
  on-secondary-fixed-variant: '#394b3d'
  tertiary-fixed: '#ffdbce'
  tertiary-fixed-dim: '#e7beae'
  on-tertiary-fixed: '#2c160c'
  on-tertiary-fixed-variant: '#5d4034'
  background: '#faf9f7'
  on-background: '#1a1c1b'
  surface-variant: '#e3e2e0'
  deep-navy: '#002B5B'
  sage-earth: '#4A5D4E'
  clay-terracotta: '#8C6A5D'
  paper-white: '#F9F8F6'
  ink-black: '#1A1C1E'
  success-jewel: '#2D5A43'
  warning-ochre: '#B38B3F'
typography:
  headline-lg:
    fontFamily: Source Serif 4
    fontSize: 40px
    fontWeight: '600'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Source Serif 4
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Source Serif 4
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 34px
  headline-sm:
    fontFamily: Source Serif 4
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  margin-mobile: 24px
  margin-desktop: 64px
  gutter: 24px
  section-gap: 80px
  element-gap: 16px
---

## Brand & Style

The design system moves away from the cold, mechanical nature of standard educational portals toward a "Human-Crafted Institutional" aesthetic. It balances the gravity of a premium educational institution with the warmth of a supportive community.

The visual style is **Minimalism** infused with **Editorial** influences. It prioritizes "breathable" whitespace, allowing complex financial and academic data to exist without clutter. To evoke a sense of high-end craftsmanship, the design incorporates subtle grain textures on large surfaces and organic, slightly varied border-radii that feel hand-tuned rather than programmatically generated. The goal is to make the parent feel they are interacting with a curated experience, not just a database.

## Colors

The palette is anchored by the "HarambeeOne" Navy, refined here as **Deep Navy**. To soften its institutional edge, we introduce a suite of muted earth tones: **Sage Earth** for secondary actions and **Clay Terracotta** for tertiary accents. 

The background moves from a digital blue-white to **Paper White**, a warm, slightly desaturated neutral that reduces eye strain and feels more like high-quality stationery. Success and warning states eschew "traffic light" vibrancy for **Jewel-tone Emerald** and **Ochre**, maintaining functional clarity while adhering to a sophisticated, intentional aesthetic.

## Typography

This system utilizes a sophisticated pairing that echoes premium editorial design. **Source Serif 4** provides an authoritative yet warm voice for headlines, featuring optical sizes that ensure elegance at both display and sub-heading scales.

For UI elements and body copy, **Plus Jakarta Sans** offers a contemporary, approachable feel with high legibility. The type scale is intentionally generous, favoring larger line-heights to enhance the sense of "breathable" whitespace. Use `label-sm` in all-caps for metadata to create a distinct hierarchy against standard body text.

## Layout & Spacing

The layout philosophy centers on **High-End Editorial** principles. Rather than a dense grid, it uses a **Fixed Grid** on desktop (12 columns, 1140px max-width) with exceptionally wide margins to center the user's focus.

- **Rhythm**: A strict 8px spacing scale is used, but layout blocks are separated by "Section Gaps" (80px+) to create a feeling of luxury and calm.
- **Mobile**: Margins are increased to 24px (from the standard 16px) to give content more room to breathe.
- **Reflow**: On tablet and mobile, content should never feel cramped; prioritize vertical stacking over multi-column layouts to preserve the typographic integrity.

## Elevation & Depth

To avoid generic shadows, this design system uses **Ambient Shadows** that are tinted with the brand's Deep Navy color. This creates a "natural light" effect where objects feel like they are sitting on the Paper White surface rather than floating in a vacuum.

- **Surface Tiers**: Depth is primarily communicated through tonal layering. A "Level 1" surface might be a subtle shift from Paper White to a very light Sage tint (#F2F4F2).
- **Shadow Character**: Shadows are extremely diffused (e.g., 20px - 40px blur) with very low opacity (3-5%).
- **Low-Contrast Outlines**: Used in conjunction with shadows, a 1px border in a slightly darker version of the surface color defines boundaries without creating "heavy" boxes.

## Shapes

The shape language is **Rounded**, using a 0.5rem (8px) base. However, for large container elements like main cards or hero sections, use `rounded-xl` (1.5rem / 24px) to create a softer, more protective feel. 

To reinforce the "human-crafted" detail, interactive elements like buttons should have a slightly higher roundedness than the inputs they accompany, creating a subtle visual distinction between "containers" and "actions."

## Components

- **Buttons**: Primary buttons are solid **Deep Navy** with `body-md` bold text in white. They feature a generous 16px 32px padding to feel substantial and "clickable."
- **Input Fields**: Eschew the four-sided box where possible in favor of a bottom-border only style for a cleaner editorial look, or use a 1px border in a muted Sage tone with a 12px internal padding.
- **Cards**: These are the hallmark of the system. Use a white background, the brand's ambient shadow, and a 24px `rounded-xl` corner. No heavy borders.
- **Status Chips**: Use "Success Jewel" and "Warning Ochre" text on a very pale, desaturated version of the same hue. Use a `label-sm` weight for the text.
- **Lists**: Financial history should be presented with generous vertical padding (24px per row) and a hair-line divider in a soft neutral tone.
- **Subtle Texture**: Apply a very low-opacity noise/grain SVG overlay to the `neutral-color` background to give the digital screen a tactile, paper-like quality.