# SGM Client Portal — Design Style Guide

Use this document as a reference when building new pages or components for the SGM Client Portal. It captures every design decision so that new work matches the existing look and feel exactly.

---

## 1. Design Philosophy

**Dark glass-morphism with gradient accents.** Every surface sits on a deep, near-black background. Cards and containers use semi-transparent backgrounds with `backdrop-filter: blur()` to create a frosted-glass effect. Brand colour pops come from a pink-to-purple gradient used sparingly on buttons, badges, and accent lines.

Key principles:
- **Depth through transparency** — surfaces are layered with varying opacity, never solid mid-tones
- **Restraint with colour** — the gradient is an accent, not a background; most UI is monochrome white-on-dark
- **Generous spacing** — components breathe; padding is always 20px+ on cards
- **Uppercase Oswald for structure** — headings, labels, and navigation all use Oswald in uppercase with wide letter-spacing to create a premium, editorial feel
- **Subtle motion** — hover lifts (`translateY(-2px)`), smooth transitions (0.2–0.3s), and staggered fade-in animations on page load

---

## 2. Colour Palette

### Backgrounds (darkest → lightest)
| Token | Value | Usage |
|---|---|---|
| `--bg-deepest` | `#0e0918` | `<body>` background, deepest layer |
| `--bg-base` | `#26153a` | Table headers, secondary panels |
| `--bg-elevated` | `#3c2c4e` | Modal dialogs, elevated surfaces |
| `--bg-card` | `rgba(255,255,255,0.03)` | Glass cards, table wrapper |
| `--bg-card-hover` | `rgba(255,255,255,0.06)` | Card hover state |
| `--bg-input` | `rgba(255,255,255,0.05)` | Form inputs, textareas |

### Brand
| Token | Value | Usage |
|---|---|---|
| `--brand-gradient` | `linear-gradient(126deg, #ff1cc0 52%, #7f5fce 86%)` | Primary buttons, accent bars, gradient text |
| `--brand-pink` | `#ff1cc0` | Active sort arrows, active state highlights |
| `--brand-purple` | `#7f5fce` | Focus rings, active nav items, hover borders |

### Text
| Token | Value | Usage |
|---|---|---|
| `--text-primary` | `#ffffff` | Headings, body text, interactive elements |
| `--text-secondary` | `rgba(255,255,255,0.6)` | Descriptions, metadata, nav links |
| `--text-muted` | `rgba(255,255,255,0.35)` | Placeholders, timestamps, disabled states |

### Borders
| Token | Value | Usage |
|---|---|---|
| `--border-glass` | `rgba(255,255,255,0.1)` | Card borders, dividers, input borders |
| `--border-subtle` | `rgba(255,255,255,0.06)` | Table row separators, internal dividers |
| `--border-focus` | `rgba(127,95,206,0.5)` | Focus ring colour |

### Status Colours (for badges/indicators)
| Status | Background | Text | Border |
|---|---|---|---|
| Not Started | `rgba(156,163,175,0.15)` | `#9CA3AF` | `#6B7280` |
| Briefed | `rgba(59,130,246,0.15)` | `#60A5FA` | `#3B82F6` |
| In Progress | `rgba(245,158,11,0.15)` | `#FBBF24` | `#F59E0B` |
| Blocked | `rgba(239,68,68,0.15)` | `#F87171` | `#EF4444` |
| On Hold | `rgba(100,116,139,0.15)` | `#94A3B8` | `#64748B` |
| Complete | `rgba(16,185,129,0.15)` | `#34D399` | `#10B981` |
| Ready for Review | `rgba(127,95,206,0.15)` | `#A78BFA` | `#7F5FCE` |

### Priority Colours
| Priority | Background | Text |
|---|---|---|
| High | `rgba(239,68,68,0.15)` | `#F87171` |
| Medium | `rgba(245,158,11,0.15)` | `#FBBF24` |
| Low | `rgba(156,163,175,0.15)` | `#9CA3AF` |

> **Pattern:** Status and priority badges always use a tinted semi-transparent background with a matching text colour. The background opacity is always `0.15`. This keeps them readable against the dark surface without being garish.

---

## 3. Typography

### Fonts
```css
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Open+Sans:wght@400;500;600;700&display=swap');
```

| Role | Font | Weights Used |
|---|---|---|
| **Display / headings** | Oswald | 400, 500, 600, 700 |
| **Body / UI text** | Open Sans | 400, 500, 600, 700 |

