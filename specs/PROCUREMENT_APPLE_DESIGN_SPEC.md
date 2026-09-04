# Procurement Portal — Apple Design System + Liquid Glass Spec

## Full End-to-End Redesign Specification for Antigravity CLI (Gemini 3.7 Flash)

---

## 0. DOCUMENT OVERVIEW

This spec covers a complete visual and interaction redesign of three portals:

- **Admin Portal** — `localhost:3000`
- **Supplier Portal** — `localhost:3001`
- **Buyer Portal** — `localhost:3002`

Two themes must be implemented:

1. **Apple Light / Dark** — Apple.com–faithful design with SF Pro typography, translucent chrome, precise spacing, and signature Apple motion.
2. **Liquid Glass** — macOS 26 Tahoe–accurate Liquid Glass material: real-time specular refraction, depth-mapped blur, chromatic edge glow, and physics-based surface tension animation.

---



## 1. DESIGN LANGUAGE FOUNDATIONS



### 1.1 Apple Design DNA (Non-Negotiable Traits)


| Trait           | Specification                                                             |
| --------------- | ------------------------------------------------------------------------- |
| Typography      | SF Pro Display (headings ≥ 28px), SF Pro Text (body), SF Mono (code/data) |
| Corner radius   | 12px (cards), 8px (inputs), 20px (modals), 50% (pills)                    |
| Spacing unit    | 4px base grid; multiples of 4 only                                        |
| Motion curve    | `cubic-bezier(0.25, 0.1, 0.25, 1.0)` (Apple standard ease)                |
| Motion duration | Micro 120ms · Standard 300ms · Page 500ms                                 |
| Icon system     | SF Symbols equivalents via Lucide or Phosphor (never Material)            |
| Shadow          | Single-axis soft `0 2px 16px rgba(0,0,0,0.10)` — never multi-layer        |
| Border          | 0.5px hairline `rgba(0,0,0,0.12)` light / `rgba(255,255,255,0.10)` dark   |
| Focus ring      | 3px `rgba(0,122,255,0.50)` offset 2px                                     |




### 1.2 Apple Color Tokens

```css
/* === LIGHT MODE === */
--apple-bg-primary:        #FFFFFF;
--apple-bg-secondary:      #F5F5F7;
--apple-bg-tertiary:       #FBFBFD;
--apple-bg-grouped:        #F2F2F7;

--apple-label-primary:     #1D1D1F;
--apple-label-secondary:   #6E6E73;
--apple-label-tertiary:    #AEAEB2;
--apple-label-quaternary:  #C7C7CC;

--apple-blue:              #0071E3;   /* primary CTA */
--apple-blue-hover:        #0077ED;
--apple-blue-light:        #007AFF;   /* system blue */

--apple-separator:         rgba(0,0,0,0.08);
--apple-fill-primary:      rgba(120,120,128,0.20);
--apple-fill-secondary:    rgba(120,120,128,0.16);
--apple-fill-tertiary:     rgba(118,118,128,0.12);
--apple-fill-quaternary:   rgba(116,116,128,0.08);

--apple-vibrancy-light:    rgba(255,255,255,0.72);
--apple-vibrancy-ultra:    rgba(255,255,255,0.88);

/* === DARK MODE === */
--apple-bg-primary-dark:       #000000;
--apple-bg-secondary-dark:     #1C1C1E;
--apple-bg-tertiary-dark:      #2C2C2E;
--apple-bg-grouped-dark:       #1C1C1E;

--apple-label-primary-dark:    #FFFFFF;
--apple-label-secondary-dark:  #EBEBF5CC;   /* 80% white */
--apple-label-tertiary-dark:   #EBEBF57A;   /* 48% white */

--apple-blue-dark:             #0A84FF;
--apple-vibrancy-dark:         rgba(28,28,30,0.72);

/* === SEMANTIC PROCUREMENT COLORS === */
--status-approved:   #30D158;   /* Apple green */
--status-pending:    #FF9F0A;   /* Apple orange */
--status-rejected:   #FF453A;   /* Apple red */
--status-draft:      #636366;   /* Apple gray */
--status-review:     #0A84FF;   /* Apple blue */
```



### 1.3 Typography Scale

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
/* Use Inter as SF Pro web fallback — visually identical at ≤16px */

/* Display */
--text-display-xl:  font-size: 80px; line-height: 1.05; letter-spacing: -0.025em; font-weight: 600;
--text-display-lg:  font-size: 56px; line-height: 1.08; letter-spacing: -0.020em; font-weight: 600;
--text-display-md:  font-size: 40px; line-height: 1.10; letter-spacing: -0.015em; font-weight: 600;

/* Headline */
--text-headline-lg: font-size: 28px; line-height: 1.20; letter-spacing: -0.010em; font-weight: 600;
--text-headline-md: font-size: 22px; line-height: 1.25; letter-spacing: -0.008em; font-weight: 600;
--text-headline-sm: font-size: 18px; line-height: 1.30; font-weight: 600;

/* Body */
--text-body-xl:   font-size: 17px; line-height: 1.53; font-weight: 400;
--text-body-lg:   font-size: 15px; line-height: 1.60; font-weight: 400;
--text-body-md:   font-size: 13px; line-height: 1.55; font-weight: 400;

/* Caption / Label */
--text-caption:   font-size: 12px; line-height: 1.33; font-weight: 400;
--text-label:     font-size: 11px; line-height: 1.20; letter-spacing: 0.06em; font-weight: 500; text-transform: uppercase;
```

---



## 2. THEME SYSTEM ARCHITECTURE



### 2.1 Theme Enum

```typescript
type Theme = 'apple-light' | 'apple-dark' | 'liquid-glass';
```



### 2.2 Theme Provider Implementation

```typescript
// src/providers/ThemeProvider.tsx
import { createContext, useContext, useEffect, useState } from 'react';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  isLiquidGlass: boolean;
  isDark: boolean;
}

export const ThemeContext = createContext<ThemeContextValue>({} as ThemeContextValue);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem('procurement-theme') as Theme) || 'apple-light';
  });

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem('procurement-theme', t);
    document.documentElement.setAttribute('data-theme', t);
    // Inject/remove Liquid Glass CSS layer
    if (t === 'liquid-glass') {
      document.documentElement.classList.add('theme-liquid-glass');
      document.documentElement.classList.remove('theme-apple-light', 'theme-apple-dark');
    } else if (t === 'apple-dark') {
      document.documentElement.classList.add('theme-apple-dark');
      document.documentElement.classList.remove('theme-liquid-glass', 'theme-apple-light');
    } else {
      document.documentElement.classList.add('theme-apple-light');
      document.documentElement.classList.remove('theme-liquid-glass', 'theme-apple-dark');
    }
  };

  useEffect(() => {
    setTheme(theme); // apply on mount
  }, []);

  return (
    <ThemeContext.Provider value={{
      theme,
      setTheme,
      isLiquidGlass: theme === 'liquid-glass',
      isDark: theme === 'apple-dark' || theme === 'liquid-glass',
    }}>
      {children}
    </ThemeContext.Provider>
  );
}
```



### 2.3 Theme Switcher Component

```tsx
// src/components/ThemeSwitcher.tsx
// Renders three toggles in the nav bar:
// ☀️  Apple Light | 🌙 Apple Dark | 🫧 Liquid Glass
// Active state: SF-style selected segment in a segmented control

