# Plan: Procurement Portal — Apple Design System & Liquid Glass Spec

## Document References
- Spec: `specs/PROCUREMENT_APPLE_DESIGN_SPEC.md`
- Guidelines: `GEMINI.md`, `FRONTEND_BACKEND_WIRING_GUIDE.md`

---

## Logged Assumptions

### ASSUMPTION [A-DESIGN-1]
- **What was assumed:** We will implement the shared Apple & Liquid Glass styles, theme tokens, theme provider, theme switcher, canvas background, svg filters, hooks, and new UI/Layout/Data/Glass components inside `@procurement/ui` (under `packages/ui`) so that all three portals (`admin-portal`, `supplier-portal`, `buyer-portal`) can consume them cleanly and consistently via workspace package dependency without duplicating code across portals.
- **Why:** Turborepo architecture already has `@procurement/ui` imported by all 3 portals. Centralizing design system tokens, components, and themes guarantees visual consistency and avoids divergence.
- **Risk:** Low. All portals already depend on `@procurement/ui: workspace:*`.
- **Owner:** Frontend Lead.

### ASSUMPTION [A-DESIGN-2]
- **What was assumed:** Existing functional routes and pages (e.g. buyer portal `/requisitions`, `/requisitions/new`, `/tasks`, `/unmapped-prs`, `/vendors`; admin portal `/dashboard`, `/master-data/categories`, `/master-data/import`; supplier portal `/profile`, `/documents`, `/register`) must remain 100% functionally intact. All queries, mutations, auth state, and permission guards are preserved, wrapped inside the new Apple `AppShell`, `Navbar` (with `ThemeSwitcher`), and styled with Apple/Liquid Glass CSS and components.
- **Why:** User explicitly instructed: "make sure it doesnt affect already implemented functoinalities working".
- **Risk:** Low. We enhance the layouts and visual components rather than deleting working API forms.
- **Owner:** Fullstack Lead.

### ASSUMPTION [A-DESIGN-3]
- **What was assumed:** Font family fallback: SF Pro Display / Text are Apple proprietary system fonts. On macOS / iOS, `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text'` will resolve natively. On non-Apple platforms, we provide `'Inter', 'Helvetica Neue', Arial, sans-serif` as web font fallbacks as noted in Section 1.3 of the spec.
- **Why:** Cross-platform web typography standards and Apple HIG guidance.
- **Risk:** None.
- **Owner:** Design Systems.

### ASSUMPTION [A-DESIGN-4]
- **What was assumed:** Icon system uses `lucide-react` icons matching SF Symbols equivalents (e.g. LayoutDashboard, ShoppingCart, Users, CheckCircle, FileText, Settings, Sun, Moon, Sparkles, ChevronDown, Search, Filter, ArrowUpRight, etc.).
- **Why:** Explicitly mandated by Spec 1.1 ("SF Symbols equivalents via Lucide or Phosphor").
- **Risk:** Low. `lucide-react` is installed in root and `@procurement/ui`.
- **Owner:** Frontend Lead.

---

## Phase Breakdown

### Phase 1: Shared Foundation (`packages/ui`)
1. **CSS Design Tokens & Base Styles:**
   - `packages/ui/src/styles/apple-tokens.css`
   - `packages/ui/src/styles/apple-base.css`
   - `packages/ui/src/styles/components/*.css` (navbar, card, button, form, badge, table, sidebar, modal, toast, kpi)
   - `packages/ui/src/styles/liquid-glass/*.css` (tokens, background, material, animations, navbar, card, button, form, sidebar, table)
   - `packages/ui/src/styles/index.css` aggregating all styles.
2. **Theme Architecture:**
   - `packages/ui/src/theme/ThemeProvider.tsx`: context, localStorage persistence ('procurement-theme'), data-theme attribute on `<html>`, classes `theme-apple-light`, `theme-apple-dark`, `theme-liquid-glass`.
   - `packages/ui/src/theme/ThemeSwitcher.tsx`: segmented control (☀️ Light, 🌙 Dark, 🫧 Glass).
3. **Liquid Glass Effects & Canvas:**
   - `packages/ui/src/glass/LiquidGlassBackground.tsx`: animated canvas with floating ambient colored orbs that the glass refracts.
   - `packages/ui/src/glass/refraction.ts`: injects SVG `<filter id="glass-refract">` and `<filter id="glass-ripple">`.
   - `packages/ui/src/glass/GlassCard.tsx`: glass surface container with specular border and light refraction.