### Typography Rules

**Oswald (display font)** is used for:
- All headings (page titles, card titles, widget titles)
- Navigation links
- Button labels
- Table column headers
- Labels and badges
- Section labels
- Summary card labels and counts

**Open Sans (body font)** is used for:
- Body/paragraph text
- Descriptions
- Form inputs and textareas
- Filter controls
- Metadata text

### Heading Hierarchy
| Element | Font | Size | Weight | Transform | Letter-Spacing |
|---|---|---|---|---|---|
| Page title (h1) | Oswald | 36px (28px mobile) | 700 | uppercase | 1px |
| Home welcome | Oswald | 42px (28px mobile) | 700 | uppercase | 1px |
| Widget title | Oswald | 18–20px | 600 | uppercase | 0.5–1.5px |
| Card title | Oswald | 18px | 600 | uppercase | 0.3px |
| Section label | Oswald | 13px | 600 | uppercase | 2px |
| Table header | Oswald | 11px | 600 | uppercase | 1.2px |
| Small label | Oswald | 11–12px | 600 | uppercase | 1–1.5px |

### Body Text Sizes
| Usage | Size | Line-Height |
|---|---|---|
| Standard body | 14–15px | 1.6 |
| Small / meta | 13px | 1.4 |
| Table cells | 14px | 1.6 |
| Tiny (sub-labels) | 12px | 1.4 |

> **Key rule:** Oswald text is ALWAYS `text-transform: uppercase` with positive `letter-spacing` (1px–2px). Never use Oswald in sentence case.

---

## 4. Spacing & Layout

### Border Radii
| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | `12px` | Cards, inputs, small containers |
| `--radius-md` | `20px` | Glass cards, modals, featured sections |
| `--radius-pill` | `40px` | Buttons, badges, nav links, pills |

### Shadows
```css
--shadow-card: 0 2px 4px rgba(0,0,0,0.2), 0 10px 30px rgba(0,0,0,0.15), 0 25px 50px rgba(0,0,0,0.1);
--shadow-glow: 0 0 30px rgba(127,95,206,0.15), 0 0 60px rgba(255,28,192,0.08);
```

- `--shadow-card` is used on every card and container
- `--shadow-glow` is added on hover or for elevated elements (modals) alongside `--shadow-card`
- Button hover glow: `0 8px 24px rgba(255,28,192,0.3)`

### Content Widths
- Max content width: `1400px`, centred with `margin: 0 auto`
- Page padding: `40px 32px 64px` (desktop), `24px 16px 48px` (mobile)
- Card padding: `28px–40px` (varies by content density)

### Grid Gaps
- Widget grid: `20px`
- Card grids: `20–24px`
- Filter bar items: `12px`
- Summary cards: `14px`

---

## 5. Core Components

### Glass Card
The fundamental building block. Used for everything from widgets to team cards to event listings.

```css
.glass-card {
  background: var(--bg-card);             /* rgba(255,255,255,0.03) */
  border: 1px solid var(--border-glass);  /* rgba(255,255,255,0.1) */
  border-radius: var(--radius-md);        /* 20px */
  box-shadow: var(--shadow-card);
  transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
}

.glass-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-card), var(--shadow-glow);
  border-color: rgba(127, 95, 206, 0.25);
}
```

### Gradient Button (Primary CTA)
```css
.btn-gradient {
  padding: 12px 28px;
  background: var(--brand-gradient);
  color: var(--text-primary);
  border: none;
  border-radius: var(--radius-pill);      /* 40px — fully rounded */
  font-family: var(--font-display);       /* Oswald */
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
}

/* Hover: slight lift + pink glow */
.btn-gradient:hover {
  opacity: 0.92;
  transform: translateY(-1px);
  box-shadow: 0 8px 24px rgba(255, 28, 192, 0.3);
}
```

### Outline Button (Secondary CTA)
```css
.btn-outline {
  padding: 10px 24px;
  background: transparent;
  color: var(--text-primary);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-pill);
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
}

/* Hover: purple tint */
.btn-outline:hover {
  border-color: var(--brand-purple);
  background: rgba(127, 95, 206, 0.1);
  box-shadow: 0 0 20px rgba(127, 95, 206, 0.15);
}
```

### Section Label
A small uppercase label with a gradient accent bar to the left. Used to introduce sections.

