# BuzyBeez UI Vision

This document outlines the visual design language, layout structure, and interaction patterns for the BuzyBeez platform.

**Design Philosophy:** Minimal & Clean (Notion/Linear inspired) with subtle bee/hexagon accents.

---

## Overall Layout Structure

The BuzyBeez interface uses a **sidebar + canvas** layout pattern, similar to Linear or Figma.

```
┌─────────────────────────────────────────────────────────────┐
│  Logo    Search                            User / Settings  │
├─────────┬───────────────────────────────────────────────────┤
│         │                                                   │
│ Sidebar │              Main Canvas / Content                │
│         │                                                   │
│  Beez   │   ┌─────────────────────────────────────────────┐ │
│  Swarmz │   │                                             │ │
│  Mail   │   │            Active Workspace                 │ │
│  Skills │   │                                             │ │
│  Logs   │   │                                             │ │
│         │   └─────────────────────────────────────────────┘ │
│         │                                                   │
├─────────┴───────────────────────────────────────────────────┤
│  Status Bar (optional)                                      │
└─────────────────────────────────────────────────────────────┘
```

### Sidebar
- **Width**: 240px (collapsible to 64px icon-only mode)
- **Background**: `surface` (#f9fafb)
- **Border**: 1px right border in `border` color
- **Sections**: Beez, Swarmz, Mailboxez, Skills, Logs
- **Interactions**: Hover reveals actions, selected item gets honey accent

### Header
- **Height**: 48px
- **Content**: Logo, global search, breadcrumbs, user menu
- **Style**: Clean white background, subtle bottom border

### Main Canvas
- **Background**: White or very subtle grid
- **Full bleed**: Uses all available space
- **Contextual**: Changes based on selected section

---

## Key Screens

### 1. Canvas (Swarmz Editor)

The primary workspace for designing agent topologies using react-flow.

**Elements:**
- **BeeNodes**: Represent individual agents
- **MailboxNodes**: External communication endpoints
- **Connections**: Directed edges showing mail flow
- **Minimap**: Bottom-right corner navigation
- **Toolbar**: Top of canvas with add/zoom/layout actions

**Interactions:**
- Click node to select (shows inspector panel)
- Right-click to quick-edit name
- Drag to reposition
- Cmd+drag to multi-select
- Double-click for context menu

### 2. Mail Manager

Lists all mailboxes and their messages.

**Layout:**
- Left: Mailbox list (filterable)
- Center: Message list for selected mailbox
- Right: Message detail panel (slide-over)

**Mail Item Display:**
- Sender/recipient addresses
- Subject line with preview
- Timestamp (relative)
- Status indicator (pending, delivered, read)
- Attachments icon if present

### 3. Bee Inspector

Side panel that appears when a bee is selected on the canvas.

**Sections:**
- **Header**: Bee name, status indicator, quick actions
- **Status**: Running/paused/stopped with controls
- **Skills**: Mounted skills with badges
- **Soul**: Soul file preview with edit link
- **Container**: Resource usage, file browser link, terminal link
- **Logs**: Recent activity stream (expandable)

**Style:**
- Slide-over panel from right edge
- 400px width
- Smooth 200ms slide animation

### 4. Skill Registry

Browse and manage available skills.

**Layout:**
- Grid of skill cards
- Filter bar (built-in / custom / all)
- Search input
- Category tabs

**Skill Card:**
- Icon or emoji
- Name and version
- Brief description
- Usage count badge
- Install/mount actions

### 5. Logs & Timeline

System-wide activity log with filtering.

**Features:**
- Real-time streaming entries
- Filter by bee, event type, severity
- Search within logs
- Timestamp with relative display
- Expandable entries for details

**Entry Types:**
- Mail sent/received
- Bee started/stopped
- Skill mounted
- Error occurred
- User action

---

## Component Patterns

### Cards
Cards are the primary container for grouped information.

**Variants:**
1. **Flat**: No shadow, subtle border - for dense lists
2. **Elevated**: Light shadow - for standalone items
3. **Bordered**: Prominent border - for interactive/selectable items

**Anatomy:**
```
┌────────────────────────────────┐
│ Header (optional icon + title) │
├────────────────────────────────┤
│                                │
│         Content Area           │
│                                │
├────────────────────────────────┤
│ Footer / Actions (optional)    │
└────────────────────────────────┘
```

### Buttons
Progressive disclosure through visual weight.

**Hierarchy:**
1. **Solid (Primary)**: Main action - filled honey background
2. **Outline**: Secondary action - border only
3. **Ghost**: Tertiary action - text only, hover shows background

**Sizes:** sm (28px), md (36px), lg (44px)

### Status Indicators
Visual representation of bee/swarm/mail state.

**Variants:**
1. **Dot**: Simple colored circle (8px)
2. **Dot + Label**: Dot with text description
3. **Badge Pill**: Rounded pill with background color
4. **Hexagon Dot**: Small hexagon shape (bee-themed variant)

**States:**
- Running: Green (#10b981)
- Paused: Amber/honey (#f59e0b)
- Stopped: Gray (#9ca3af)
- Error: Red (#ef4444)

### Inputs
Clean, minimal form controls.

**Variants:**
1. **Minimal**: No border, only bottom line on focus
2. **Bordered**: Subtle border, more defined
3. **Filled**: Light gray background, borderless

**States:** Default, Focused (honey ring), Error (red ring), Disabled

### Panels & Modals
Overlay patterns for detail views and dialogs.

**Panel (Side):**
- Slides in from edge
- 400px width
- Backdrop optional
- Close via X, click outside, or Escape

**Modal (Center):**
- Centered dialog
- Max width based on content
- Blurred backdrop
- Smooth scale-in animation

---

## Color Palette Usage

### Primary Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `background` | #ffffff | Page background |
| `surface` | #f9fafb | Cards, sidebar, elevated areas |
| `surfaceHover` | #f3f4f6 | Interactive hover states |
| `border` | #e5e7eb | Dividers, card borders |
| `borderSubtle` | #f3f4f6 | Very subtle separators |

### Accent Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `honey` | #f59e0b | Primary accent, buttons, links |
| `honeyLight` | #fef3c7 | Subtle backgrounds, highlights |
| `honeyDark` | #d97706 | Hover/pressed states |

### Text Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `text` | #111827 | Primary text, headings |
| `textSecondary` | #6b7280 | Descriptions, secondary info |
| `textMuted` | #9ca3af | Placeholders, disabled text |

### Semantic Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `success` | #10b981 | Running state, positive actions |
| `warning` | #f59e0b | Paused state, caution |
| `error` | #ef4444 | Error state, destructive actions |

### Color Application Rules

1. **White dominates** - Most surfaces should be white or near-white
2. **Honey sparingly** - Use for interactive elements and highlights only
3. **Gray for hierarchy** - Use text grays to establish visual hierarchy
4. **Semantic for status** - Reserve success/warning/error for actual states

---

## Animation & Interaction Patterns

### Timing

| Type | Duration | Easing |
|------|----------|--------|
| Micro (hover, focus) | 100-150ms | ease-out |
| Standard (panels, cards) | 200ms | ease-in-out |
| Complex (page transitions) | 300ms | ease-in-out |

### Hover States
- Buttons: Background color shift
- Cards: Subtle shadow increase or border color change
- List items: Background fill
- Links: Underline or color shift

### Focus States
- Always visible for accessibility
- Honey-colored focus ring (2px, offset by 2px)
- No outline removal without replacement

### Panel Animations
- **Slide-over**: translateX from 100% to 0
- **Modal**: scale from 95% to 100% + opacity
- **Backdrop**: opacity 0 to 50%

### Loading States
- Skeleton placeholders for content areas
- Subtle shimmer animation
- Spinner for actions (honey colored)

### Transitions for Canvas
- Node selection: Scale pulse (1.02x)
- Connection creation: Animated dash flow
- Node creation: Fade + scale in
- Deletion: Fade + scale out

---

## Typography

### Font Stack

```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', 'Monaco', Consolas, monospace;
```

### Scale

| Name | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| xs | 12px | 400 | 1.5 | Captions, badges |
| sm | 14px | 400 | 1.5 | Body text, labels |
| base | 16px | 400 | 1.5 | Default body |
| lg | 20px | 500 | 1.4 | Section headers |
| xl | 24px | 600 | 1.3 | Page titles |
| 2xl | 32px | 700 | 1.2 | Hero text |

### Monospace Usage
- Log entries and timestamps
- Mail content preview
- Code snippets
- Technical identifiers (UUIDs, addresses)

---

## Spacing & Grid

### Base Unit
All spacing derives from a 4px base unit.

### Common Values

| Token | Value | Usage |
|-------|-------|-------|
| `space-1` | 4px | Tight inline spacing |
| `space-2` | 8px | Element gaps, padding |
| `space-3` | 12px | Card padding |
| `space-4` | 16px | Section gaps |
| `space-5` | 20px | Large gaps |
| `space-6` | 24px | Section padding |
| `space-8` | 32px | Major section gaps |
| `space-12` | 48px | Page margins |
| `space-16` | 64px | Hero spacing |

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `radius-sm` | 6px | Badges, small elements |
| `radius` | 8px | Buttons, inputs, cards |
| `radius-lg` | 12px | Larger cards, modals |
| `radius-xl` | 16px | Panels, overlays |
| `radius-full` | 9999px | Pills, circular avatars |

### Shadow

```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05);
```

---

## Hexagon & Bee Motifs

Hexagon shapes should be used **subtly** and **intentionally**:

### Where to Use
- Status indicators (optional hexagon variant)
- Bee node variant on canvas
- Empty state illustrations
- Loading spinner (optional)
- Background pattern (very subtle, low opacity)

### Where NOT to Use
- Every card or container
- All buttons or inputs
- Navigation elements
- Text decorations

### Implementation
- Use CSS clip-path for hexagon shapes
- Maintain consistent aspect ratio (width:height ≈ 1:1.15)
- Keep stroke weights consistent (1-2px)

---

## Responsive Considerations

### Breakpoints

| Name | Width | Behavior |
|------|-------|----------|
| sm | 640px | Mobile - sidebar hidden |
| md | 768px | Tablet - sidebar collapsible |
| lg | 1024px | Desktop - full layout |
| xl | 1280px | Large desktop - wider panels |

### Mobile Adaptations
- Sidebar becomes bottom nav or hamburger menu
- Panels become full-screen overlays
- Canvas uses touch gestures
- Cards stack vertically

---

## Accessibility

### Requirements
- WCAG 2.1 AA compliance
- Minimum 4.5:1 contrast for text
- Visible focus indicators
- Keyboard navigation support
- Screen reader labels

### Implementation
- Use semantic HTML elements
- Include ARIA labels where needed
- Test with keyboard navigation
- Provide text alternatives for icons
- Support reduced motion preference

---

## File Reference

See the prototype implementation at `/prototypes/` for live examples of all components and patterns described in this document.
