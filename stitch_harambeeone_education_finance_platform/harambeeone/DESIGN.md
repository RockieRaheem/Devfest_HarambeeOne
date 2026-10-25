---
name: HarambeeOne
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
  on-surface-variant: '#43474f'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
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
  secondary-container: '#75f8b3'
  on-secondary-container: '#007147'
  tertiary: '#2f0c00'
  on-tertiary: '#ffffff'
  tertiary-container: '#4f1c02'
  on-tertiary-container: '#cd805d'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d6e3ff'
  primary-fixed-dim: '#a9c7ff'
  on-primary-fixed: '#001b3d'
  on-primary-fixed-variant: '#264778'
  secondary-fixed: '#78fbb6'
  secondary-fixed-dim: '#59de9b'
  on-secondary-fixed: '#002111'
  on-secondary-fixed-variant: '#005232'
  tertiary-fixed: '#ffdbcd'
  tertiary-fixed-dim: '#ffb596'
  on-tertiary-fixed: '#360f00'
  on-tertiary-fixed-variant: '#713619'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Public Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
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
  container-padding: 24px
  gutter: 16px
  section-gap: 32px
---

## Brand & Style
The design system is engineered for HarambeeOne, an education finance platform that balances institutional reliability with modern efficiency. The brand personality is rooted in stability, transparency, and growth.

The visual style follows a **Corporate / Modern** aesthetic with high-density information architecture. It avoids unnecessary decoration, focusing instead on clarity and trust. The interface should feel as robust as a modern banking application but as intuitive as a cloud-based productivity tool. Every design decision serves the goal of making complex financial data accessible and actionable for school administrators.

## Colors
The palette is dominated by **Navy Blue (#002B5B)**, used for primary navigation and core branding elements to establish authority. **Emerald Green (#00A86B)** is utilized for primary actions and "growth" indicators, signaling educational progress and successful financial transactions.

- **Status Colors**: Success is represented by Emerald Green, while errors/alerts use a high-visibility Red (#DC2626). Pending states use a muted Amber (#D97706).
- **Surfaces**: Use a multi-tiered gray system. Backgrounds are nearly white (#F8FAFC), while containers use pure White (#FFFFFF) with Slate Gray (#64748B) for borders and secondary text to maintain high contrast and legibility.

## Typography
This design system utilizes **Public Sans** for its institutional clarity and excellent legibility in data-dense environments. It provides a neutral yet professional tone that fits government and financial contexts.

For financial figures and currency display, use the `data-mono` role to ensure numbers align vertically in tables. Headlines should remain concise, and body text should prioritize high contrast (using Navy Blue or deep Slate for text colors) to ensure accessibility for all users.

## Layout & Spacing
The layout follows a **Fixed Grid** model for desktop dashboards to ensure consistent data visualization. A 12-column grid is standard, with 24px outer margins and 16px gutters.

- **Desktop**: Sidebar-driven navigation with a fluid content area that caps at 1440px width.
- **Mobile**: Single column with 16px margins.
- **Information Density**: Use tight vertical spacing within data tables (8px row padding) to maximize the "above the fold" information, but maintain generous 32px gaps between distinct functional modules to prevent cognitive overload.

## Elevation & Depth
To maintain a grounded and professional feel, depth is achieved through **Tonal Layers** and **Low-contrast outlines**. 

- **Primary Surfaces**: White backgrounds with a 1px border in Light Slate (#E2E8F0).
- **Shadows**: Use very soft, diffused shadows (Blur: 12px, Opacity: 4%) for floating elements like dropdowns or modals. 
- **Active State**: Elements being interacted with should not "lift" excessively; instead, use a subtle background color shift or a 2px Primary Navy border to indicate focus.

## Shapes
The shape language uses **Rounded (8px)** corners for the majority of UI components, including cards, input fields, and buttons. This provides a modern, approachable feel without appearing overly "bubbly" or informal. Large containers or modals may use `rounded-xl` (24px) to create a clear visual distinction from the background grid.

## Components
- **Buttons**: Primary buttons are solid Navy Blue or Emerald Green with white text. Secondary buttons use a Slate outline. Use 8px corner radii and 12px horizontal padding.
- **Pill Badges**: Essential for reconciliation states (e.g., "Settled", "Pending", "Overdue"). These use a desaturated version of the status color for the background and the full-strength color for the text (e.g., Light Green BG with Dark Green Text).
- **Data Tables**: The core of the platform. Use Zebra-striping (F8FAFC) on alternate rows. Header cells must be sticky with a 1px bottom border in Slate.
- **Input Fields**: Labeled clearly above the field. Use a 1px Slate border that turns Navy Blue on focus. Error states must include both a red border and a helper icon for accessibility.
- **Cards**: Used for summary metrics (e.g., "Total Fees Collected"). These should have a subtle 1px border and no shadow, keeping the dashboard flat and fast.
- **Progress Bars**: Used for funding goals or collection targets, utilizing the Emerald Green to visualize completion.