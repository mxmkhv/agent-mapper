---
name: agent-mapper
description: Read-only map of Claude Code and Codex configuration, and where each piece comes from
colors:
  canvas: "#fafaf9"
  surface: "#ffffff"
  sidebar: "#f4f4f2"
  ink: "#1c1c1a"
  ink-muted: "#50504c"
  ink-faint: "#686863"
  hairline: "#e7e7e3"
  hairline-strong: "#d6d6d1"
  wash: "#f2f2ef"
  hover: "#f0f0ed"
  selected: "#ebebe7"
  focus: "#3b6fe0"
  claude: "#d97757"
  codex: "#4a74d6"
  problem: "#cf3f3f"
  problem-wash: "#fbeaea"
  layer-global: "#8a8a84"
  layer-plugins: "#b7b7b0"
  layer-project: "#4d4d49"
  source-1: "#a08ee6"
  source-2: "#dcae4c"
  source-3: "#5bbccf"
  source-4: "#e08cc0"
  canvas-dark: "#121211"
  surface-dark: "#191918"
  sidebar-dark: "#151514"
  ink-dark: "#ecece8"
  ink-muted-dark: "#c2c2bc"
  ink-faint-dark: "#96968f"
  hairline-dark: "#282826"
  hairline-strong-dark: "#363633"
  wash-dark: "#20201e"
  hover-dark: "#22221f"
  selected-dark: "#2a2a27"
  focus-dark: "#7a9ef5"
  claude-dark: "#e48b6c"
  codex-dark: "#7d9df0"
  problem-dark: "#f07474"
  problem-wash-dark: "#3a1f1f"
  source-1-dark: "#b3a4f0"
  source-2-dark: "#e2bb66"
  source-3-dark: "#74c9da"
  source-4-dark: "#e8a0cc"
typography:
  headline:
    fontFamily: "Inter, ui-sans-serif, -apple-system, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Inter, ui-sans-serif, -apple-system, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "-0.015em"
  large:
    fontFamily: "Inter, ui-sans-serif, -apple-system, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 550
    lineHeight: 1.35
  body:
    fontFamily: "Inter, ui-sans-serif, -apple-system, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: '"cv11", "ss01"'
  body-strong:
    fontFamily: "Inter, ui-sans-serif, -apple-system, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 550
    lineHeight: 1.45
  label:
    fontFamily: "Inter, ui-sans-serif, -apple-system, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 550
    lineHeight: 1.4
  caption:
    fontFamily: "Inter, ui-sans-serif, -apple-system, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.4
  mono:
    fontFamily: 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace'
    fontSize: "11.5px"
    fontWeight: 400
    lineHeight: 1.4
  glyph:
    fontFamily: "Inter, ui-sans-serif, -apple-system, system-ui, sans-serif"
    fontSize: "9px"
    fontWeight: 700
    lineHeight: 1
rounded:
  glyph: "4px"
  control: "6px"
  button: "7px"
  panel: "8px"
  card: "10px"
  dialog: "12px"
  pill: "9px"
spacing:
  "2xs": "2px"
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  "2xl": "20px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.canvas}"
    typography: "{typography.label}"
    rounded: "{rounded.button}"
    height: "28px"
    padding: "0 10px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.button}"
    height: "28px"
    padding: "0 10px"
  tool-toggle:
    backgroundColor: "{colors.wash}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.label}"
    rounded: "{rounded.panel}"
    padding: "2px"
  tool-toggle-selected:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "24px"
  tool-glyph-claude:
    backgroundColor: "{colors.claude}"
    textColor: "#ffffff"
    rounded: "{rounded.glyph}"
    size: "15px"
  tool-glyph-codex:
    backgroundColor: "{colors.codex}"
    textColor: "#ffffff"
    rounded: "{rounded.glyph}"
    size: "15px"
  chip:
    backgroundColor: "{colors.wash}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    height: "24px"
    padding: "0 8px"
  chip-inactive:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.control}"
    height: "24px"
  facet:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.label}"
    rounded: "{rounded.button}"
    height: "28px"
    padding: "0 10px"
  facet-selected:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
  inventory-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-strong}"
    height: "36px"
    padding: "0 12px"
  inventory-row-selected:
    backgroundColor: "{colors.selected}"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    height: "30px"
    padding: "0 8px"
  nav-item-active:
    backgroundColor: "{colors.selected}"
  symlink-badge:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    height: "18px"
    padding: "0 6px"
  layer-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "4px"
  provenance:
    backgroundColor: "{colors.wash}"
    typography: "{typography.label}"
    rounded: "{rounded.panel}"
    padding: "10px 12px"