export function ThemeSwitcher() {
  const { theme, setTheme } = useContext(ThemeContext);
  const options: { id: Theme; label: string; emoji: string }[] = [
    { id: 'apple-light', label: 'Light', emoji: '☀️' },
    { id: 'apple-dark',  label: 'Dark',  emoji: '🌙' },
    { id: 'liquid-glass', label: 'Glass', emoji: '🫧' },
  ];
  return (
    <div className="theme-segmented-control" role="group" aria-label="Theme">
      {options.map(o => (
        <button
          key={o.id}
          className={`theme-segment ${theme === o.id ? 'active' : ''}`}
          onClick={() => setTheme(o.id)}
          aria-pressed={theme === o.id}
        >
          <span aria-hidden="true">{o.emoji}</span>
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}
```

---



## 3. APPLE THEME — COMPLETE IMPLEMENTATION



### 3.1 Global Base Styles

```css
/* src/styles/apple-base.css */
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

:root {
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display',
               'SF Pro Text', 'Helvetica Neue', Arial, sans-serif;
  font-size: 16px;
  text-rendering: optimizeLegibility;
}

/* === APPLE LIGHT === */
.theme-apple-light {
  color-scheme: light;
  background-color: var(--apple-bg-secondary);
  color: var(--apple-label-primary);
}

/* === APPLE DARK === */
.theme-apple-dark {
  color-scheme: dark;
  background-color: var(--apple-bg-primary-dark);
  color: var(--apple-label-primary-dark);
}

/* === Smooth scroll === */
html {
  scroll-behavior: smooth;
}

/* === Selection === */
::selection {
  background: rgba(0, 122, 255, 0.25);
}

/* === Scrollbar (WebKit) === */
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: rgba(0,0,0,0.20);
  border-radius: 4px;
}
.theme-apple-dark ::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.20);
}
```



### 3.2 Navigation Bar (Frosted Glass Nav)

```css
/* src/styles/components/navbar.css */
.apple-navbar {
  position: sticky;
  top: 0;
  z-index: 100;
  height: 52px;
  display: flex;
  align-items: center;
  padding: 0 24px;
  gap: 24px;

  /* Apple nav translucency */
  background: rgba(255,255,255,0.72);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  border-bottom: 0.5px solid rgba(0,0,0,0.10);

  transition: background 300ms cubic-bezier(0.25,0.1,0.25,1);
}

.theme-apple-dark .apple-navbar {
  background: rgba(28,28,30,0.72);
  border-bottom: 0.5px solid rgba(255,255,255,0.08);
}

/* Logo */
.apple-navbar__logo {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.5px;
  color: var(--apple-label-primary);
  text-decoration: none;
}

/* Nav links */
.apple-navbar__link {
  font-size: 14px;
  font-weight: 400;
  color: var(--apple-label-secondary);
  text-decoration: none;
  padding: 4px 8px;
  border-radius: 6px;
  transition: color 200ms, background 200ms;
}
.apple-navbar__link:hover,
.apple-navbar__link.active {
  color: var(--apple-label-primary);
  background: var(--apple-fill-quaternary);
}
```



### 3.3 Card Component

```css
/* src/styles/components/card.css */
.apple-card {
  background: var(--apple-bg-primary);
  border-radius: 12px;
  border: 0.5px solid var(--apple-separator);
  box-shadow: 0 2px 16px rgba(0,0,0,0.06);
  overflow: hidden;
  transition: box-shadow 300ms cubic-bezier(0.25,0.1,0.25,1),
              transform 300ms cubic-bezier(0.25,0.1,0.25,1);
}

.apple-card:hover {
  box-shadow: 0 8px 32px rgba(0,0,0,0.12);
  transform: translateY(-1px);
}

.theme-apple-dark .apple-card {
  background: var(--apple-bg-secondary-dark);
  border-color: rgba(255,255,255,0.08);
  box-shadow: 0 2px 16px rgba(0,0,0,0.30);
}

.theme-apple-dark .apple-card:hover {
  box-shadow: 0 8px 32px rgba(0,0,0,0.50);
}

.apple-card__header {
  padding: 20px 20px 0;
}

.apple-card__body {
  padding: 16px 20px 20px;
}

.apple-card__title {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.3px;
  color: var(--apple-label-primary);
}

.apple-card__subtitle {
  font-size: 13px;
  color: var(--apple-label-secondary);
  margin-top: 2px;
}
```



### 3.4 Button System

```css
/* src/styles/components/button.css */
/* Primary — Apple blue CTA */
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 20px;
  font-size: 15px;
  font-weight: 500;
  color: #FFFFFF;
  background: var(--apple-blue);
  border: none;
  border-radius: 980px;   /* pill — Apple style */
  cursor: pointer;
  transition: background 200ms, transform 100ms, box-shadow 200ms;
  -webkit-user-select: none;
}

.btn-primary:hover {
  background: var(--apple-blue-hover);
}

.btn-primary:active {
  transform: scale(0.98);
  background: #005EC2;
}

/* Secondary */
.btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 9px 20px;
  font-size: 15px;
  font-weight: 500;
  color: var(--apple-blue);
  background: var(--apple-fill-tertiary);
  border: none;
  border-radius: 980px;
  cursor: pointer;
  transition: background 200ms, transform 100ms;
}

.btn-secondary:hover { background: var(--apple-fill-secondary); }
.btn-secondary:active { transform: scale(0.98); }

/* Ghost */
.btn-ghost {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 9px 20px;
  font-size: 15px;
  font-weight: 500;
  color: var(--apple-blue);
  background: transparent;
  border: 0.5px solid var(--apple-blue);
  border-radius: 980px;
  cursor: pointer;
  transition: background 200ms, transform 100ms;
}

.btn-ghost:hover { background: rgba(0,113,227,0.06); }
.btn-ghost:active { transform: scale(0.98); }

/* Destructive */
.btn-destructive {
  color: #FFFFFF;
  background: var(--status-rejected);
  border: none;
  border-radius: 980px;
  padding: 10px 20px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: background 200ms, transform 100ms;
}

.btn-destructive:hover { background: #FF3B30; }
.btn-destructive:active { transform: scale(0.98); }
```



### 3.5 Form Elements

```css
/* src/styles/components/form.css */
.apple-input {
  width: 100%;
  padding: 10px 14px;
  font-size: 15px;
  font-family: inherit;
  color: var(--apple-label-primary);
  background: var(--apple-fill-quaternary);
  border: 0.5px solid var(--apple-separator);
  border-radius: 8px;
  outline: none;
  transition: border-color 200ms, box-shadow 200ms, background 200ms;
  appearance: none;
}

.apple-input::placeholder {
  color: var(--apple-label-tertiary);
}

.apple-input:focus {
  background: var(--apple-bg-primary);
  border-color: var(--apple-blue);
  box-shadow: 0 0 0 3px rgba(0,122,255,0.20);
}

.theme-apple-dark .apple-input {
  background: rgba(118,118,128,0.12);
  border-color: rgba(255,255,255,0.08);
}

/* Search input with SF-style icon */
.apple-search-wrap {
  position: relative;
}

.apple-search-wrap .search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--apple-label-tertiary);
  pointer-events: none;
}

.apple-search-wrap input {
  padding-left: 36px;
  border-radius: 10px;
}

/* Select */
.apple-select {
  padding: 10px 36px 10px 14px;
  background-image: url("data:image/svg+xml,..."); /* chevron icon */
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 12px;
}

/* Toggle / Checkbox */
.apple-toggle {
  width: 51px;
  height: 31px;
  background: var(--apple-label-quaternary);
  border-radius: 15.5px;
  position: relative;
  cursor: pointer;
  transition: background 300ms;
  border: none;
  outline: none;
}

.apple-toggle.on { background: #34C759; }

.apple-toggle::after {
  content: '';
  position: absolute;
  width: 27px;
  height: 27px;
  background: white;
  border-radius: 50%;
  top: 2px;
  left: 2px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.25);
  transition: transform 300ms cubic-bezier(0.25,0.1,0.25,1);
}

