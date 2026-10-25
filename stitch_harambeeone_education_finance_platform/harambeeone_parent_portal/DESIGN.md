---
name: HarambeeOne Parent Portal
colors:
  surface: '#f8f9ff'
  surface-dim: '#d8dae0'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3f9'
  surface-container: '#eceef3'
  surface-container-high: '#e7e8ee'
  surface-container-highest: '#e1e2e8'
  on-surface: '#191c20'
  on-surface-variant: '#43474f'
  inverse-surface: '#2e3135'
  inverse-on-surface: '#eff0f6'
  outline: '#747780'
  outline-variant: '#c4c6d0'
  surface-tint: '#405f91'
  primary: '#001736'
  on-primary: '#ffffff'
  primary-container: '#002b5b'
  on-primary-container: '#7594ca'
  inverse-primary: '#a9c7ff'
  secondary: '#006d43'
  on-secondary: '#ffffff'
  secondary-container: '#99f2bd'
  on-secondary-container: '#0a7147'
  tertiary: '#390001'
  on-tertiary: '#ffffff'
  tertiary-container: '#600004'
  on-tertiary-container: '#ff5a4e'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d6e3ff'
  primary-fixed-dim: '#a9c7ff'
  on-primary-fixed: '#001b3d'
  on-primary-fixed-variant: '#264778'
  secondary-fixed: '#9cf5c0'
  secondary-fixed-dim: '#80d8a5'
  on-secondary-fixed: '#002111'
  on-secondary-fixed-variant: '#005231'
  tertiary-fixed: '#ffdad5'
  tertiary-fixed-dim: '#ffb4ab'
  on-tertiary-fixed: '#410002'
  on-tertiary-fixed-variant: '#930009'
  background: '#f8f9ff'
  on-background: '#191c20'
  surface-variant: '#e1e2e8'
  status-success: '#006d43'
  status-warning: '#d97706'
  status-error: '#ba1a1a'
  surface-card: '#ffffff'
  on-surface-subtle: '#43474f'
typography:
  headline-lg:
    fontFamily: Public Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Public Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Public Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Public Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Public Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Public Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  data-mono:
    fontFamily: Public Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Public Sans
    fontSize: 12px
    fontWeight: '500'
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
  unit: 4px
  margin-mobile: 16px
  margin-desktop: 24px
  gutter: 16px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style

The design system for the portal is built on a foundation of **Institutional Trust** and **Mobile Efficiency**. While the parent brand focuses on administrative robustness, this portal emphasizes accessibility and clarity for parents and guardians. The personality is supportive, transparent, and dependable.

The visual style is **Corporate / Modern** with a lean toward **Minimalism** to suit mobile constraints. By utilizing heavy whitespace and a restricted color palette, the UI reduces cognitive load for users who may be checking payment statuses or school notices on the go. The goal is to create a "frictionless utility" that feels high-end yet remains highly functional and inclusive.

## Colors

The palette is anchored by **Deep Navy (#002B5B)** to maintain brand authority and professional grounding. **Emerald Green (#006D43)** serves as the primary accent, used for "healthy" financial indicators and primary calls to action. 

The background uses a clean, near-white **Surface (#F8F9FF)** to ensure high-contrast readability against dark text. 

- **Payment Health Indicators**: 
    - **Success (Green)**: Indicates paid or on-track status.
    - **Warning (Amber)**: Indicates upcoming deadlines or partial payments.
    - **Error (Red)**: Indicates overdue balances or failed transactions.
- **Contrast**: To meet accessibility standards, all body text uses Deep Navy or high-density Grays against white card surfaces.

## Typography

**Public Sans** is the sole typeface for the design system. Its neutral, grotesque letterforms provide the clarity required for financial data while maintaining a modern, accessible feel.

The typography scale is designed for readability. On mobile devices, large headlines scale down to prevent awkward text wrapping. The `data-mono` role is specifically used for currency amounts and date-time strings to ensure vertical alignment and easy scanning in lists and tables.

## Layout & Spacing

The design system employs a **Fluid Grid** for mobile views and a **Fixed Grid** for desktop. 

- **Mobile (Default)**: A single-column layout with 16px side margins. Elements follow a "stack" rhythm based on a 4px baseline grid.
- **Desktop**: A 12-column grid centered in a 1200px container, with 24px margins.
- **Reflow Rules**: On mobile, sidebar navigation collapses into a bottom navigation bar or a hamburger menu. Data tables reflow into vertical cards to ensure financial figures remain legible without horizontal scrolling.

## Elevation & Depth

To maintain a clean and grounded appearance, the system avoids heavy shadows. Hierarchy is established through **Tonal Layers** and **Low-contrast outlines**.

- **Level 0 (Background)**: Surface color (#F8F9FF).
- **Level 1 (Cards/Containers)**: Pure white background with a subtle 1px border (#E5EEFF).
- **Interactive States**: Buttons and inputs use a 2px Deep Navy border when focused. 
- **Modals/Overlays**: Only these elements receive a soft, diffused shadow (12px blur, 4% opacity) to provide a gentle lift from the main content.

## Shapes

The design system uses a **Rounded** (8px) shape language. This softens the institutional feel of the Deep Navy color palette, making the portal feel more approachable for parents.

- **Standard (8px)**: Buttons, cards, and input fields.
- **Pill (9999px)**: Used exclusively for status badges and chips to differentiate them from actionable buttons.

## Components

- **Buttons**: Primary actions use solid Deep Navy or Emerald Green. Mobile buttons must be a minimum of 48px in height to ensure touch targets are accessible.
- **Status Chips**: Used for payment health (e.g., "Paid", "Due", "Overdue"). These utilize a soft background (10% opacity of the status color) with high-contrast text.
- **Input Fields**: Features a clear label above the input and a persistent placeholder. On focus, the border thickens to 2px Primary Navy.
- **Payment Cards**: Key dashboard elements that summarize fees. They feature a white background, 1px border, and use `headline-sm` for the amount and `label-sm` for the description.
- **Lists**: Used for payment history. Each list item should have a 1px bottom divider and utilize `data-mono` for currency values to ensure easy scanning.
- **Progress Indicators**: Linear bars in Emerald Green used to show how much of a total school fee balance has been settled.