---

# Design System: agent-mapper

## Overview

**Creative North Star: "The Instrument Panel"**

agent-mapper is a precise, calm inspection tool. It feels closer to the Xcode inspector, Linear, or Raycast than to a dashboard. The interface is a neutral graphite-on-paper surface where color is rare and always carries meaning: which tool, which state, or a real problem. Density is high but orderly: 36px rows, 24px chips, and one line of chrome per region.

The UI is organized around layers rather than file types. A project reads top to bottom as Global → Plugins → Project → User, the order in which configuration stacks up. Every item can be selected, and a persistent inspector explains where it comes from, why it is in its state, which files link to it, and which projects it reaches. Normal is quiet: active items carry no badge, uniform global sources collapse into one row, and inactive items stay hidden until asked for.

**Key Characteristics:**

- Neutral warm-gray base. Tool hues (Claude terracotta, Codex blue) and problem red are the only saturated colors, apart from the pastel source tones on Inventory skill dots.
- One tool is visible at a time, chosen with a segmented toggle in the header.
- State is expressed with markers and short text labels, not colored badges.
- Monospace is used only for paths, versions, locators, and matchers.
- Flat surfaces with hairline borders. Shadows appear only on floating or selected controls.
- A full-height shell: sidebar, header, view bar, then a content pane and an inspector that scroll independently.

## Colors

Warm neutral grays carry the whole interface. Saturated color is reserved for tool identity and verified problems; four pastel source tones mark which repo a skill was installed from.

### Primary

- **Graphite Ink** (`ink`): primary text, the primary button fill, the active tab underline, the selected facet border, and the "on" switch track. Graphite, not a brand hue, is the strongest emphasis in the system.

### Secondary

- **Claude Terracotta** (`claude`): Claude Code identity only. Used for the tool glyph, the skill-index segment of the startup budget bar, the border of the open project's own Inventory groups, and nothing else.
- **Codex Blue** (`codex`): Codex identity only, in the same places. It is never green, so it cannot be confused with a success state.

### Tertiary

- **Signal Red** (`problem`, `problem-wash`): verified problems only, such as a broken symlink, a missing import, malformed config, or missing plugin files. Also used for the Findings count when problems exist.
- **Focus Blue** (`focus`): keyboard focus rings only.

### Neutral