.apple-toggle.on::after { transform: translateX(20px); }
```



### 3.6 Status Badge / Pill

```css
/* src/styles/components/badge.css */
.apple-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 50px;
}

/* Dot indicator */
.apple-badge::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.8;
}

.badge-approved  { color: var(--status-approved);  background: rgba(48,209,88,0.12);  }
.badge-pending   { color: var(--status-pending);   background: rgba(255,159,10,0.12); }
.badge-rejected  { color: var(--status-rejected);  background: rgba(255,69,58,0.12);  }
.badge-draft     { color: var(--status-draft);     background: rgba(99,99,102,0.12);  }
.badge-review    { color: var(--status-review);    background: rgba(10,132,255,0.12); }
```



### 3.7 Data Table (Apple-style)

```css
/* src/styles/components/table.css */
.apple-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.apple-table thead tr {
  border-bottom: 0.5px solid var(--apple-separator);
}

.apple-table th {
  padding: 10px 16px;
  text-align: left;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--apple-label-secondary);
}

.apple-table td {
  padding: 14px 16px;
  color: var(--apple-label-primary);
  border-bottom: 0.5px solid var(--apple-separator);
}

.apple-table tbody tr {
  transition: background 150ms;
}

.apple-table tbody tr:hover {
  background: var(--apple-fill-quaternary);
}

.apple-table tbody tr:last-child td {
  border-bottom: none;
}
```



### 3.8 Sidebar Navigation

```css
/* src/styles/components/sidebar.css */
.apple-sidebar {
  width: 240px;
  height: 100vh;
  position: fixed;
  left: 0;
  top: 0;
  padding: 80px 12px 24px;
  background: var(--apple-bg-secondary);
  border-right: 0.5px solid var(--apple-separator);
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
}

.theme-apple-dark .apple-sidebar {
  background: var(--apple-bg-secondary-dark);
}

.sidebar-section-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--apple-label-tertiary);
  padding: 12px 12px 4px;
}

.sidebar-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 400;
  color: var(--apple-label-primary);
  text-decoration: none;
  cursor: pointer;
  transition: background 150ms;
}

.sidebar-item:hover {
  background: var(--apple-fill-tertiary);
}

.sidebar-item.active {
  background: var(--apple-blue);
  color: #FFFFFF;
  font-weight: 500;
}

.sidebar-item.active .sidebar-icon {
  color: #FFFFFF;
}

.sidebar-icon {
  width: 18px;
  height: 18px;
  color: var(--apple-label-secondary);
  flex-shrink: 0;
}
```

---



## 4. PAGE-LEVEL LAYOUTS & APPLE EFFECTS



### 4.1 Dashboard Hero (Apple-style stat display)

```tsx
// Every portal opens with a full-width KPI strip
// Pattern: large number, small label beneath, no cards — pure typography
// Animation: number increments from 0 on page load (Apple.com style counter)

function HeroKPIStrip() {
  return (
    <section className="kpi-strip">
      <KPIItem value={1284} label="Active POs" prefix="$" suffix="K" />
      <KPIItem value={47}   label="Pending Approvals" />
      <KPIItem value={98.4} label="On-Time Delivery" suffix="%" decimals={1} />
      <KPIItem value={312}  label="Suppliers Onboarded" />
    </section>
  );
}

// CSS for KPI strip
.kpi-strip {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;   /* hairline separator between items */
  background: var(--apple-separator);
  border-radius: 12px;
  overflow: hidden;
  margin: 24px 0;
}

.kpi-item {
  background: var(--apple-bg-primary);
  padding: 32px 24px;
  text-align: center;
}

.kpi-value {
  font-size: 52px;
  font-weight: 700;
  letter-spacing: -0.04em;
  line-height: 1;
  color: var(--apple-label-primary);
  font-variant-numeric: tabular-nums;
}

.kpi-label {
  font-size: 13px;
  color: var(--apple-label-secondary);
  margin-top: 6px;
  font-weight: 400;
}
```



### 4.2 Scroll-triggered Section Animations

```typescript
// src/hooks/useAppleReveal.ts
// Apple uses a single orchestrated reveal per section — not per-card.
// Elements enter as a group: opacity 0→1, transform translateY(24px)→0

export function useAppleReveal(ref: RefObject<HTMLElement>, delay = 0) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.transition = `opacity 600ms cubic-bezier(0.25,0.1,0.25,1) ${delay}ms,
                                  transform 600ms cubic-bezier(0.25,0.1,0.25,1) ${delay}ms`;
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );

    el.style.opacity = '0';
    el.style.transform = 'translateY(24px)';
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
}

// Reduced motion override
@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; animation: none !important; }
}
```



### 4.3 Modal (Apple Sheet)

```css
.apple-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.40);
  backdrop-filter: blur(8px);
  z-index: 200;
  display: flex;
  align-items: flex-end; /* sheet from bottom on mobile */
  justify-content: center;

  animation: overlayIn 300ms cubic-bezier(0.25,0.1,0.25,1) forwards;
}

@keyframes overlayIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.apple-modal {
  background: var(--apple-bg-primary);
  border-radius: 20px 20px 0 0;
  width: 100%;
  max-width: 640px;
  padding: 20px 24px 40px;
  position: relative;

  animation: sheetUp 400ms cubic-bezier(0.32,0.72,0,1) forwards;
}

@keyframes sheetUp {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}

.apple-modal__handle {
  width: 36px;
  height: 5px;
  background: var(--apple-label-quaternary);
  border-radius: 3px;
  margin: 0 auto 20px;
}

/* Desktop: centered dialog */
@media (min-width: 768px) {
  .apple-modal-overlay { align-items: center; }
  .apple-modal {
    border-radius: 20px;
    animation: dialogIn 300ms cubic-bezier(0.25,0.1,0.25,1) forwards;
  }
  .apple-modal__handle { display: none; }
}