```css
.section-label {
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 10px;
}

.section-label::before {
  content: '';
  width: 24px;
  height: 3px;
  background: var(--brand-gradient);
  border-radius: 2px;
}
```

### Gradient Text
Apply the brand gradient as text colour for emphasis (e.g., client name on the welcome page).

```css
.gradient-text {
  background: var(--brand-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

### Badge / Pill
Used for status and priority indicators inside tables.

```css
.badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: var(--radius-pill);  /* fully rounded */
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}
```

Background and text colours are set inline based on the status/priority colour maps.

### Form Inputs
```css
.filter-control {
  padding: 8px 14px;
  background: var(--bg-input);            /* rgba(255,255,255,0.05) */
  border: 1px solid var(--border-glass);
  border-radius: 8px;
  font-family: var(--font-body);          /* Open Sans */
  font-size: 13px;
  color: var(--text-primary);
}

/* Focus: purple ring */
.filter-control:focus {
  border-color: var(--brand-purple);
  box-shadow: 0 0 0 3px rgba(127, 95, 206, 0.15);
}
```

Textareas and larger inputs follow the same pattern but use `--radius-sm` (12px) and slightly larger padding (14px 16px).

---

## 6. Background Effects

Every page has two background layers behind all content:

### Animated Orbs
2–3 large, blurred circles that float slowly using CSS keyframe animations. They create a subtle ambient glow.

```html
<div class="orb-container">
  <div class="orb orb--1"></div>  <!-- Pink, top-right -->
  <div class="orb orb--2"></div>  <!-- Purple, bottom-left -->
  <div class="orb orb--3"></div>  <!-- Pink-purple gradient, centre (optional, home page) -->
</div>
```

- Size: 300–500px diameter
- `filter: blur(80px)`
- `opacity: 0.12`
- Animation: gentle float with `ease-in-out`, 15–22s duration
- Container is `position: fixed`, `pointer-events: none`, `z-index: 0`

### Grain Texture Overlay
A very subtle noise texture over the entire page, creating a premium print-like feel.

```html
<div class="grain-overlay"></div>
```

- `position: fixed`, covers full viewport
- `opacity: 0.03` — barely visible, but removes the "too clean digital" feel
- SVG-based fractal noise pattern via inline data URI
- `pointer-events: none`, `z-index: 9999`

---

## 7. Navigation Bar

Sticky top nav with glass-morphism effect.

```css
.portal-nav {
  position: sticky;
  top: 0;
  z-index: 100;
  height: 72px;                              /* 60px on mobile */
  background: rgba(14, 9, 24, 0.85);        /* near-black, semi-transparent */
  backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border-glass);
}
```

- Logo on the left (white, via `filter: brightness(0) invert(1)`)
- Links on the right as pill-shaped buttons
- Active link: `background: rgba(127,95,206,0.2)` (purple tint)
- Mobile: hamburger menu, links stack vertically in a dropdown

---

## 8. Page Structure Template

Every page follows this structure:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SGM Client Portal — [Page Name]</title>
  <link rel="stylesheet" href="css/styles.css">
  <link rel="icon" href="data:image/svg+xml,...">
</head>
<body>

  <!-- Background Effects -->
  <div class="orb-container">
    <div class="orb orb--1"></div>
    <div class="orb orb--2"></div>
  </div>
  <div class="grain-overlay"></div>

  <div class="portal-page">

    <!-- Navigation (identical on every page) -->
    <nav class="portal-nav">
      <!-- Logo + nav links -->
    </nav>

    <!-- Content -->
    <main class="page-content">
      <div class="section-label">[Section Name]</div>
      <h1 class="page-title">[Page Title]</h1>
      <p class="page-subtitle">[Optional subtitle]</p>

      <!-- Page-specific content here -->
    </main>

  </div>

  <script src="js/config.js"></script>
  <script src="js/auth.js"></script>
  <!-- Page-specific scripts -->
</body>
</html>
```

---

## 9. Animations

### Staggered Fade-In
Applied via the `fade-in` class. Elements slide up 16px and fade in with staggered delays.

```css
.fade-in {
  opacity: 0;
  transform: translateY(16px);
  animation: fadeInStagger 0.5s ease-out forwards;
}

.fade-in:nth-child(1) { animation-delay: 0.05s; }
.fade-in:nth-child(2) { animation-delay: 0.1s; }
/* ... up to 8 children at 0.05s intervals */
```

