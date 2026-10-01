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
  link: "#5fb487"
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
  link-dark: "#7cc7a0"
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
  provenance:
    backgroundColor: "{colors.wash}"
    typography: "{typography.label}"
    rounded: "{rounded.panel}"
    padding: "10px 12px"
---

# Design System: agent-mapper

## Overview

**Creative North Star: "The Instrument Panel"**

agent-mapper is a precise, calm inspection tool. It feels closer to the Xcode inspector, Linear, or Raycast than to a dashboard. The interface is a neutral graphite-on-paper surface where color is rare and always carries meaning: which tool, which state, or a real problem. Density is high but orderly: 36px rows, 28px facets, and one line of chrome per region.

The UI is organized around layers rather than file types. A project reads top to bottom as Global → Plugins → Project → User, the order in which configuration stacks up. Every item can be selected, and a persistent inspector explains where it comes from, why it is in its state, which files link to it, what it overrides, and which projects it reaches. Normal is quiet: active items carry no badge, a project that matches the global setup says so in three words, and inactive items stay hidden until asked for.

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

- **Claude Terracotta** (`claude`): Claude Code identity only. Used for the tool glyph, the skill-index segment of the startup summary bar, the border of the open project's own Inventory groups, and nothing else.
- **Codex Blue** (`codex`): Codex identity only, in the same places. It is never green, so it cannot be confused with a success state.
- **Favicon**: a disc filled with the selected tool's hue (the light-theme value in both color schemes) and a white bot icon at 60% in its center. It swaps when the tool toggle changes.

### Tertiary

- **Signal Red** (`problem`, `problem-wash`): verified problems only, such as a broken symlink, a missing import, malformed config, or missing plugin files. Also used for the Findings count when problems exist.
- **Focus Blue** (`focus`): keyboard focus rings only.

### Neutral