@keyframes dialogIn {
  from { opacity: 0; transform: scale(0.96) translateY(8px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
```



### 4.4 Toast / Notification (SF-style Banner)

```css
.apple-toast {
  position: fixed;
  top: 72px;
  right: 24px;
  z-index: 300;
  min-width: 280px;
  padding: 14px 18px;
  background: var(--apple-vibrancy-light);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border-radius: 14px;
  border: 0.5px solid rgba(0,0,0,0.08);
  box-shadow: 0 8px 32px rgba(0,0,0,0.16);
  display: flex;
  align-items: flex-start;
  gap: 12px;
  font-size: 14px;

  animation: toastIn 400ms cubic-bezier(0.32,0.72,0,1) forwards;
}

@keyframes toastIn {
  from { opacity: 0; transform: translateX(100%) scale(0.92); }
  to   { opacity: 1; transform: translateX(0) scale(1); }
}

.apple-toast.exit {
  animation: toastOut 250ms cubic-bezier(0.25,0.1,0.25,1) forwards;
}

@keyframes toastOut {
  to { opacity: 0; transform: translateX(8px) scale(0.96); }
}
```

---



## 5. LIQUID GLASS THEME — COMPLETE IMPLEMENTATION

> **Critical accuracy notes for Liquid Glass (macOS 26 / visionOS 2):**
>
> - Real Liquid Glass = live backdrop refraction + specular highlight edge + chromatic aberration fringe + surface tension physics
> - NOT just `backdrop-filter: blur()` — that is "frosted glass" (macOS 10.10 Yosemite)
> - Liquid Glass has: refraction displacement, animated edge caustics, depth-responsive blur strength, and surface ripple on interaction



### 5.1 Liquid Glass CSS Custom Properties

```css
/* src/styles/liquid-glass/tokens.css */
.theme-liquid-glass {
  /* Base environment */
  --lg-bg-wallpaper: linear-gradient(135deg, #1a1a2e 0%, #16213e 30%, #0f3460 60%, #533483 100%);
  /* Use a rich ambient wallpaper behind all glass surfaces */

  /* Glass material */
  --lg-glass-blur:        28px;
  --lg-glass-saturation:  220%;
  --lg-glass-brightness:  1.08;

  /* Glass surface colors (vary by portal) */
  --lg-surface-tint-admin:    rgba(10, 132, 255, 0.06);
  --lg-surface-tint-supplier: rgba(48, 209, 88, 0.06);
  --lg-surface-tint-buyer:    rgba(255, 159, 10, 0.06);

  /* Specular / edge highlight */
  --lg-specular-top:    rgba(255,255,255,0.65);
  --lg-specular-bottom: rgba(255,255,255,0.08);
  --lg-specular-width:  1px;

  /* Chromatic aberration */
  --lg-chroma-r: rgba(255,80,80,0.06);
  --lg-chroma-b: rgba(80,80,255,0.06);

  /* Depth tiers */
  --lg-depth-1-blur: 12px;   /* Far — modals behind */
  --lg-depth-2-blur: 28px;   /* Mid — cards */
  --lg-depth-3-blur: 48px;   /* Near — navbar, sheets */

  /* Refraction strength */
  --lg-refract-amount: 6px;

  /* Surface tint opacity */
  --lg-fill-opacity: 0.08;
  --lg-border-opacity: 0.20;
}
```



### 5.2 Wallpaper / Ambient Background

```css
/* src/styles/liquid-glass/background.css */
/* The wallpaper is the "world" behind all glass. It must be:
   1. Fixed (doesn't scroll)
   2. Rich in color and detail (glass needs something to refract)
   3. Animated subtly (macOS-style parallax ambient)
*/

.theme-liquid-glass body {
  min-height: 100vh;
  background: var(--lg-bg-wallpaper);
  position: relative;
  overflow-x: hidden;
}

/* Animated ambient light orbs — like macOS wallpaper */
.theme-liquid-glass body::before,
.theme-liquid-glass body::after {
  content: '';
  position: fixed;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.6;
  pointer-events: none;
  z-index: 0;
  animation: ambientFloat 12s ease-in-out infinite alternate;
}

.theme-liquid-glass body::before {
  width: 600px;
  height: 600px;
  background: radial-gradient(circle, rgba(100,60,255,0.5) 0%, transparent 70%);
  top: -100px;
  left: -100px;
}

.theme-liquid-glass body::after {
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, rgba(0,200,255,0.4) 0%, transparent 70%);
  bottom: -100px;
  right: -100px;
  animation-direction: alternate-reverse;
}

@keyframes ambientFloat {
  0%   { transform: translate(0, 0) scale(1); }
  50%  { transform: translate(40px, 30px) scale(1.05); }
  100% { transform: translate(-20px, 50px) scale(0.95); }
}

/* Additional floating orbs injected via JS for richer scene */
/* See LiquidGlassBackground component below */
```



### 5.3 Liquid Glass Background Component

```tsx
// src/components/LiquidGlassBackground.tsx
// Renders the animated wallpaper canvas behind all glass surfaces

import { useEffect, useRef } from 'react';

interface Orb {
  x: number; y: number;
  vx: number; vy: number;
  radius: number;
  color: string;
  opacity: number;
}

export function LiquidGlassBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let raf: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Orbs that the glass will refract
    const orbs: Orb[] = [
      { x: 300,  y: 200,  vx: 0.3,  vy: 0.2,  radius: 280, color: '#6040FF', opacity: 0.5 },
      { x: 900,  y: 400,  vx: -0.2, vy: 0.3,  radius: 240, color: '#00C8FF', opacity: 0.4 },
      { x: 600,  y: 600,  vx: 0.15, vy: -0.25, radius: 200, color: '#FF4080', opacity: 0.35 },
      { x: 1200, y: 150,  vx: -0.3, vy: 0.15, radius: 180, color: '#40FF90', opacity: 0.3 },
      { x: 200,  y: 700,  vx: 0.25, vy: -0.2, radius: 220, color: '#FF8040', opacity: 0.35 },
    ];

    const draw = () => {
      // Clear with deep dark base
      ctx.fillStyle = '#0a0a1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw orbs
      orbs.forEach(orb => {
        // Bounce off walls
        if (orb.x + orb.radius > canvas.width  || orb.x - orb.radius < 0) orb.vx *= -1;
        if (orb.y + orb.radius > canvas.height || orb.y - orb.radius < 0) orb.vy *= -1;
        orb.x += orb.vx;
        orb.y += orb.vy;

        const grad = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.radius);
        grad.addColorStop(0, orb.color + 'CC');
        grad.addColorStop(0.5, orb.color + '40');
        grad.addColorStop(1, 'transparent');

        ctx.globalAlpha = orb.opacity;
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        pointerEvents: 'none',
      }}
    />
  );
}
```



### 5.4 The Core Liquid Glass Mixin

```css
/* src/styles/liquid-glass/material.css */

/* ---------------------------------------------------------
   LIQUID GLASS SURFACE
   Implements: backdrop blur + refraction displacement +
   specular edge highlight + chromatic aberration fringe +
   subtle surface tint
   --------------------------------------------------------- */

.glass-surface {
  /* 1. Backdrop effect — main material */
  backdrop-filter:
    blur(var(--lg-glass-blur))
    saturate(var(--lg-glass-saturation))
    brightness(var(--lg-glass-brightness));
  -webkit-backdrop-filter:
    blur(var(--lg-glass-blur))
    saturate(var(--lg-glass-saturation))
    brightness(var(--lg-glass-brightness));

  /* 2. Base fill — extremely subtle tint */
  background: rgba(255,255,255,var(--lg-fill-opacity));

  /* 3. Edge specular (top rim highlight — like light catching glass edge) */
  border: 1px solid transparent;
  background-clip: padding-box;
  position: relative;
  overflow: hidden;
}

/* 4. Top specular highlight — the key Liquid Glass "edge" effect */
.glass-surface::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1px;
  background: linear-gradient(
    160deg,
    rgba(255,255,255,0.55) 0%,
    rgba(255,255,255,0.12) 30%,
    rgba(255,255,255,0.04) 60%,
    rgba(255,255,255,0.15) 100%
  );
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}

/* 5. Chromatic aberration — colored fringe at edges */
.glass-surface::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background:
    linear-gradient(90deg,
      rgba(120,0,255,0.04) 0%,
      transparent 30%,
      transparent 70%,
      rgba(0,120,255,0.04) 100%
    );
  pointer-events: none;
}

/* === DEPTH VARIANTS === */
.glass-surface--near   { --lg-glass-blur: 48px; --lg-fill-opacity: 0.12; }
.glass-surface--mid    { --lg-glass-blur: 28px; --lg-fill-opacity: 0.08; }
.glass-surface--far    { --lg-glass-blur: 12px; --lg-fill-opacity: 0.05; }

/* === TINT VARIANTS (per-portal) === */
.glass-surface--admin    { background: rgba(10,132,255,0.08); }
.glass-surface--supplier { background: rgba(48,209,88,0.08); }
.glass-surface--buyer    { background: rgba(255,159,10,0.08); }
```



### 5.5 Refraction Displacement Effect

```typescript
// src/utils/liquidGlassRefraction.ts
// Simulates optical refraction distortion using CSS filter + SVG feTurbulence
// Applied to glass surfaces to simulate light bending through curved glass