Use `fade-in` on cards in grid layouts and sequential content blocks.

### Modal Entry
Modals use `fadeInUp`: slide up 20px and fade in over 0.3s.

### Hover Transitions
- Cards: `transform: translateY(-3px)` over 0.3s
- Buttons: `transform: translateY(-1px)` over 0.2s
- Links/small elements: `transform: scale(1.05–1.08)` over 0.2s
- All interactive elements have `transition: all 0.2s–0.3s ease`

---

## 10. Responsive Breakpoints

| Breakpoint | Target | Key Changes |
|---|---|---|
| `> 1024px` | Desktop | Full grid layouts, side-by-side content |
| `768px–1024px` | Tablet | 2-column grids collapse, reduced padding |
| `< 768px` | Mobile | Single column, hamburger nav, table → card layout |
| `< 480px` | Small mobile | Single column everything, stacked summary cards |

### Mobile Table Pattern
On mobile (`< 768px`), data tables transform into stacked cards:
- `thead` is hidden
- Each `<tr>` becomes a card with full-width `display: block`
- Each `<td>` shows its label via `::before { content: attr(data-label) }` — so always include `data-label` on table cells

---

## 11. Do's and Don'ts

### DO
- Use CSS custom properties (design tokens) for all colours, radii, and shadows
- Use `var(--border-glass)` for all container borders
- Use `var(--shadow-card)` on every card/container element
- Apply `backdrop-filter: blur()` on overlay surfaces (nav, modals, cards that need it)
- Keep all Oswald text uppercase with letter-spacing
- Use the brand gradient sparingly — buttons, accent bars, badges, gradient text
- Add `fade-in` class to grid items for staggered page-load animation
- Include `data-label` attributes on `<td>` elements for mobile card layout
- Use `transition` on all interactive elements (never instant state changes)
- Use the purple focus ring (`box-shadow: 0 0 0 3px rgba(127,95,206,0.15)`) on all focusable elements

### DON'T
- Don't use solid/opaque mid-tone backgrounds — every surface should be semi-transparent or use the defined `--bg-*` tokens
- Don't use Oswald in sentence case or without letter-spacing
- Don't use the gradient as a large background fill — only as accents
- Don't create new colour values — stick to the palette defined in `:root`
- Don't use sharp corners — minimum radius is 8px (inputs), standard is 12px (cards) or 20px (glass cards)
- Don't use heavy borders — all borders are 1px and semi-transparent
- Don't use pure black (`#000`) — the darkest colour is `--bg-deepest` (`#0e0918`)
- Don't skip hover states — every interactive element needs a visual response
- Don't hardcode pixel values for colours or shadows — always reference the design tokens

---

## 12. Quick Reference — CSS Custom Properties

Copy this into the `:root` of any new stylesheet to get started:

```css
:root {
  /* Backgrounds */
  --bg-deepest: #0e0918;
  --bg-base: #26153a;
  --bg-elevated: #3c2c4e;
  --bg-card: rgba(255, 255, 255, 0.03);
  --bg-card-hover: rgba(255, 255, 255, 0.06);
  --bg-input: rgba(255, 255, 255, 0.05);

  /* Brand */
  --brand-gradient: linear-gradient(126deg, #ff1cc0 52%, #7f5fce 86%);
  --brand-pink: #ff1cc0;
  --brand-purple: #7f5fce;

  /* Text */
  --text-primary: #ffffff;
  --text-secondary: rgba(255, 255, 255, 0.6);
  --text-muted: rgba(255, 255, 255, 0.35);

  /* Borders */
  --border-glass: rgba(255, 255, 255, 0.1);
  --border-subtle: rgba(255, 255, 255, 0.06);
  --border-focus: rgba(127, 95, 206, 0.5);

  /* Radii */
  --radius-sm: 12px;
  --radius-md: 20px;
  --radius-pill: 40px;

  /* Shadows */
  --shadow-card: 0 2px 4px rgba(0,0,0,0.2), 0 10px 30px rgba(0,0,0,0.15), 0 25px 50px rgba(0,0,0,0.1);
  --shadow-glow: 0 0 30px rgba(127, 95, 206, 0.15), 0 0 60px rgba(255, 28, 192, 0.08);

  /* Typography */
  --font-display: 'Oswald', sans-serif;
  --font-body: 'Open Sans', sans-serif;

  /* Nav */
  --nav-height: 72px;
}
```