- **Paper Canvas** (`canvas`): app background behind content.
- **Sheet White** (`surface`): cards, rows, the inspector, buttons, and the selected toggle segment.
- **Sidebar Stone** (`sidebar`): sidebar background.
- **Muted Ink** (`ink-muted`): secondary text, icons, and state labels.
- **Faint Ink** (`ink-faint`): tertiary text, counts, path prefixes, and captions. Still meets WCAG AA (4.5:1) on canvas, surface, wash and selected rows; never go lighter.
- **Hairline** (`hairline`, `hairline-strong`): borders and dividers. The strong variant is used for hover borders and the "not reached" dash in the inspector's reach list.
- **Wash** (`wash`): provenance breadcrumb, the inherited-groups panel, bar tracks, and toggle track.
- **Hover / Selected** (`hover`, `selected`): row and nav states.
- **Layer tones** (`layer-global`, `layer-plugins`, `layer-project`): startup summary bar segments and load-list swatches, by layer. These three grays are the only place layers get a color.
- **Source tones** (`source-1` to `source-4`: soft violet, gold, cyan, pink): the state dot of an active skill in the Inventory, by the repo it was installed from (read from the `skills` installer's lock files). Only repos with two or more skills in a group get a tone, largest repo first; a fifth repo in one group reuses the first tone. Those skills sit together under a 32px wash row inside the card that names the repo, carries the same dot and a count, and folds them away (open by default); one-off and hand-written skills stay gray. Never red, green, terracotta or Codex blue, so a tone cannot read as a problem, a link or a tool. Inactive, unknown and problem dots keep their state styling.
- **Link green** (`link`: soft sage): symlinks. It tints the symlink chip (45% border, 10% fill, the link icon; the text stays Muted Ink for contrast) and colors the state dot of an active symlinked item that has no source tone. A source tone wins on the dot, so a cluster's dots still match its head.

Every neutral and signal token has a `-dark` twin in the frontmatter. Dark mode swaps the whole set; it is not an automatic inversion.

### Named Rules

**The Meaning-Only Color Rule.** Saturated color appears for exactly three reasons: which tool, a real problem, or keyboard focus. The pastels are the soft exceptions: the source tones say which repo a skill was installed from, and link green says an item is a symlink. Anything else is graphite or gray.

**The No-Success-Green Rule.** Green never means active, healthy or done. "Active" is the absence of a badge, not a green pill. The only green is the soft link green, which marks symlinks.

**The Glyph-Plus-Color Rule.** A tool is always marked with its letter glyph (`C` for Claude Code, `X` for Codex) as well as its color, so color is never the only signal. The favicon and the sidebar brand mark that repeats it are the exception: they mark the app, and the tool switch beside the header already names the tool.

## Typography

**Body Font:** Inter (with ui-sans-serif, -apple-system, system-ui)
**Mono Font:** ui-monospace (SF Mono, JetBrains Mono, Menlo)

**Character:** Inter at small sizes with stylistic alternates (`cv11`, `ss01`) reads crisp and technical without being cold. Monospace marks machine-truth strings: paths, versions, locators, matchers.

### Hierarchy

- **Headline** (650, 18px, 1.3, -0.015em): the name of the selected item at the top of the inspector.
- **Title** (650, 17px, 1.3, -0.015em): the page title in the header (project name or "Global").
- **Large** (550–650, 15px, 1.35): the search input and contribution counts in the inspector.
- **Body** (400, 13px, 1.45): default UI text, reasons, and descriptions.
- **Body Strong** (550, 13px): item names in rows.
- **Label** (550, 12px): buttons, facets, table cells, and the startup summary title.
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
  - A 36px view bar: view tabs (Projects, Inventory, Findings in the Global view; Inventory, Findings, and Worktrees when the project has linked checkouts) on the left; the Show inactive switch and the coverage notes link on the right.
  - Content and a 380px inspector in two columns, each scrolling independently.
- **Inventory:** the landing view of a project. The startup summary sits on top and scrolls away; filter chips (facets) stick to the top of the pane. Groups follow the same layer order: Global, installed plugins, each plugin's contributions, Project, User. Rows are 36px in one bordered card per group. In a project, the groups it inherits (Managed, Global, plugins) sit behind one wash-filled disclosure row, collapsed by default; it starts open when the project has no groups of its own, and selecting an item inside it (from search or the inspector) opens it. The project's own groups (Project, User) carry the tool glyph, an ink label, and a card border in the tool hue at 50%. The Global view has no disclosure row.
- **Projects (the Global landing view):** the global startup summary, then a fixed-layout table with one row per project and five columns: Project, Startup, Adds, Differs from global, Findings. Rows grow with their content; the table scrolls sideways below 640px. The inspector appears only while something is selected, so the table keeps the width.
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
- 6px for nav items, inline buttons, and rows inside cards;
- 7px for buttons and facets;
- 8px for panels, the breadcrumb, and the toggle track;
- 10px for row groups, the startup summary, and the Projects table;
- 12px for the search dialog;
- 9px pills for badges.

Borders are always 1px. Dashed outlines are reserved for "unknown" states.

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

### Startup Summary (signature)

One card above a project's Inventory ("A new session starts with") and above the Projects table ("Your global setup loads"). The Global title describes the global sources only: a project can disable some of them, which its row then shows.

- **Numbers:** "Startup ~7.4k · On demand ~102k", then the visible note "Estimated tokens: characters ÷ 4". Values always carry "~".
- **Bar:** a 6px segmented bar with one gray segment per startup instruction file (toned by layer) plus a tool-colored skill-index segment.
- **Load list:** under the bar, each startup instruction in load order as a button: swatch, load number, name, the folder that tells same-named files apart (mono, or "repo root"), and its estimate. Selecting one opens it in the inspector. The skill index closes the list.
- **Findings link:** in a project, the right end links to Findings with "2 problems · 3 other" (only problems are red). Absent when there are none.

### Symlink Badge and Links (signature)

- **Badge:** a pill tinted Link green with a link icon and the word "symlink" (11px, muted text). It appears on any entry whose resolved path differs from its entry path, in the Inventory and the inspector.
- **Two-way links:** the inspector for a symlink shows **Symlink to** with a clickable row to the source file. The source's inspector shows **Linked from N places**, with a clickable row for each link. Rows from the other tool show that tool's glyph.

### Inventory Rows

A 36px row: kind icon, state marker, name (body-strong), a symlink badge slot, a detail slot (path, matcher, or version, in faint mono), and a right-aligned state label. An active row that wins an override or shares its name with another skill carries a faint note there instead ("overrides AGENTS.md", "shared name") and shows its path even where the path is conventional. The hover fill is Hover and the selected fill is Selected. Group heads sit above each card: layer icon, label, count, and a mono location hint. Plugin groups show the plugin name and version. In a project, its own groups swap the layer icon for the tool glyph and use an ink label. Skills that share a source repo sit under a 32px wash row (chevron, source-tone dot, repo in mono, count) that folds them away. The name is the row's button, stretched over the row; two things sit above it as buttons of their own. The symlink chip opens a popover (native `popover`, anchored under the chip) with the folder the link resolves into and **Open in Finder**. Rows for files the app can edit show 28px buttons while hovered, focused or selected: primary **Edit**, then on skills and agents secondary **Copy** and a Delete icon button (not on plugin or managed items). They float over the right end of the row on the row's own fill, so the columns keep their widths. In a project, everything inherited (Global and plugins) sits inside one wash panel whose head row folds it away, so the groups read as its contents; it is closed by default.

### Facets

28px outlined pills with a kind icon, label, and faint count. The selected facet gets an ink border and ink text. "All" always comes first.

### Show Inactive Switch

A 26×16 track in the view bar that applies to every view. When on, the track is Graphite. The label includes the hidden count: "Show inactive (40)".

### Projects Table (signature)

One row per project; the row header opens the project.

- **Startup:** the project's approximate startup tokens.
- **Adds:** what the project's own folder contributes, as kind icon, count, and kind name ("2 Skills"). Each opens that project's Inventory filtered to the kind. Empty reads "Nothing of its own".
- **Differs from global:** global sources that apply globally but not plainly here, grouped by their state in the project ("Not used here reviewer", "Disabled context7"), or "Does not reach" when the project's scan does not list them. Hooks add their matcher, since several share an event name. Up to three names per state, then a "+N more" button that shows the rest. A name opens the item in that project; one the project never reached opens the global record in the inspector. No differences reads "Same as global" in faint text.
- **Findings:** "1 problem · 2 other" linking to that project's Findings, or "None".
- A project that is still scanning or failed to scan says so across the row and claims nothing. While a project rescans, its previous results stay, faded, and a previous error reads "Rescanning…".

### Confirmations

- **Inline question** (worktree Remove and Prune, the project list's remove, Discard changes): the button gives way to the question, **Keep** and a red-text answer, without a dialog. In table rows and the sidebar the question floats as a raised strip (Sheet White, hairline border, raised shadow) over the row, so nothing moves: in a table it grows left from the action cell; in the sidebar it starts at the row's left edge and extends past the sidebar over the content, so the full question fits. Escape, a click elsewhere, or scrolling keeps.
- **Delete dialog** (skills and agents): a modal titled "Delete name?" with one sentence on what goes to the Trash (a folder with its file count and size, a file, or only a symlink while its target stays), warnings for other paths that will break or installer records left behind, and a note that Put Back restores it. Cancel and a red-text **Delete**.

### Inspector

A white sheet on the right, 18–20px padding:

- a kind line (icon, kind name, tool glyph, symlink chip with its popover);
- the Headline name;
- a state line (marker plus bold state text) and the reason in muted body text;
- a provenance breadcrumb on Wash (`Global › ~/.claude/CLAUDE.md`, or `Plugins › plugin version › skills/x/SKILL.md › locator`);
- precedence sections (**Overridden by**, **Overrides**, **Shares its name with**) with a clickable row per related item, symlink sections, contributions grid (plugins), a Details key-value list, and "Reaches N of M projects";
- for files the app can edit, a document block: an action row (primary **Edit**; **Copy** and **Delete** on skills and agents; a History icon button at the far end), then the Preview/Source toggle on its own row above the text (a Codex agent is TOML, which has no preview, so it shows source only);
- the actions (Open in editor, Reveal in Finder).

When nothing is selected, it shows a centered hint and the active/inactive counts. Coverage notes open here too.

### Navigation (sidebar)

- The brand mark (the favicon: the Agents bot icon in white on a 22px disc of the selected tool's hue) and "agent-mapper", then Global (globe icon), then a "Projects" caption and project rows (folder icon, name, and a branch icon with worktree count).
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
- **Do** order layers Global → Plugins → Project → User everywhere: Inventory groups and breadcrumbs.
- **Do** keep active items silent. Put a text label only on non-active states.
- **Do** hide inactive items (not used, disabled, cached) behind the Show inactive switch and always show the hidden count.
- **Do** collapse repeats: cached plugin versions and shared source repos. A project that matches the global setup says "Same as global" instead of listing anything.
- **Do** make every item selectable and explain it in the inspector: state, reason, provenance, precedence, links, reach.
- **Do** keep the filename visible when paths are cut, and show project paths relative to the project root.
- **Do** check every screen in light and dark mode, including empty, loading, error, and partial-coverage states.

### Don't:

- **Don't** use strikethrough for inactive items. It reads as "deleted"; use a hollow marker and a muted name.
- **Don't** badge every row with a state pill. "expected", "configured", and "selected" together say nothing.
- **Don't** use green anywhere, or give Codex a green identity.
- **Don't** use red for anything except verified problems. Shadowed, disabled, and unknown are neutral.
- **Don't** label MCP servers Connected, Healthy, or Authenticated.
- **Don't** repeat summary panels above every view. The startup summary belongs on the two landing views only.
- **Don't** add shadows to cards, rows, or panels.
- **Don't** use uppercase letter-spaced eyebrows or all-caps column headings.