export function injectRefractionFilter() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden');
  svg.innerHTML = `
    <defs>
      <filter id="glass-refract" x="-10%" y="-10%" width="120%" height="120%"
              color-interpolation-filters="sRGB">
        <!-- Subtle surface distortion -->
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.015 0.010"
          numOctaves="2"
          seed="2"
          result="noise"
        />
        <feDisplacementMap
          in="SourceGraphic"
          in2="noise"
          scale="4"
          xChannelSelector="R"
          yChannelSelector="G"
          result="displaced"
        />
        <!-- Slight color separation (chromatic aberration) -->
        <feColorMatrix
          in="displaced"
          type="matrix"
          values="1.02 0    0    0  -0.01
                  0    1    0    0   0
                  0    0    0.98 0   0.01
                  0    0    0    1   0"
        />
      </filter>

      <!-- Animated ripple for interaction -->
      <filter id="glass-ripple" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence
          type="turbulence"
          baseFrequency="0.02"
          numOctaves="3"
          result="turbulence"
        >
          <animate
            attributeName="baseFrequency"
            dur="0.6s"
            values="0.02;0.04;0.02"
            fill="freeze"
            begin="indefinite"
            id="rippleAnim"
          />
        </feTurbulence>
        <feDisplacementMap
          in="SourceGraphic"
          in2="turbulence"
          scale="8"
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </defs>
  `;
  document.body.appendChild(svg);
}

// Apply refraction filter to all glass surfaces
export function applyRefractionToGlass() {
  document.querySelectorAll('.glass-surface').forEach(el => {
    (el as HTMLElement).style.filter = 'url(#glass-refract)';
  });
}

// Trigger ripple on click/interaction
export function triggerGlassRipple(element: HTMLElement) {
  element.style.filter = 'url(#glass-ripple)';
  const anim = document.getElementById('rippleAnim') as SVGAnimateElement;
  anim?.beginElement();
  setTimeout(() => {
    element.style.filter = 'url(#glass-refract)';
  }, 600);
}
```



### 5.6 Surface Tension Animation

```css
/* src/styles/liquid-glass/animations.css */

/* Glass cards "breathe" very subtly — surface tension effect */
@keyframes glassBreathe {
  0%, 100% {
    backdrop-filter: blur(28px) saturate(220%) brightness(1.08);
    -webkit-backdrop-filter: blur(28px) saturate(220%) brightness(1.08);
  }
  50% {
    backdrop-filter: blur(32px) saturate(240%) brightness(1.10);
    -webkit-backdrop-filter: blur(32px) saturate(240%) brightness(1.10);
  }
}

.theme-liquid-glass .glass-surface {
  animation: glassBreathe 8s ease-in-out infinite;
}

/* On hover: glass "pulls" toward cursor — surface tension */
.theme-liquid-glass .glass-surface:hover {
  animation: glassHoverPull 300ms cubic-bezier(0.25,0.1,0.25,1) forwards;
}

@keyframes glassHoverPull {
  to {
    backdrop-filter: blur(36px) saturate(260%) brightness(1.12);
    -webkit-backdrop-filter: blur(36px) saturate(260%) brightness(1.12);
    transform: translateY(-2px) scale(1.005);
    box-shadow:
      0 12px 40px rgba(0,0,0,0.30),
      0 0 0 0.5px rgba(255,255,255,0.25) inset,
      0 1px 0 rgba(255,255,255,0.5) inset;
  }
}

/* On press: glass "indents" — tactile feel */
.theme-liquid-glass .glass-surface:active {
  animation: none;
  transform: scale(0.995);
  backdrop-filter: blur(24px) saturate(200%) brightness(1.05);
  -webkit-backdrop-filter: blur(24px) saturate(200%) brightness(1.05);
}

/* Liquid Glass card entrance */
@keyframes glassReveal {
  0% {
    opacity: 0;
    backdrop-filter: blur(0px) saturate(100%);
    -webkit-backdrop-filter: blur(0px) saturate(100%);
    transform: translateY(20px) scale(0.97);
  }
  100% {
    opacity: 1;
    backdrop-filter: blur(28px) saturate(220%);
    -webkit-backdrop-filter: blur(28px) saturate(220%);
    transform: translateY(0) scale(1);
  }
}

.theme-liquid-glass .glass-surface {
  animation: glassReveal 600ms cubic-bezier(0.32,0.72,0,1) both;
}
```



### 5.7 Liquid Glass Navbar

```css
/* src/styles/liquid-glass/navbar.css */
.theme-liquid-glass .apple-navbar {
  background: rgba(255,255,255,0.05);
  backdrop-filter: blur(48px) saturate(250%) brightness(1.15);
  -webkit-backdrop-filter: blur(48px) saturate(250%) brightness(1.15);
  border-bottom: 0.5px solid rgba(255,255,255,0.15);
  box-shadow:
    0 1px 0 rgba(255,255,255,0.10) inset,   /* top specular */
    0 4px 24px rgba(0,0,0,0.20);
  position: relative;
}

/* Liquid Glass logo text */
.theme-liquid-glass .apple-navbar__logo {
  color: rgba(255,255,255,0.92);
  text-shadow: 0 0 20px rgba(255,255,255,0.20);
}

.theme-liquid-glass .apple-navbar__link {
  color: rgba(255,255,255,0.70);
}

.theme-liquid-glass .apple-navbar__link:hover {
  color: rgba(255,255,255,0.95);
  background: rgba(255,255,255,0.10);
}

.theme-liquid-glass .apple-navbar__link.active {
  color: rgba(255,255,255,0.95);
  background: rgba(255,255,255,0.15);
}
```



### 5.8 Liquid Glass Cards

```css
/* src/styles/liquid-glass/card.css */
.theme-liquid-glass .apple-card {
  background: rgba(255,255,255,0.07);
  backdrop-filter: blur(28px) saturate(220%) brightness(1.08);
  -webkit-backdrop-filter: blur(28px) saturate(220%) brightness(1.08);
  border: none;
  border-radius: 16px;
  position: relative;
  overflow: hidden;
  box-shadow:
    0 8px 32px rgba(0,0,0,0.25),
    0 1px 0 rgba(255,255,255,0.45) inset,    /* top specular */
    0 -1px 0 rgba(255,255,255,0.08) inset,   /* bottom sub-specular */
    0 0 0 0.5px rgba(255,255,255,0.15);      /* border glow */
}

/* Specular rim highlight overlay */
.theme-liquid-glass .apple-card::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1px;
  background: linear-gradient(
    145deg,
    rgba(255,255,255,0.55) 0%,
    rgba(255,255,255,0.08) 40%,
    rgba(255,255,255,0.00) 60%,
    rgba(255,255,255,0.12) 100%
  );
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
  z-index: 1;
}

/* Inner light scatter */
.theme-liquid-glass .apple-card::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 40%;
  background: linear-gradient(
    180deg,
    rgba(255,255,255,0.05) 0%,
    transparent 100%
  );
  border-radius: 16px 16px 0 0;
  pointer-events: none;
  z-index: 1;
}

.theme-liquid-glass .apple-card .apple-card__title {
  color: rgba(255,255,255,0.95);
}

.theme-liquid-glass .apple-card .apple-card__subtitle {
  color: rgba(255,255,255,0.60);
}
```



### 5.9 Liquid Glass Buttons

```css
/* src/styles/liquid-glass/button.css */
.theme-liquid-glass .btn-primary {
  background: rgba(10,132,255,0.70);
  backdrop-filter: blur(20px) saturate(200%);
  -webkit-backdrop-filter: blur(20px) saturate(200%);
  border: 0.5px solid rgba(255,255,255,0.30);
  box-shadow:
    0 4px 16px rgba(10,132,255,0.30),
    0 1px 0 rgba(255,255,255,0.35) inset;
  color: rgba(255,255,255,0.96);
}

.theme-liquid-glass .btn-primary:hover {
  background: rgba(10,132,255,0.85);
  box-shadow:
    0 6px 24px rgba(10,132,255,0.45),
    0 1px 0 rgba(255,255,255,0.40) inset;
}