- **Paper Canvas** (`canvas`): app background behind content.
- **Sheet White** (`surface`): cards, rows, the inspector, buttons, and the selected toggle segment.
- **Sidebar Stone** (`sidebar`): sidebar background.
- **Muted Ink** (`ink-muted`): secondary text, icons, and state labels.
- **Faint Ink** (`ink-faint`): tertiary text, counts, path prefixes, and captions. Still meets WCAG AA (4.5:1) on canvas, surface, wash and selected rows; never go lighter.
- **Hairline** (`hairline`, `hairline-strong`): borders and dividers. The strong variant is used for hover borders and absent-cell dashes.
- **Wash** (`wash`): chip fill, provenance breadcrumb, matrix section rows, and toggle track.
- **Hover / Selected** (`hover`, `selected`): row and nav states.
- **Layer tones** (`layer-global`, `layer-plugins`, `layer-project`): startup budget bar segments by layer. These three grays are the only place layers get a color.
- **Source tones** (`source-1` to `source-4`: soft violet, gold, cyan, pink): the state dot of an active skill in the Inventory, by the repo it was installed from (read from the `skills` installer's lock files). Only repos with two or more skills in a group get a tone, largest repo first; a fifth repo in one group reuses the first tone. Those skills sit together under a 32px wash row inside the card that names the repo, carries the same dot and a count, and folds them away (open by default); one-off and hand-written skills stay gray. Never red, green, terracotta or Codex blue, so a tone cannot read as a problem, a success or a tool. Inactive, unknown and problem dots keep their state styling.

Every neutral and signal token has a `-dark` twin in the frontmatter. Dark mode swaps the whole set; it is not an automatic inversion.

### Named Rules

**The Meaning-Only Color Rule.** Saturated color appears for exactly three reasons: which tool, a real problem, or keyboard focus. The pastel source tones are the one soft exception: which repo a skill was installed from. Anything else is graphite or gray.

**The No-Green Rule.** Green has no role. "Active" is the absence of a badge, not a green pill.

**The Glyph-Plus-Color Rule.** A tool is always marked with its letter glyph (`C` for Claude Code, `X` for Codex) as well as its color, so color is never the only signal.

## Typography

**Body Font:** Inter (with ui-sans-serif, -apple-system, system-ui)
**Mono Font:** ui-monospace (SF Mono, JetBrains Mono, Menlo)

**Character:** Inter at small sizes with stylistic alternates (`cv11`, `ss01`) reads crisp and technical without being cold. Monospace marks machine-truth strings: paths, versions, locators, matchers.

### Hierarchy

- **Headline** (650, 18px, 1.3, -0.015em): the name of the selected item at the top of the inspector.
- **Title** (650, 17px, 1.3, -0.015em): the page title in the header (project name or "Global").
- **Large** (550–650, 15px, 1.35): the search input, the tool header above the Map, and contribution counts in the inspector.
- **Body** (400, 13px, 1.45): default UI text, reasons, and descriptions.
- **Body Strong** (550, 13px): item names in rows, the Map load list, and the matrix.
- **Label** (550, 12px): buttons, chips, facets, and kind titles on the Map ("Skills 12").
- **Caption** (500, 11px): counts, state labels, badges, and inspector section headings (650 weight, faint).
- **Mono** (400, 11.5–12px): paths, versions, locators, matchers, and layer location hints that are paths (`~/.claude`). Prose hints such as "In this repo" stay in sans.
- **Glyph** (700, 9px): the letter inside a tool glyph, and nothing else.

### Named Rules

**The Mono-Means-Machine Rule.** Monospace is used only for strings the user could paste into a terminal or file search. Labels and prose are never mono.

**The Filename-Survives Rule.** Paths are split into a directory and a filename. When space runs out, the directory is cut with an ellipsis and the filename always stays visible. Paths inside the selected project are shown relative to its root; others use `~`.

**The No-Eyebrow Rule.** No uppercase letter-spaced eyebrows. Section headings are small, faint, sentence-case captions.

## Layout

- **Shell:** a full-viewport grid with a 232px sidebar (200px below 1024px) and a flexible main area. The document never scrolls; regions do.
- **Narrow windows (below 1024px):** the inspector leaves the grid and floats over the content from the right, only while something is selected or coverage notes are open, with a close button. Worktrees stack the detail pane under the list. The Show inactive switch shortens to "Inactive (N)".
- **Main area:**
  - A 56px header: title, path, and branch on the left; tool toggle, Search ⌘K, scan time, and Rescan on the right.
  - A 36px view bar: view tabs (Map or Reach, Inventory, Findings) on the left; the Show inactive switch and the coverage notes link on the right.
  - Content and a 380px inspector in two columns, each scrolling independently.
- **Map:** a 92px layer-label column followed by one layer card per layer, capped at 860px wide. Layer rows run Global → Plugins → Project → User, with Managed at the top only when present. A tool header with the startup budget sits above the layers.
- **Inventory:** filter chips (facets) stick to the top of the pane. Groups follow the same layer order: Global, installed plugins, each plugin's contributions, Project, User. Rows are 36px in one bordered card per group. In a project, the groups it inherits (Managed, Global, plugins) sit behind one wash-filled disclosure row, collapsed by default; it starts open when the project has no groups of its own, and selecting an item inside it (from search or the inspector) opens it. The project's own groups (Project, User) carry the tool glyph, an ink label, and a card border in the tool hue at 50%. The Global view has no disclosure row.
- **Reach (the Global view):** a fixed-layout table with a flexible source column and 104px project columns. The header and source column stay pinned while the table scrolls. When project columns are out of view, a surface-colored fade on the right edge says so, because macOS hides scrollbars until you scroll.
- **Browser surfaces:** text selection uses Focus Blue at 24%; scrollbars are thin and use `hairline-strong` on a transparent track.
- **Spacing rhythm:** 4 / 6 / 8 / 12 / 16 / 20px. Content gutters are 20px; card interiors are 4–12px.

## Elevation & Depth

The system is flat. Depth comes from tonal layering (canvas → sheet → wash) and 1px hairlines. Shadows appear only on elements that float or show the current selection.

### Shadow Vocabulary

- **Raised control** (`box-shadow: 0 1px 2px #0000000a, 0 4px 16px #00000008`; dark: `0 1px 2px #00000040, 0 8px 24px #00000040`): the selected segment of the tool toggle and theme switch.
- **Floating dialog** (`box-shadow: 0 24px 60px #00000030`): the search palette, over a `#0000002e` backdrop, and the floating inspector in narrow windows.

### Named Rules

**The Flat-By-Default Rule.** Cards, rows, the inspector, and the sidebar never cast shadows. If something needs separation, use a hairline or a tonal step.

## Shapes

Corners are softly rounded and grow with the element's size:

- 4px for tool glyphs;
- 6px for nav items, chips, and rows inside cards;
- 7px for buttons and facets;
- 8px for panels, the breadcrumb, and the toggle track;
- 10px for layer cards, row groups, and the matrix;
- 12px for the search dialog;
- 9px pills for badges.

Borders are always 1px. Dashed outlines are reserved for "unknown" states and the "+N more" chip.

## Components

### Tool Toggle (header)

Single-select segmented control: `[C Claude Code | X Codex]`. The selected segment is a white sheet with the raised-control shadow. The unselected segment's glyph turns faint gray. Switching tools clears the selection. Following a symlink into the other tool's file switches the toggle automatically.

### Buttons

- **Shape:** gently rounded (7px), 28px tall, 12px label text.
- **Primary:** Graphite Ink fill with canvas text. Used for one action per inspector: Open in editor.
- **Secondary:** white sheet, hairline border, and ink text (Reveal in Finder, Search, Rescan). On hover, the border strengthens.
- **Icon-only:** 28×28 with the same secondary treatment.

### State Markers (signature)

A 7px marker leads every item. Its shape carries the state, so no colored badge is needed:

- **Active:** a solid graphite dot at 55% opacity, with no text label.
- **Inactive** (not used here, disabled, cached version): a hollow ring, a muted name, and a short text label.
- **Unknown / needs approval:** a dashed ring and a label prefixed with "?".
- **Problem:** a solid Signal Red dot and a red semibold label.

### Chips

- **Style:** Wash fill, 24px tall, 6px radius, 12px label.
- **Secondary info:** matchers, transports, and contribution counts sit inside the chip in faint text.
- **Inactive:** transparent with a hairline border and muted text. **Unknown:** a dashed border.
- **Selected:** an ink border on a white sheet.
- **Overflow:** after 16 chips, a dashed "+N more" chip jumps to Inventory filtered to that kind.

### Layer Map (signature)

One card per layer with a kind row per item kind: icon, kind title with count, then content.

- **Instructions** render as a numbered load list in startup order. Inactive entries show "–" instead of a number and appear only when Show inactive is on.
- **Plugins** render as chips with contribution counts. Cached and disabled versions collapse into "N cached or disabled versions hidden · show".
- **Empty layers** read "Nothing at this layer".
- **Layer hints** are mono and specific to the selected tool. Global shows `~/.claude` or `~/.codex · ~/.agents`, taken from files actually found. Project shows "In this repo", or "Repo and parent folders" when a file above the repo applies. User shows "*.local files · only you".

### Startup Budget

Above the layers: "Startup ~7.4k · On demand ~102k", then a 6px segmented bar with one gray segment per startup instruction file (toned by layer) plus a tool-colored skill-index segment. A legend underneath names each segment. Values always carry "~".

### Symlink Badge and Links (signature)

- **Badge:** a white pill with a link icon and the word "symlink" (11px, muted, hairline border). It appears on any entry whose resolved path differs from its entry path, in the Map, Inventory, Reach, and inspector.
- **Group note:** when most items in a group link into one folder, the group title carries one badge ("21 symlinked → .agents/skills/") instead of repeating it on every chip.
- **Two-way links:** the inspector for a symlink shows **Symlink to** with a clickable row to the source file. The source's inspector shows **Linked from N places**, with a clickable row for each link. Rows from the other tool show that tool's glyph.

### Inventory Rows

A 36px row: kind icon, state marker, name (body-strong), a symlink badge slot, a detail slot (path, matcher, or version, in faint mono), and a right-aligned state label. The hover fill is Hover and the selected fill is Selected. Group heads sit above each card: layer icon, label, count, and a mono location hint. Plugin groups show the plugin name and version. In a project, its own groups swap the layer icon for the tool glyph and use an ink label. Skills that share a source repo sit under a 32px wash row (chevron, source-tone dot, repo in mono, count) that folds them away.

### Facets

28px outlined pills with a kind icon, label, and faint count. The selected facet gets an ink border and ink text. "All" always comes first.

### Show Inactive Switch

A 26×16 track in the view bar that applies to every view. When on, the track is Graphite. The label includes the hidden count: "Show inactive (40)".

### Reach Matrix (signature)

Rows are sources outside projects, grouped by kind in section rows (Wash fill, 11px caption). Cells hold a state marker; an absent cell is a short hairline dash.

- Sources that reach every project identically collapse into one muted row: "▸ 11 reach every project · context7, re…". The row expands on click.
- Global skills collapse to one count row ("12/12" per project).
- A final section, "Added by the project itself", counts project-local items per kind.

### Inspector

A white sheet on the right, 18–20px padding:

- a kind line (icon, kind name, tool glyph, symlink badge);
- the Headline name;
- a state line (marker plus bold state text) and the reason in muted body text;
- a provenance breadcrumb on Wash (`Global › ~/.claude/CLAUDE.md`, or `Plugins › plugin version › skills/x/SKILL.md › locator`);
- symlink sections, contributions grid (plugins), a Details key-value list, and "Reaches N of M projects";
- the actions (Open in editor, Reveal in Finder).

When nothing is selected, it shows a centered hint and the active/inactive counts. Coverage notes open here too.

### Navigation (sidebar)

- The brand mark and "agent-mapper", then Global (globe icon), then a "Projects" caption and project rows (folder icon, name, and a branch icon with worktree count).
- The selected project expands to show its first three worktrees and "N more worktrees".
- Rows are 30px with a 6px radius. The active row gets the Selected fill and 550 weight.
- The footer holds Add folder…, the Auto / Light / Dark switch, and "Read-only · nothing is modified".

### Search Palette

`⌘K` opens a 640px dialog with a 48px borderless input, results as inventory rows, and a footer of key hints (↑↓ navigate · ↵ inspect · esc close). Results are scoped to the selected tool, with inactive items listed last.

### Findings

A stack of cards (10px radius, hairline): an info or alert icon, the title, a level pill (a Wash pill; problem uses Signal Red on its wash), the reason, and clickable source paths that open the inspector.

## Do's and Don'ts

### Do:

- **Do** show one tool at a time and let symlink links carry the connection between tools.
- **Do** order layers Global → Plugins → Project → User everywhere: Map, Inventory groups, and breadcrumbs.
- **Do** keep active items silent. Put a text label only on non-active states.
- **Do** hide inactive items (not used, disabled, cached) behind the Show inactive switch and always show the hidden count.
- **Do** collapse repeats: uniform Reach rows, cached plugin versions, symlink groups.
- **Do** make every item selectable and explain it in the inspector: state, reason, provenance, links, reach.
- **Do** keep the filename visible when paths are cut, and show project paths relative to the project root.
- **Do** check every screen in light and dark mode, including empty, loading, error, and partial-coverage states.

### Don't:

- **Don't** use strikethrough for inactive items. It reads as "deleted"; use a hollow marker and a muted name.
- **Don't** badge every row with a state pill. "expected", "configured", and "selected" together say nothing.
- **Don't** use green anywhere, or give Codex a green identity.
- **Don't** use red for anything except verified problems. Shadowed, disabled, and unknown are neutral.
- **Don't** label MCP servers Connected, Healthy, or Authenticated.
- **Don't** repeat summary panels above every view. Context estimates belong on the Map.
- **Don't** add shadows to cards, rows, or panels.
- **Don't** use uppercase letter-spaced eyebrows or all-caps column headings.
