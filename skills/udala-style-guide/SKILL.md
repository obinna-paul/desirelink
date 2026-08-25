---
name: udala-style-guide
description: Apply Udala's product visual language and UX rules when designing, restyling, or implementing Udala app pages, components, dashboards, feeds, profiles, messaging, events, communities, onboarding, mobile/PWA screens, or new features that need to match the platform's dark purple/pink brand system.
---

# Udala Style Guide

Use this skill before creating or restyling any Udala page or shared UI component.

## Workflow

1. Read `references/visual-system.md` before making visual decisions.
2. Check the existing route/component first and preserve its data fetching, props, permissions, validation, and business behavior.
3. Restyle existing components in place. Create net-new screens only when the route does not already exist.
4. Use real app data from the existing models and APIs. Never copy placeholder names, avatars, prices, messages, or stats from reference files.
5. Prefer shared tokens and reusable components over page-local one-off colors and layout rules.
6. If a reference interaction conflicts with existing product behavior or permissions, flag it instead of changing behavior silently.

## Implementation Priorities

- Keep Udala dark-only unless the product explicitly requests a light theme.
- Use shared semantic tokens for surfaces, borders, text, accent, status, and shadows.
- Use Lucide icons already present in the app; do not use emoji as structural UI icons.
- Maintain responsive layouts: desktop sidebar plus right rail where appropriate, mobile single column with bottom navigation.
- Preserve accessibility: 44px minimum touch targets, visible focus states, descriptive labels, and no color-only state.