.theme-liquid-glass .btn-secondary {
  background: rgba(255,255,255,0.10);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 0.5px solid rgba(255,255,255,0.20);
  color: rgba(255,255,255,0.90);
  box-shadow: 0 1px 0 rgba(255,255,255,0.25) inset;
}

.theme-liquid-glass .btn-secondary:hover {
  background: rgba(255,255,255,0.18);
}
```



### 5.10 Liquid Glass Form Inputs

```css
/* src/styles/liquid-glass/form.css */
.theme-liquid-glass .apple-input {
  background: rgba(255,255,255,0.08);
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  border: 0.5px solid rgba(255,255,255,0.15);
  color: rgba(255,255,255,0.92);
  box-shadow:
    0 1px 0 rgba(255,255,255,0.20) inset,
    0 4px 12px rgba(0,0,0,0.15);
}

.theme-liquid-glass .apple-input::placeholder {
  color: rgba(255,255,255,0.35);
}

.theme-liquid-glass .apple-input:focus {
  background: rgba(255,255,255,0.12);
  border-color: rgba(10,132,255,0.60);
  box-shadow:
    0 0 0 3px rgba(10,132,255,0.25),
    0 1px 0 rgba(255,255,255,0.25) inset;
}
```



### 5.11 Liquid Glass Sidebar

```css
/* src/styles/liquid-glass/sidebar.css */
.theme-liquid-glass .apple-sidebar {
  background: rgba(255,255,255,0.05);
  backdrop-filter: blur(48px) saturate(240%) brightness(1.10);
  -webkit-backdrop-filter: blur(48px) saturate(240%) brightness(1.10);
  border-right: 0.5px solid rgba(255,255,255,0.12);
  box-shadow:
    inset -1px 0 0 rgba(255,255,255,0.08);
}

.theme-liquid-glass .sidebar-item {
  color: rgba(255,255,255,0.75);
}

.theme-liquid-glass .sidebar-item:hover {
  background: rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.95);
}

.theme-liquid-glass .sidebar-item.active {
  background: rgba(10,132,255,0.30);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 0.5px solid rgba(10,132,255,0.40);
  color: rgba(255,255,255,0.95);
  box-shadow: 0 1px 0 rgba(255,255,255,0.20) inset;
}
```



### 5.12 Liquid Glass Table

```css
/* src/styles/liquid-glass/table.css */
.theme-liquid-glass .apple-table {
  border-radius: 12px;
  overflow: hidden;
  background: rgba(255,255,255,0.05);
  backdrop-filter: blur(20px) saturate(200%);
  -webkit-backdrop-filter: blur(20px) saturate(200%);
  border: 0.5px solid rgba(255,255,255,0.12);
}

.theme-liquid-glass .apple-table th {
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.55);
  border-bottom: 0.5px solid rgba(255,255,255,0.10);
}

.theme-liquid-glass .apple-table td {
  color: rgba(255,255,255,0.85);
  border-bottom: 0.5px solid rgba(255,255,255,0.06);
}

.theme-liquid-glass .apple-table tbody tr:hover {
  background: rgba(255,255,255,0.05);
}
```

---



## 6. PORTAL-SPECIFIC DESIGNS



### 6.1 Admin Portal (localhost:3000)

```
IDENTITY: Control center — deep authority.
COLOR ACCENT (Apple): #0071E3 (system blue)
COLOR ACCENT (Liquid Glass): rgba(10,132,255,0.70)

LAYOUT:
┌─────────────────────────────────────────────────┐
│  [Logo] Admin              [Nav links] [Avatar]  │  ← sticky 52px nav
├──────────┬──────────────────────────────────────┤
│          │  ┌─ KPI Strip ──────────────────────┐│
│ Sidebar  │  │ $2.4M  │  47  │  98%  │  312     ││
│          │  └──────────────────────────────────┘│
│ Overview │  ┌─ Grid (2×2) ──────────────────────┐│
│ Orders   │  │ Approval Queue  │ Spend Chart     ││
│ Suppliers│  ├─────────────────┼─────────────────┤│
│ Reports  │  │ Supplier Map    │ Activity Feed   ││
│ Settings │  └──────────────────────────────────┘│
└──────────┴──────────────────────────────────────┘

KEY SCREENS TO REDESIGN:
1. Dashboard — KPI strip + 4-panel grid
2. Order Management — Table with inline actions
3. Supplier Directory — Card grid with search/filter
4. Approval Workflows — Kanban-style columns
5. Analytics — Charts with Apple-style data viz
6. Settings — Grouped form sections
```



### 6.2 Supplier Portal (localhost:3001)

```
IDENTITY: Partnership — clarity and trust.
COLOR ACCENT (Apple): #30D158 (system green)
COLOR ACCENT (Liquid Glass): rgba(48,209,88,0.65)

LAYOUT:
┌─────────────────────────────────────────────────┐
│  [Logo] Supplier               [Notifications]  │
├──────────┬──────────────────────────────────────┤
│          │  ┌─ Welcome Banner ─────────────────┐│
│ Sidebar  │  │ "Hello, Acme Corp"  [Quick Act.] ││
│          │  └──────────────────────────────────┘│
│ My POs   │  ┌─ Active Orders ───────────────────┐│
│ Catalog  │  │ Table: PO # | Buyer | Amount | Due││
│ Invoices │  │ [pagination]                      ││
│ Messages │  └──────────────────────────────────┘│
│ Profile  │  ┌─ Performance ─────────────────────┐│
│          │  │ Delivery Rate | Quality | Rating  ││
└──────────┴──────────────────────────────────────┘

KEY SCREENS:
1. My Purchase Orders — Status timeline view
2. Product Catalog — Upload/manage with drag-drop
3. Invoices — Create / track payment status
4. Performance Dashboard — Metrics cards
5. Messaging — Clean chat-style thread UI
6. Profile & Compliance — Document uploads
```



### 6.3 Buyer Portal (localhost:3002)

```
IDENTITY: Efficiency — shopping meets enterprise.
COLOR ACCENT (Apple): #FF9F0A (system orange)
COLOR ACCENT (Liquid Glass): rgba(255,159,10,0.65)

LAYOUT:
┌─────────────────────────────────────────────────┐
│  [Logo] Buyer          [🔍 Search] [Cart: 3]    │
├──────────┬──────────────────────────────────────┤
│          │  ┌─ Smart Banner ────────────────────┐│
│ Sidebar  │  │ "Quick Reorder: Your last 3 items"││
│          │  └──────────────────────────────────┘│
│ Catalog  │  ┌─ Catalog Grid ────────────────────┐│
│ My Reqs  │  │ [Filter bar]                      ││
│ Orders   │  │ Card Card Card Card               ││
│ Approvals│  │ Card Card Card Card               ││
│ Reports  │  └──────────────────────────────────┘│
└──────────┴──────────────────────────────────────┘

