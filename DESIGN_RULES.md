# Smart Travel Planner Design Rules

## Brand identity

The Route Frame mark combines an open geometric frame with a two-node route. It communicates structure, movement, and forward direction without using an airplane, map pin, globe, suitcase, or decorative sparkle. The reusable SVG is monochrome-first and uses `currentColor`; the brand accent is a controlled teal.

## Layout

- Desktop uses a fixed 68px global navigation rail and a flexible workspace.
- Mobile uses a compact header and three-item bottom navigation.
- Page content is limited to 1120px and aligned consistently.
- Contextual sidebars appear only when a feature needs them.
- Borders, spacing, and hierarchy do the visual work; shadows are reserved for dialogs.

## Theme tokens

Components consume semantic tokens from `src/styles/global.css`, never theme-specific literals. Core tokens include application and surface backgrounds, primary/secondary text, default/strong borders, accent states, danger states, focus ring, and overlay. Light, Dark, and System preferences share one component tree. The preference is persisted locally and applied before React starts to avoid an incorrect-theme flash.

## Typography and spacing

Use Inter, Geist, or the system sans-serif stack. Page headings are 24–40px depending on context, section headings 17–22px, body copy 13–15px, and metadata 10–12px. Use the 4px-derived spacing scale: 4, 8, 12, 16, 20, 24, 32, 40, and 48px. Inputs and buttons use 6–8px radii; panels use 8–10px.

## Components

- Buttons: primary for the page's main action, secondary/ghost for neutral actions, danger only for confirmed destructive actions.
- Inputs: visible labels, concise placeholders, 42px minimum height, field-level errors, and explicit focus/invalid states.
- Lists: prefer dense structured rows to large promotional cards.
- Dialogs: use the native dialog element, keyboard cancellation, a clear consequence, and an explicit destructive action.
- Icon-only controls require accessible names and tooltips.

## Responsive behavior

Avoid duplicate page implementations. Reflow grids into stacked layouts below their useful width, keep all controls reachable, prevent horizontal overflow, and provide at least 38px interactive control height. The desktop rail is replaced—not squeezed—on mobile.

## Accessibility

Use semantic landmarks, one page-level heading, correct labels, visible focus, keyboard navigation, descriptive action names, adequate contrast, and text-based validation. Honor reduced-motion preferences. Never encode meaning through color alone.

## No-vibe-code rules

Do not add gradient page backgrounds, glassmorphism, neon, giant rounded cards, decorative blobs, fake metrics, fake activity, fake reviews, excessive shadows, giant hero illustrations, or generic admin-dashboard compositions. Every visual element must support planning or comprehension.
