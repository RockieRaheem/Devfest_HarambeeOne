---
name: Human-Centric Harmony
colors:
  surface: '#f7f9ff'
  surface-dim: '#d8dadf'
  surface-bright: '#f7f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f1f4f9'
  surface-container: '#eceef3'
  surface-container-high: '#e6e8ee'
  surface-container-highest: '#e0e2e8'
  on-surface: '#181c20'
  on-surface-variant: '#43474c'
  inverse-surface: '#2d3135'
  inverse-on-surface: '#eef1f6'
  outline: '#73777d'
  outline-variant: '#c3c7cc'
  surface-tint: '#4b6174'
  primary: '#32485a'
  on-primary: '#ffffff'
  primary-container: '#4a6073'
  on-primary-container: '#c3daf0'
  inverse-primary: '#b2c9df'
  secondary: '#5e5f5d'
  on-secondary: '#ffffff'
  secondary-container: '#e0e0dd'
  on-secondary-container: '#626361'
  tertiary: '#454649'
  on-tertiary: '#ffffff'
  tertiary-container: '#5c5e60'
  on-tertiary-container: '#d7d7da'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#cee5fc'
  primary-fixed-dim: '#b2c9df'
  on-primary-fixed: '#041d2e'
  on-primary-fixed-variant: '#33495b'
  secondary-fixed: '#e3e2e0'
  secondary-fixed-dim: '#c7c6c4'
  on-secondary-fixed: '#1a1c1a'
  on-secondary-fixed-variant: '#464745'
  tertiary-fixed: '#e2e2e5'
  tertiary-fixed-dim: '#c6c6c9'
  on-tertiary-fixed: '#1a1c1e'
  on-tertiary-fixed-variant: '#454749'
  background: '#f7f9ff'
  on-background: '#181c20'
  surface-variant: '#e0e2e8'
typography:
  display-lg:
    fontFamily: Source Serif 4
    fontSize: 48px
    fontWeight: '600'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Source Serif 4
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Source Serif 4
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
  headline-md:
    fontFamily: Source Serif 4
    fontSize: 24px
    fontWeight: '500'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
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
  base_unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 48px
  xxl: 80px
  container_max: 1280px
  gutter: 24px
  margin_mobile: 16px
---

## Brand & Style

This design system is built upon the principles of **Sophisticated Editorialism** and **Empathetic Finance**. It departs from the cold, neon-inflected aesthetics of modern fintech in favor of a grounded, high-end educational experience. The visual language balances the authority of a traditional broadsheet with the fluid usability of a modern digital interface.

The target audience consists of individuals seeking financial literacy and management tools that respect their cognitive load. The emotional response should be one of "quiet confidence"—users should feel guided, not pressured. 

**Core Design Tenets:**
- **Intentional Whitespace:** Large margins and generous gutters to reduce decision fatigue.
- **Modern Professionalism:** A mix of Corporate Modern and Minimalism, utilizing high-quality typography as the primary decorative element.
- **Tactile Softness:** Elements utilize subtle shadows and soft radii to feel approachable and physical.

## Colors

The palette is anchored in high-contrast readability and warm, organic tones. 

- **Primary (Slate Blue):** Used for primary actions, branding moments, and active states. It conveys stability and institutional trust.
- **Secondary (Off-White):** The foundational surface color. It is softer on the eyes than pure #FFFFFF and provides a "paper-like" quality to the interface.
- **Tertiary (Charcoal):** Reserved for primary headings and body text to ensure maximum WCAG AAA accessibility.
- **Accents:** We utilize muted, desaturated tones for feedback. **Sage Green** indicates positive growth or success, while **Clay Red** highlights alerts without inducing panic.

Avoid pure black or pure white. Use subtle transparency (low-opacity borders) to allow the off-white background to influence the tone of nested elements.

## Typography

This system employs a "Serif-to-Sans" hierarchy to distinguish content from interface.

- **Headlines (Source Serif 4):** Use these for editorial titles, section headers, and significant data points. The optical sizing of Source Serif 4 should be leveraged to maintain weight at smaller sizes.
- **UI & Body (Inter):** All interactive elements, labels, and long-form body text use Inter. Its high x-height ensures clarity in dense financial tables and data grids.
- **Leading & Tracking:** For Display styles, use slight negative letter-spacing to create a tighter, more "designed" look. For labels and small UI text, use slight positive tracking to improve legibility on low-resolution displays.

## Layout & Spacing

The layout philosophy follows a **4px geometric scale**, emphasizing breathing room over information density.

- **Grid:** Use a 12-column fluid grid for desktop with 24px gutters. For mobile, transition to a 4-column grid with 16px margins.
- **Rhythm:** Vertical rhythm is controlled by the `lg` (24px) and `xl` (48px) units. Use `xl` to separate major content sections and `md` to group related elements within a section.
- **Intentionality:** Avoid "filling" the screen. On desktop, maintain a maximum content width of 1280px, centering the layout to preserve the editorial feel.

## Elevation & Depth

Visual hierarchy is established through **Ambient Depth**—a combination of multi-layered shadows and low-opacity strokes.

- **The Layering Rule:** Use the `#1A1C1E` charcoal at very low opacities (e.g., 4% to 8%) for borders instead of solid grays. This allows the background color to bleed through, creating a more integrated look.
- **Shadows:** Avoid single, heavy shadows. Instead, use "Soft Stack" shadows:
    - *Layer 1:* 0px 2px 4px rgba(0,0,0, 0.02)
    - *Layer 2:* 0px 8px 16px rgba(0,0,0, 0.04)
- **Tonal Layers:** Deeply nested elements (like inner cards) should utilize a slightly different tint—either 2% darker or 2% lighter than the parent surface—to signify depth without relying on shadows alone.

## Shapes

The shape language is consistently **Rounded**, avoiding sharp corners to maintain an empathetic and approachable feel.

- **Primary Containers:** Use `rounded-lg` (16px) for main cards and dashboard sections.
- **UI Elements:** Use `rounded` (8px) for buttons, input fields, and smaller modules.
- **Iconography:** Use a 2px stroke weight with rounded caps and joins to match the softening of the UI borders.

## Components

### Buttons
- **Primary:** Solid `#4A6073` with white Inter-medium text. 12px vertical padding, 24px horizontal.
- **Secondary:** Transparent background with a 1px border (`#4A6073` at 20% opacity).
- **Tertiary/Ghost:** Text-only with a subtle background hover state (Secondary color at 5% opacity).

### Input Fields
- **Styling:** 1px border in Charcoal at 10% opacity. On focus, the border thickens to 2px in Slate Blue with a subtle blue outer glow (4px spread).
- **Labels:** Always use `label-md` positioned above the input field, never as placeholder text.

### Cards
- **Structure:** 16px corner radius, 24px internal padding.
- **Border:** A constant 1px low-opacity charcoal border to define the edge against the off-white background.

### Chips & Tags
- **Education Tags:** Use `label-sm` text. Tags should have a 10% opacity background of the brand color to distinguish them from interactive buttons.

### Financial Lists
- **Data Rows:** Use subtle 1px horizontal dividers. Ensure `body-md` is used for primary data and `label-sm` for secondary metadata (e.g., timestamps or categories).