KEY SCREENS:
1. Product Catalog — Supplier card grid + filters
2. Purchase Requisitions — Wizard-style form flow
3. My Orders — Timeline with tracking
4. Approval Status — Status board
5. Budget Overview — Spend gauge + chart
6. Quick Reorder — 1-click reorder history
```

---



## 7. COMPONENT LIBRARY INDEX

All components must be built in this order:

```
src/
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx          # Navbar + Sidebar + Content area
│   │   ├── Navbar.tsx            # With ThemeSwitcher
│   │   ├── Sidebar.tsx           # Collapsible, responsive
│   │   └── PageHeader.tsx        # Title + breadcrumb + actions
│   ├── ui/
│   │   ├── Button.tsx            # All variants: primary, secondary, ghost, destructive, icon
│   │   ├── Card.tsx              # With glass variant support
│   │   ├── Badge.tsx             # Status badges
│   │   ├── Input.tsx             # Text, search, select, textarea
│   │   ├── Toggle.tsx            # SF-style toggle switch
│   │   ├── Modal.tsx             # Sheet (mobile) + Dialog (desktop)
│   │   ├── Toast.tsx             # Notification banner
│   │   ├── Dropdown.tsx          # Menu with keyboard nav
│   │   ├── Tabs.tsx              # Segmented control style
│   │   ├── Tooltip.tsx           # Hover tooltip
│   │   ├── Avatar.tsx            # User/company avatar
│   │   ├── Progress.tsx          # Linear + radial
│   │   └── Skeleton.tsx          # Loading state
│   ├── data/
│   │   ├── Table.tsx             # Sortable, filterable data table
│   │   ├── KPICard.tsx           # Number counter widget
│   │   ├── ChartCard.tsx         # Wrapper for charts
│   │   └── DataEmpty.tsx         # Empty state
│   ├── glass/
│   │   ├── LiquidGlassBackground.tsx  # Canvas wallpaper
│   │   ├── GlassCard.tsx              # Glass surface card
│   │   ├── GlassModal.tsx             # Glass sheet/dialog
│   │   └── GlassRipple.tsx            # Interaction ripple hook
│   └── theme/
│       ├── ThemeProvider.tsx
│       └── ThemeSwitcher.tsx
├── styles/
│   ├── apple-base.css
│   ├── apple-tokens.css
│   ├── components/
│   │   ├── navbar.css, card.css, button.css, form.css, ...
│   └── liquid-glass/
│       ├── tokens.css, background.css, material.css,
│       ├── animations.css, navbar.css, card.css, ...
└── pages/
    ├── admin/   (Dashboard, Orders, Suppliers, Approvals, Analytics, Settings)
    ├── supplier/ (Dashboard, POs, Catalog, Invoices, Messages, Profile)
    └── buyer/   (Catalog, Requisitions, Orders, Approvals, Budget, Reorder)
```

---



## 8. MICRO-INTERACTIONS & EFFECTS CATALOG



### 8.1 Number Counter Animation

```typescript
// Animate KPI numbers from 0 to value on mount (Apple.com style)
export function useCountUp(
  target: number,
  duration = 1200,
  delay = 0,
  decimals = 0
) {
  const [value, setValue] = useState(0);
  const startTime = useRef<number | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const animate = (time: number) => {
        if (!startTime.current) startTime.current = time;
        const progress = Math.min((time - startTime.current) / duration, 1);
        // Apple-style ease-out (not linear)
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(parseFloat((eased * target).toFixed(decimals)));
        if (progress < 1) requestAnimationFrame(animate);
        else setValue(target);
      };
      requestAnimationFrame(animate);
    }, delay);
    return () => clearTimeout(timeout);
  }, [target, duration, delay, decimals]);

  return value;
}
```



### 8.2 Hover Parallax (Apple.com product cards)

```typescript
// Cards tilt very subtly on hover — exactly like Apple product cards
export function useParallaxTilt(ref: RefObject<HTMLElement>, intensity = 8) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / (rect.width / 2);
      const dy = (e.clientY - cy) / (rect.height / 2);
      const rotateX = -dy * intensity;
      const rotateY = dx * intensity;
      el.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    };

    const handleMouseLeave = () => {
      el.style.transition = 'transform 400ms cubic-bezier(0.25,0.1,0.25,1)';
      el.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg)';
      setTimeout(() => { el.style.transition = ''; }, 400);
    };

    el.addEventListener('mousemove', handleMouseMove);
    el.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      el.removeEventListener('mousemove', handleMouseMove);
      el.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [intensity]);
}
```



### 8.3 Liquid Glass Cursor Interaction

```typescript
// When cursor moves over a glass surface, the specular highlight follows
// Simulates real glass catching ambient light

export function useLiquidGlassCursor(ref: RefObject<HTMLElement>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;

      // Move the specular highlight to follow cursor
      el.style.setProperty('--specular-x', `${x}%`);
      el.style.setProperty('--specular-y', `${y}%`);
    };

    el.addEventListener('mousemove', handleMouseMove);
    return () => el.removeEventListener('mousemove', handleMouseMove);
  }, []);
}

/* CSS to consume --specular-x and --specular-y */
.theme-liquid-glass .glass-surface {
  --specular-x: 30%;
  --specular-y: 20%;
}

.theme-liquid-glass .glass-surface::before {
  background: radial-gradient(
    circle at var(--specular-x) var(--specular-y),
    rgba(255,255,255,0.35) 0%,
    rgba(255,255,255,0.08) 40%,
    transparent 70%
  );
  transition: background 80ms linear;
}
```



### 8.4 Page Transition

```typescript
// src/components/PageTransition.tsx
// Apple-style: content fades and slides up, previous content fades down

export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {children}
    </motion.div>
  );
}
```

---



## 9. RESPONSIVE BREAKPOINTS

```css
/* Apple-aligned breakpoints */
:root {
  --bp-sm:   480px;  /* Large phone */
  --bp-md:   768px;  /* iPad Mini */
  --bp-lg:   1024px; /* iPad Pro / small laptop */
  --bp-xl:   1280px; /* MacBook */
  --bp-2xl:  1440px; /* iMac / large display */
}

/* On mobile: sidebar becomes bottom tab bar (Apple HIG pattern) */
@media (max-width: 768px) {
  .apple-sidebar {
    display: none;
  }
  .apple-tab-bar {
    display: flex;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 84px; /* includes safe area */
    padding-bottom: env(safe-area-inset-bottom);
    background: var(--apple-vibrancy-light);
    backdrop-filter: blur(20px) saturate(180%);
    border-top: 0.5px solid var(--apple-separator);
    justify-content: space-around;
    align-items: center;
    z-index: 100;
  }
}
```

---



## 10. PERFORMANCE & ACCESSIBILITY



### 10.1 Performance Requirements

```typescript
// Liquid Glass performance guardrails
// backdrop-filter is GPU-heavy — limit simultaneous glass layers

const MAX_GLASS_LAYERS = 4; // Never exceed 4 active backdrop-filter elements in viewport

// Virtualize long lists — tables with > 50 rows must use virtual scrolling
// Use react-virtual or tanstack-virtual

// Preload fonts
// In HTML head:
// <link rel="preconnect" href="https://fonts.googleapis.com">
// For SF Pro fallback — use system-ui in production

// Throttle cursor tracking to 60fps max
const throttledMouseMove = throttle(handleMouseMove, 16);

// Disable Liquid Glass on reduced-motion / low-end devices
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isLowEnd = navigator.hardwareConcurrency <= 4;
if (prefersReducedMotion || isLowEnd) {
  document.documentElement.classList.add('glass-lite');
}

/* glass-lite: simplified glass without animation or refraction */
.glass-lite .glass-surface {
  animation: none !important;
  filter: none !important;
  backdrop-filter: blur(12px) !important;
}
```



### 10.2 Accessibility

```css
/* High contrast override for glass theme */
@media (forced-colors: active) {
  .glass-surface {
    background: Canvas !important;
    border: 2px solid ButtonText !important;
    backdrop-filter: none !important;
  }
}

/* Focus visible — Apple-style blue ring */
:focus-visible {
  outline: 3px solid rgba(0,122,255,0.60);
  outline-offset: 2px;
  border-radius: 4px;
}

/* Skip to content */
.skip-link {
  position: absolute;
  top: -40px;
  left: 8px;
  background: var(--apple-blue);
  color: white;
  padding: 8px 16px;
  border-radius: 8px;
  z-index: 1000;
  transition: top 200ms;
}
.skip-link:focus { top: 8px; }
```

---



## 12. ANTIGRAVITY CLI IMPLEMENTATION PLAN PROMPT

> **Copy this verbatim as your planning prompt in Antigravity planning mode:**

```
PLANNING MODE REQUEST

