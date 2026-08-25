# udala Visual System

## Source Of Truth

This guide is distilled from `design_handoff_udala/README.md` and its `.dc.html` references. Treat those files as visual and UX references only, not as source data or product behavior.

## Brand

- Name: udala (always lowercase, in copy and UI text alike).
- Theme: dark only.
- Personality: intimate, premium, social, creator-friendly, calm rather than loud.
- Primary accent: purple. Secondary accent: pink. Status accent: teal.
- Solid colors only — no gradients anywhere (buttons, backgrounds, text fills, or media placeholders).

## Color Targets

Use semantic tokens in code. Exact handoff references:

- Page background: `oklch(0.15 0.015 296)`.
- Card surface: `oklch(0.19 0.018 296)`.
- Sidebar surface: `oklch(0.14 0.016 296)`.
- Border: `oklch(0.30 0.02 296 / 0.5)`.
- Primary text: `oklch(0.95 0.01 296)`.
- Muted text: `oklch(0.62 0.02 296)`.
- Purple accent: `oklch(0.58 0.19 302)`.
- Pink accent: `oklch(0.72 0.14 350)`.
- Teal status: `oklch(0.68 0.07 200)`.

## Typography

- Body/UI: Inter, 400-800.
- Headings: Outfit, 600-700.
- Page titles: 21-28px, tight line height.
- Section labels: 13-14px, 600 weight.
- Body: 13.5-14px.
- Meta/caption: 11-12.5px, never below 11px.
- Letter spacing may be tight for headings only. Avoid negative tracking in compact controls.

## Shape, Spacing, Shadows

- Card radius: 14-16px.
- Chip/pill radius: 999px.
- Small icon tiles: 8-12px radius.
- Desktop main padding: 24-28px.
- Mobile main padding: 16-18px.
- Use soft dark shadows, especially hover lift: `0 12px 28px oklch(0.05 0 0 / 0.4)`.
- Avoid harsh black shadows and decorative orbs.

## Components

- Cards: dark card surface, subtle border, 14-16px radius. Feed/event/profile cards lift on hover with `translateY(-3px)`, accent border, and soft shadow.
- Badges: pill-shaped, compact, strong enough contrast over images. Status badges sit top-left on media.
- Tabs: underline accent active state. Avoid filled pill tabs for profile/dashboard/community section tabs.
- Buttons: primary CTA uses a solid purple fill. Secondary uses transparent/card surface with border.
- Switches: pill tracks, purple when checked, muted dark surface when unchecked.
- Media: preserve aspect ratios. Use real photos when available; otherwise use a solid muted (secondary-surface) placeholder.

## Screen Patterns

- Onboarding: centered column, max width about 560px, 4 segmented progress bars, card choices, chip toggles, pinned back/continue controls.
- Discover: desktop app shell with 232px sidebar, main feed, and right rail. Profile cards use responsive grid `minmax(220px, 1fr)`.
- Creator profile: cover band, overlapping avatar, profile meta, stats row, underline tabs, tier cards, post grid with locked overlay.
- Creator dashboard: KPI row, chart cards, payout card, activity and content-performance panels.
- Messages: desktop three-column flow; mobile list-to-thread drill-in with back button.
- Events: card grid with cover/date/price treatment; detail view with large cover, host row, metadata rows, description, attendee summary.
- Communities: browse/detail route flow, banner plus overlapping icon, join controls, tabs, feed/about/members layout.
- Mobile/PWA: single column, 44px+ touch targets, bottom nav for Discover, Events, Messages, Groups, Profile. Do not build the mockup's hamburger screen switcher.