4. **Hooks:**
   - `useAppleReveal`: scroll-triggered section reveal with standard Apple ease cubic-bezier(0.25, 0.1, 0.25, 1).
   - `useCountUp`: Apple-style ease-out number counter for KPI stats.
   - `useParallaxTilt`: 3D card tilt on hover.
   - `useLiquidGlassCursor`: moves `--specular-x` and `--specular-y` CSS variables based on cursor position.
5. **Core Apple & Liquid Glass Components:**
   - `Button`: pill-shaped (border-radius: 980px), primary, secondary, ghost, destructive, with Apple motion and scale(0.98) on active.
   - `Card`: 12px/16px radius, hairline border, single-axis soft shadow, hover elevation translateY(-1px), glass variant.
   - `Badge`: pill with dot indicator (approved, pending, rejected, draft, review).
   - `Input`, `SearchInput`, `Select`, `Toggle`: Apple-style inputs, focus ring `0 0 0 3px rgba(0,122,255,0.20)`.
   - `Modal`: bottom sheet on mobile, centered dialog on desktop.
   - `Toast`: frosted vibration banner with slide-in animation.
   - `Table`: clean Apple table with hairline separators, uppercase 11px headers, hover state.
   - `KPICard` & `HeroKPIStrip`: Apple.com style large metric display with label beneath and `useCountUp`.
   - `Tabs`: Apple segmented control.
   - `Skeleton`: shimmering loading placeholder.
6. **Layout System:**
   - `Navbar`: 52px sticky frosted glass navbar, logo, nav links, ThemeSwitcher, user info, sign out button.
   - `Sidebar`: Apple sidebar navigation, active pill highlighting, section headers.
   - `AppShell`: responsive shell unifying Navbar, Sidebar (or mobile tab bar), and content area.
   - `PageTransition`: route transition container.
7. **Export all new components** from `packages/ui/src/index.ts`.

### Phase 2: Admin Portal (`apps/admin-portal`)
1. Import `@procurement/ui/src/styles/index.css` in `app/globals.css`.
2. Wrap `app/layout.tsx` / `providers.tsx` with `ThemeProvider` and `LiquidGlassBackground`.
3. Update `app/(main)/layout.tsx` to use the Apple `AppShell` with Admin identity and system blue accent (`#0071E3`).
4. Update Admin Dashboard (`app/(main)/dashboard/page.tsx`) with Apple `HeroKPIStrip`, spend overview glass cards, category summary, quick actions, while maintaining all links and functionality.
5. Style `/master-data/categories` and `/master-data/import` with Apple cards, tables, inputs, badges.

### Phase 3: Supplier Portal (`apps/supplier-portal`)
1. Import `@procurement/ui/src/styles/index.css` in `app/globals.css`.
2. Wrap `app/layout.tsx` / `providers.tsx` with `ThemeProvider` and `LiquidGlassBackground`.
3. Update `app/(main)/layout.tsx` to use `AppShell` with Supplier identity and emerald/green accent (`#30D158`).
4. Update Supplier Home / Profile (`app/(main)/profile/page.tsx`) and Documents (`app/(main)/documents/page.tsx`) with Apple cards, badges, and KPI stats.
5. Style Registration flow (`app/register/page.tsx` and `app/register/[token]/page.tsx`).

### Phase 4: Buyer Portal (`apps/buyer-portal`)
1. Import `@procurement/ui/src/styles/index.css` in `app/globals.css`.
2. Wrap `app/layout.tsx` / `providers.tsx` with `ThemeProvider` and `LiquidGlassBackground`.
3. Update `app/(main)/layout.tsx` to use `AppShell` with Buyer identity and system blue/orange accent.
4. Enhance Requisitions list (`app/(main)/requisitions/page.tsx`), New Requisition wizard (`app/(main)/requisitions/new/page.tsx`), Task approvals (`app/(main)/tasks/page.tsx`), Unmapped PRs (`app/(main)/unmapped-prs/page.tsx`), and Vendors (`app/(main)/vendors/page.tsx`) with Apple Card, Badge, HeroKPIStrip, Button, and Table styling, while preserving all form hooks, line item tables, and backend integrations.

### Phase 5: Verification & Audit
1. Run `pnpm build` across all portals to verify TypeScript compilation and Next.js static/dynamic builds.
2. Run backend pytest suite `OTEL_SDK_DISABLED=true .venv/bin/pytest tests/ -q` to confirm zero backend regressions.
3. Verify all 3 themes (`apple-light`, `apple-dark`, `liquid-glass`) in code inspections and CSS validations.
4. Generate Spec Audit Coverage report.
5. Update Graphify knowledge graph (`graphify update .`).
6. Update `README.md` session state.