Project: Procurement Portal Apple Design Redesign
Model: gemini-3.7-flash
Portals: admin (localhost:3000), supplier (localhost:3001), buyer (localhost:3002)
Spec file: PROCUREMENT_APPLE_DESIGN_SPEC.md

Create a detailed implementation plan with the following requirements:

PHASE 1 — SHARED FOUNDATION (implement first, used by all portals)
1.1 Install dependencies: tailwindcss, framer-motion, lucide-react, react-virtual
1.2 Create CSS custom property token files (apple-tokens.css, liquid-glass/tokens.css)
1.3 Build ThemeProvider + ThemeSwitcher (3 themes: apple-light, apple-dark, liquid-glass)
1.4 Build LiquidGlassBackground canvas component
1.5 Inject SVG refraction filters (glass-refract, glass-ripple)
1.6 Build base components: Button (5 variants), Card, Badge, Input, Toggle, Modal, Toast
1.7 Build layout: Navbar (with ThemeSwitcher), Sidebar, AppShell, PageTransition
1.8 Implement hooks: useAppleReveal, useCountUp, useParallaxTilt, useLiquidGlassCursor
1.9 Build data components: Table, KPICard, ChartCard, DataEmpty, Skeleton
1.10 Test all 3 themes on all components — screenshot each

PHASE 2 — ADMIN PORTAL (localhost:3002)
2.1 Apply AppShell to admin layout
2.2 Redesign Dashboard: KPI strip (4 metrics) + 4-panel grid
2.3 Redesign Order Management: sortable table + inline actions + status badges
2.4 Redesign Supplier Directory: card grid + search + filter bar
2.5 Redesign Approval Workflows: kanban columns with drag feedback
2.6 Redesign Analytics: charts + data visualization cards
2.7 Redesign Settings: grouped form sections + toggles
2.8 Verify all 3 themes render correctly

PHASE 3 — SUPPLIER PORTAL (localhost:3001)
3.1 Apply AppShell with green accent overrides
3.2 Redesign Dashboard: welcome banner + active PO table + performance metrics
3.3 Redesign Purchase Orders: status timeline + action buttons
3.4 Redesign Catalog: drag-drop upload + product grid
3.5 Redesign Invoices: create form + payment status tracker
3.6 Redesign Messages: chat-style thread UI
3.7 Redesign Profile & Compliance: document upload sections
3.8 Verify all 3 themes render correctly

PHASE 4 — BUYER PORTAL (localhost:3000)
4.1 Apply AppShell with orange accent overrides
4.2 Redesign Catalog: supplier card grid + category filter + search
4.3 Redesign Requisitions: multi-step wizard form
4.4 Redesign Orders: timeline tracking view
4.5 Redesign Approvals: status board with badges
4.6 Redesign Budget: spend gauge + donut chart + history table
4.7 Redesign Quick Reorder: 1-click reorder history list
4.8 Verify all 3 themes render correctly

PHASE 5 — LIQUID GLASS POLISH
5.1 Audit all glass surfaces — ensure ≤ 4 backdrop-filter layers in viewport
5.2 Tune refraction SVG filter values per surface type
5.3 Verify cursor specular highlight tracking on all glass cards
5.4 Test surface tension hover animation timing (300ms pull, 150ms settle)
5.5 Test glass ripple on all interactive glass elements
5.6 Performance: run Lighthouse — target LCP < 2.5s, FID < 100ms
5.7 Add glass-lite fallback for prefers-reduced-motion and low-end devices
5.8 Accessibility: test keyboard navigation, focus rings, screen reader labels

PHASE 6 — FINAL INTEGRATION
6.1 Theme persistence via localStorage across all portals
6.2 Page transition animations between routes
6.3 Final cross-browser test (Chrome, Safari, Firefox)
6.4 Safari backdrop-filter -webkit-prefix verification
6.5 Mobile responsive test at 375px, 768px, 1024px breakpoints
6.6 Final Lighthouse audit all 3 portals all 3 themes

Output the plan as ordered tasks with:
- Task ID (e.g. 1.1, 1.2)
- File path(s) to create/modify
- Exact implementation steps
- Dependencies (which tasks must precede it)
- Estimated complexity: Low / Medium / High
- Verification step (how to confirm it works)
```

---



## 13. IMPLEMENTATION PROMPT (for running after plan)

> **Use this as your implementation command in Antigravity:**

```
IMPLEMENT: Procurement Portal Apple Design System

Spec: PROCUREMENT_APPLE_DESIGN_SPEC.md
Plan: [your generated plan file]

Execute Phase 1 first — complete all shared foundation components before touching any portal.

CRITICAL RULES for Liquid Glass:
1. NEVER use backdrop-filter alone as "Liquid Glass" — it is frosted glass (2014).
   Real Liquid Glass = backdrop-filter + specular border-gradient + ::before chromatic mask + SVG feTurbulence refraction + cursor-tracking radial highlight.
2. ALWAYS apply the SVG glass-refract filter to .glass-surface elements in Liquid Glass theme.
3. The specular highlight (::before gradient) MUST move with the cursor using CSS custom properties --specular-x and --specular-y.
4. Limit active backdrop-filter elements to 4 in viewport simultaneously.
5. ALWAYS add -webkit-backdrop-filter alongside backdrop-filter for Safari.
6. Liquid Glass background MUST be an animated canvas (not a static gradient) — glass needs moving content to refract.

APPLE DESIGN RULES:
1. All transitions use cubic-bezier(0.25, 0.1, 0.25, 1) — no ease-in-out, no linear.
2. Border radius hierarchy: 980px (pill buttons), 20px (modals), 16px (large cards), 12px (cards), 8px (inputs).
3. Buttons MUST be pill-shaped (border-radius: 980px) for primary actions.
4. Typography: SF Pro fallback = -apple-system, BlinkMacSystemFont, 'Inter', sans-serif.
5. Dark backgrounds use #000000 (not #111111 or #0B0B0B).
6. Single subtle hover elevation on cards: translateY(-1px) + increased shadow.
7. NEVER stack multiple box-shadows for depth — one shadow per element.
8. Scroll-triggered reveals: opacity + translateY(24px), single 600ms transition per section group.
9. Number KPIs use useCountUp hook — animate from 0 to value on viewport entry.
10. Theme switcher is a segmented control in the navbar, always visible.

START with: Phase 1, Task 1.1 — install dependencies and verify package.json.
```

---



## 14. QUICK REFERENCE CHECKLIST

Before marking any component complete, verify:

- [ ] Renders correctly in all 3 themes (apple-light, apple-dark, liquid-glass)
- [ ] All transitions use `cubic-bezier(0.25, 0.1, 0.25, 1)`
- [ ] Liquid Glass: both `backdrop-filter` AND `-webkit-backdrop-filter` present
- [ ] Liquid Glass: `::before` specular gradient exists
- [ ] Liquid Glass: cursor tracking via `--specular-x` / `--specular-y` works
- [ ] Liquid Glass: SVG refraction filter applied
- [ ] Dark mode: correct token values from `--apple-*-dark` set
- [ ] Focus rings visible and correct color
- [ ] `@media (prefers-reduced-motion)` disables all animations
- [ ] Mobile breakpoint: sidebar → tab bar transformation works
- [ ] No hard-coded hex colors — only CSS custom properties used
- [ ] Accessible: role, aria-label, aria-pressed set on interactive elements

---

*End of Specification — PROCUREMENT_APPLE_DESIGN_SPEC.md*
*Version 1.0 | Prepared for Antigravity CLI + Gemini 3.7 Flash*