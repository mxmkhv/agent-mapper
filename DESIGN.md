---
name: agent-mapper
description: Read-only map of Claude Code and Codex configuration, and where each piece comes from
colors:
  canvas: "#f6f6f3"
  surface: "#f6f6f3"
  ink: "#0d0d0d"
  ink-muted: "#5c5c58"
  ink-faint: "#66665f"
  rule: "#0d0d0d"
  hairline: "#9d9d97"
  wash: "#e8e8e3"
  selected: "#d9d9d4"
  claude: "#d97757"
  codex: "#4a74d6"
  on-accent: "#0d0d0d"
  on-accent-codex: "#000000"
  problem: "#c23030"
  canvas-dark: "#0d0d0d"
  surface-dark: "#0d0d0d"
  ink-dark: "#f1f1ec"
  ink-muted-dark: "#a6a6a0"
  ink-faint-dark: "#96968f"
  rule-dark: "#7c7c76"
  hairline-dark: "#55554f"
  wash-dark: "#1e1e1c"
  selected-dark: "#2c2c29"
  claude-dark: "#e48b6c"
  codex-dark: "#7d9df0"
  on-accent-dark: "#0d0d0d"
  problem-dark: "#f07474"
typography:
  figure:
    fontFamily: '"Departure Mono", ui-monospace, "SF Mono", Menlo, monospace'
    fontSize: "44px"
    fontWeight: 400
    lineHeight: "44px"
    letterSpacing: "0"
  headline:
    fontFamily: '"Departure Mono", ui-monospace, "SF Mono", Menlo, monospace'
    fontSize: "33px"
    fontWeight: 400
    lineHeight: "36px"
    letterSpacing: "0"
  title:
    fontFamily: '"Departure Mono", ui-monospace, "SF Mono", Menlo, monospace'
    fontSize: "22px"
    fontWeight: 400
    lineHeight: "24px"
    letterSpacing: "0"
  mono:
    fontFamily: '"Departure Mono", ui-monospace, "SF Mono", Menlo, monospace'
    fontSize: "11px"
    fontWeight: 400
    lineHeight: "14px"
    letterSpacing: "0"
  glyph:
    fontFamily: '"Departure Mono", ui-monospace, "SF Mono", Menlo, monospace'
    fontSize: "11px"
    fontWeight: 400
    lineHeight: "15px"
    letterSpacing: "0"
  large:
    fontFamily: '"Schibsted Grotesk", "Helvetica Neue", ui-sans-serif, system-ui, sans-serif'
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.35
  body:
    fontFamily: '"Schibsted Grotesk", "Helvetica Neue", ui-sans-serif, system-ui, sans-serif'
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
  body-strong:
    fontFamily: '"Schibsted Grotesk", "Helvetica Neue", ui-sans-serif, system-ui, sans-serif'
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.45
  label:
    fontFamily: '"Schibsted Grotesk", "Helvetica Neue", ui-sans-serif, system-ui, sans-serif'
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
  label-strong:
    fontFamily: '"Schibsted Grotesk", "Helvetica Neue", ui-sans-serif, system-ui, sans-serif'
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.4
  caption:
    fontFamily: '"Schibsted Grotesk", "Helvetica Neue", ui-sans-serif, system-ui, sans-serif'
    fontSize: "11px"
    fontWeight: 400
    lineHeight: "14px"
  code:
    fontFamily: 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace'
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "20px"
rounded:
  none: "0px"
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
    typography: "{typography.label-strong}"
    rounded: "{rounded.none}"
    height: "28px"
    padding: "0 10px"
  button-primary-disabled:
    backgroundColor: "{colors.wash}"
    textColor: "{colors.ink-faint}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label-strong}"
    rounded: "{rounded.none}"
    height: "28px"
    padding: "0 10px"
  button-secondary-hover:
    backgroundColor: "{colors.wash}"
  button-icon:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    size: "28px"
  button-accent-primary:
    backgroundColor: "{colors.on-accent}"
    textColor: "{colors.claude}"
    typography: "{typography.label-strong}"
    rounded: "{rounded.none}"
    height: "28px"
    padding: "0 10px"
  tool-toggle:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.label-strong}"
    rounded: "{rounded.none}"
    height: "24px"
    padding: "0 10px 0 8px"
  tool-toggle-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.canvas}"
  tool-glyph-claude:
    backgroundColor: "{colors.claude}"
    textColor: "#000000"
    typography: "{typography.glyph}"
    rounded: "{rounded.none}"
    size: "15px"
  tool-glyph-codex:
    backgroundColor: "{colors.codex}"
    textColor: "#000000"
    typography: "{typography.glyph}"
    rounded: "{rounded.none}"
    size: "15px"
  view-tab:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.none}"
    height: "30px"
    padding: "0 12px"
  view-tab-active:
    backgroundColor: "{colors.claude}"
    textColor: "{colors.on-accent}"
  facet:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    height: "28px"
    padding: "0 11px"
  facet-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.canvas}"
  group-tab:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.canvas}"
    typography: "{typography.mono}"
    rounded: "{rounded.none}"
    height: "26px"
    padding: "0 12px 0 10px"
  inventory-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-strong}"
    height: "36px"
    padding: "0 12px"
  inventory-row-hover:
    backgroundColor: "{colors.wash}"
  inventory-row-selected:
    backgroundColor: "{colors.claude}"
    textColor: "{colors.on-accent}"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    height: "30px"
    padding: "0 8px"
  nav-item-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.canvas}"
  symlink-chip:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.caption}"
    rounded: "{rounded.none}"
    height: "18px"
    padding: "0 6px"
  level-tag:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.mono}"
    rounded: "{rounded.none}"
    padding: "0 6px"
  provenance:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.mono}"
    rounded: "{rounded.none}"
    padding: "9px 10px"
---

# Design System: agent-mapper

## Overview

**Creative North Star: "The Bitmap Specimen"**

agent-mapper is a 1-bit inspection tool: ink on paper, in the manner of a bitmap type specimen and a terminal. The page is one paper tone, the marks are one ink, corners are square, and nothing casts a shadow. Structure is drawn with 2px rules, rows are separated by dotted lines, and quantity is shown with dot-matrix fills. The only colour besides problem red is the accent, which is the hue of the selected tool: terracotta for Claude Code, blue for Codex. It refuses the rounded-card, soft-gray look of a SaaS dashboard.

Two faces divide the work. A pixel face (Departure Mono) sets what the machine knows: paths, versions, counts, token figures, key hints, page titles, and the name at the top of the inspector. A grotesk (Schibsted Grotesk) sets what people read: item names in rows, labels, buttons, and prose. Long-form source in the editor and in code blocks stays in the system monospace.

The UI is organized around layers rather than file types. A project reads top to bottom as Global → Plugins → Project → User, the order in which configuration stacks up. Every item can be selected, and a persistent inspector explains where it comes from, why it is in its state, which files link to it, what it overrides, and which projects it reaches. Normal is quiet: active items carry no badge, a project that matches the global setup says so in three words, and inactive items stay hidden until asked for.

**Key Characteristics:**

- One paper tone, one ink, two grays for secondary text, and a wash for hover and quiet fills. Dark mode swaps paper and ink.
- One accent, taken from the selected tool. Problem red is the only other colour.
- Square corners everywhere and no cast shadows. Floating panels are marked by a 2px ink border.
- 2px rules for structure, 1px ink for controls, dotted lines for dividers and for quiet or unknown outlines.
- The pixel face only at 11, 22, 33 and 44px, one weight, never smoothed or tracked.
- The selected item is an accent fill with a block cursor and a dither edge. Every other "on" state is ink inversion.
- State is a marker shape plus a short text label, never a coloured badge.
- A full-height shell: sidebar, header, view bar, then a content pane and an inspector that scroll independently.

## Colors

A 1-bit palette: paper and ink carry the interface, and two colours carry meaning.

### Primary

- **Ink** (`ink`): text, icons, 1px control borders, the primary button fill, and every inverted "on" state (active nav item, selected toggle segment, selected facet, the Show inactive track, group tabs, the Projects table head). In dark mode ink is the light tone, so inverted states become light fills with dark text.

### Secondary

- **The accent** (`claude` or `codex`, exposed in code as `accent`): the hue of the selected tool. It is the fill of the selected row, the active view tab, the selected startup file, the selected history version and the active search result; the block cursor after the inspector name; the skill-index segment and bars; the text selection; the inset ring on a hovered primary button; and the tints that mark matches and added lines in the editor. Switching the tool switches every one of these.
- **On-accent** (`on-accent`, `on-accent-codex`): the text colour inside an accent fill. Everything inside the fill takes it, whatever muted tone it has elsewhere. It is ink in every case but one: on light Codex blue, ink reaches 4.41:1, so the build uses pure black for 4.76:1.
- **Tool glyphs** (`claude`, `codex`): both tool hues stay available at once for the 15px letter glyphs, which mark which tool an item belongs to wherever it appears.
- **Favicon**: the pixel bot in ink on a square of the selected tool's hue (the light-theme value in both colour schemes). It swaps when the tool toggle changes.

### Tertiary

- **Problem Red** (`problem`): verified problems only, such as a broken symlink, a missing import, malformed config, or missing plugin files. It colours the problem marker, the problem label, the level tag of a problem finding, the Findings count when problems exist, error messages, and the text of a destructive answer (Delete, Remove, Discard).

### Neutral

- **Paper** (`canvas`, `surface`): one value for the page, panels, rows, buttons and dialogs. `surface` and the code's `sidebar` token are aliases of the same value; nothing is separated by a tonal step.
- **Muted Ink** (`ink-muted`): secondary text, state labels, inspector section headings, hints, and the dotted outline of quiet or unknown things.
- **Faint Ink** (`ink-faint`): tertiary text: path directories, counts beside labels, notes in the right-hand column, placeholder text, line numbers. See the deviation below.
- **Rule** (`rule`): the 2px structural lines: the sidebar edge, the line under the view tabs and facets, group boxes, the inspector edge, finding cards, the Projects table. Ink in light mode; a mid gray in dark mode, where full ink would be too loud. The code's `hairline-strong` is an alias.
- **Hairline** (`hairline`): dotted 1px dividers between rows, and the border of a disabled button.
- **Wash** (`wash`): hover on rows and buttons, inline code and code blocks, bar tracks, the active editor line, the head row of a source repo cluster, removed lines in a diff. The code's `hover` is an alias.
- **Selected** (`selected`): one step darker than wash. Used only for an unfocused editor selection, the changed text inside a removed line, and hover on a source cluster head. It is not the selected-row colour; that is the accent.

Every token has a `-dark` twin in the frontmatter. Dark mode swaps the whole set; it is not an automatic inversion.

### Deviations from the pure system

- **Two grays, not one.** `ink-muted` and `ink-faint` are both in use (5.46:1 and 4.71:1 on wash in light mode). They are close enough to read as one gray with two strengths. Faint ink passes 4.5:1 on paper and wash; on `selected` in light mode it is 4.08:1, so it does not belong on that fill.
- **Editor syntax keeps its own hues.** Source in the editor and in diffs is coloured with Monaco's `vs` and `vs-dark` token colours (blue keywords, red strings, green comments, and so on), adjusted to reach 4.5:1 on paper and on wash. These hues exist only inside source text. The editor's surface, selection, match and diff colours are system tokens.
- **Accent tints in the editor.** The editor mixes the accent into paper at 40% (focused selection, changed text), 30% (search matches) and 18% (added lines), so syntax colours stay readable on top. Tints appear nowhere else.
- **Backdrops and glyph letters use literals.** The dialog backdrop is black at 40%, and the letter in a tool glyph is pure black on the tool hue in both themes.

### Named Rules

**The Two-Colour Rule.** Colour appears for two reasons: the selected tool (the accent) and a verified problem (red). Everything else is paper, ink, or gray. Syntax colouring inside source text is the one exception.

**The Accent-Is-The-Tool Rule.** The accent has no hue of its own. It is whatever tool is selected, so the interface tells Claude Code from Codex by its one colour.

**The No-Green Rule.** Green never appears in the interface, and nothing uses colour to mean active, healthy or done. "Active" is the absence of a label. Diffs mark added and removed lines with the accent, wash, and `+` / `−` signs instead of green and red.

**The On-Accent Rule.** Text and icons inside an accent fill all take the on-accent colour. Red text is never placed on an accent fill: the Findings count drops its red while its tab is active.

**The Glyph-Plus-Color Rule.** A tool is always marked with its letter glyph (`C` for Claude Code, `X` for Codex) as well as its colour, so colour is never the only signal. The unselected tool's glyph is an outline.

## Typography

**Display and Machine Font:** Departure Mono (with ui-monospace, SF Mono, Menlo)
**Body Font:** Schibsted Grotesk (with Helvetica Neue, ui-sans-serif, system-ui)
**Source Font:** ui-monospace (SF Mono, JetBrains Mono, Menlo)

**Character:** A bitmap face for what the machine knows and a plain grotesk for what people read. Both faces ship with the app (SIL OFL); nothing loads from the network.

### Hierarchy

- **Figure** (pixel, 44px/44px): the startup token figure in the startup summary.
- **Headline** (pixel, 33px/36px): the name of the selected item at the top of the inspector, and the title of the worktree detail pane.
- **Title** (pixel, 22px/24px): the page title in the header, dialog titles, the document title in the editor, empty-state titles, the on-demand figure, plugin contribution counts, and `h1`/`h2` in the Markdown preview.
- **Mono** (pixel, 11px/14px): paths, versions, matchers, locators, counts, token estimates, key hints, group tabs, Projects table column heads, level tags, the provenance breadcrumb, project and worktree names in the sidebar, and the "agent-mapper" wordmark beside the brand mark.
- **Glyph** (pixel, 11px/15px): the letter inside a tool glyph.
- **Large** (grotesk 400, 15px, 1.35): the search input.
- **Body** (grotesk 400, 13px, 1.45): default UI text, reasons, descriptions, the Markdown preview.
- **Body Strong** (grotesk 600, 13px): item names in rows, view tabs, finding titles, project names in the Projects table.
- **Label** (grotesk 400–600, 12px, 1.4): buttons and toggles (600), facets (500, 600 when selected), table cells, inspector section headings (400, muted), hints, notes.
- **Caption** (grotesk 400–600, 11px/14px): state labels, right-hand row notes, the symlink chip (500).
- **Code** (system monospace, 13px/20px in the editor, 12px in the preview): editor text, diffs, raw file content, code in the Markdown preview.

### Named Rules

**The Whole-Multiple Rule.** The pixel face is set only at 11, 22, 33 or 44px, so its pixels stay square. It has one weight (400), is never emboldened, never letter-spaced, and is rendered without font smoothing. Pixel icons follow the same grid: 11px, or 22px doubled.

**The Pixel-Means-Machine Rule.** The pixel face is for strings the machine owns (a path, a version, a count, a key hint) and for display sizes. Item names in rows, labels, and prose are grotesk: a list of names in the pixel face is too much pixelated text. A hint that is a path (`~/.claude`) is pixel; a hint that is prose ("In this repo") is grotesk.

**The Smooth-Source Rule.** Multi-line source is never set in the pixel face. The editor, diffs, raw file content and code blocks use the system monospace. A code span inside a Markdown heading is the exception: it stays on the heading's pixel grid.

**The Filename-Survives Rule.** Paths are split into a directory and a filename. When space runs out, the directory is cut from its start with an ellipsis and the filename stays visible, in muted ink against the faint directory. Paths inside the selected project are shown relative to its root; others use `~`.

**The No-Eyebrow Rule.** No uppercase letter-spaced eyebrows and no all-caps column headings. Section headings are small, muted, sentence-case grotesk; the item name is the only display type in the inspector.

## Layout

- **Shell:** a full-viewport grid with a 232px sidebar (200px below 1024px) and a flexible main area, divided by a 2px rule. The document never scrolls; regions do.
- **Main area:**
  - A header at least 56px tall: page title, path (shown from 1280px), and branch on the left; tool toggle, Drafts when there are any, Search ⌘K, and an icon-only Rescan on the right. The scan time is in the Rescan tooltip.
  - A view bar of tabs sitting on a 2px rule: Projects, Inventory, Findings in the Global view; Inventory, Findings, and Worktrees when the project has linked checkouts. The Show inactive switch and the coverage notes count sit at the right end.
  - Content and an inspector in two columns divided by a 2px rule, each scrolling independently. The inspector is 380px from 1280px and 320px from 1024px.
- **Narrow windows (below 1024px):** the inspector leaves the grid and floats over the content from the right (at most 380px, leaving 40px of content visible) with a 2px ink edge, only while something is selected or coverage notes are open, with a close button. Worktrees stack the detail pane under the list. The Show inactive switch shortens to "Inactive (N)". In review, the notes pane stacks under the diff.
- **Inventory:** the landing view of a project. The startup summary sits on top and scrolls away; the facets stick to the top of the pane. Groups follow the layer order: Global, installed plugins, each plugin's contributions, Project, User. Each group is one box with a 2px rule and 36px rows. In a project, the groups it inherits (Managed, Global, plugins) sit inside one dotted panel whose head row folds them away, collapsed by default; it starts open when the project has no groups of its own, and selecting an item inside it (from search or the inspector) opens it. The Global view has no such panel.
- **Projects (the Global landing view):** the global startup summary, then a fixed-layout table with one row per project and five columns: Project, Startup, Adds, Differs from global, Findings. Rows grow with their content; the table scrolls sideways below 640px. The inspector appears only while something is selected, so the table keeps the width.
- **Editing:** the document view covers the content and inspector area under the view bar: a toolbar with the title and actions, then the editor, or a diff with a 340px notes pane.
- **Browser surfaces:** text selection is an accent fill with on-accent text; scrollbars are thin, ink on a transparent track.
- **Spacing rhythm:** 4 / 6 / 8 / 12 / 16 / 20px, with 10px for button and tab padding and 14px between groups. Content gutters are 20px; row gutters are 12px.
- **Motion:** state changes are immediate. There are no transitions; the only animation is the Rescan icon pulsing while a scan runs.

## Elevation & Depth

There is no depth. Everything sits on one paper plane; there are no cast shadows and no tonal layering between regions. Separation is drawn: a 2px rule between regions, a 2px ink border around anything that floats.

### Named Rules

**The Border-Not-Shadow Rule.** A floating panel (dialog, search palette, popover, menu, find widget, inline confirmation strip, editor tooltip) is paper with a 2px ink border. Modal surfaces dim the page with black at 40%. The only `box-shadow` in the build is not a shadow: a hovered ink-filled button (the primary button and Add folder's Scan folder) gets a 2px accent ring drawn inside its edge, since ink cannot get darker.

## Shapes

Every corner is square (radius 0): buttons, tabs, chips, markers, glyphs, dialogs, bars. What would be a dot is a square; what would be a pill is a rectangle.

Line weights carry the hierarchy:

- **2px rule:** structure. Region edges, group boxes, the line under tabs, finding cards, the Projects table, `h1` and `hr` in the Markdown preview.
- **2px ink:** floating panels and the segmented toggles.
- **1px ink:** controls. Buttons, inputs, facets, level tags, the document preview box, contribution tiles.
- **1px dotted hairline:** dividers between rows.
- **1px dotted muted ink:** quiet, secondary, or unknown things. The inherited-groups panel, the provenance breadcrumb, the symlink chip, the unknown state marker, pull requests that are not open.

**Dot fills.** Four 1-bit patterns on a 4px grid (`dense`, `mid`, `light`, `check`) are masks, so the dots take the element's background colour. They replace solid bars and tonal steps: the startup bar shows each layer by density (Global dense, Plugins checkerboard, Project mid, User light), the skill index is the accent in checkerboard, group heads run a light dot fill to the right edge, diff stats use a dense and a light swatch for added and removed, and an empty side of a diff is held by a light fill.

**The dither edge.** A fifth pattern, 24px wide, fades from sparse to dense. It closes the right end of a selected row in paper-coloured dots over the accent.

**Icons.** Every icon is an 11×11 bitmap drawn with crisp edges, shown at 11px or doubled to 22px, in the colour of the text around it. There is no icon library.

## Components

### Tool Toggle (header)

Single-select segmented control inside a 2px ink border: `[C Claude Code | X Codex]`, 24px segments. The selected segment is ink inversion with the tool's glyph in its hue; the other segment is muted text with an outlined glyph, and washes on hover. Switching tools clears the selection and changes the accent and the favicon. Following a symlink into the other tool's file switches the toggle automatically. The Preview/Source toggle in the inspector is the same control at 22px.

### Buttons

- **Shape:** square, 28px tall, 1px border, 12px semibold grotesk, 10px side padding.
- **Primary:** ink fill with paper text. One per context: Edit on a row and in the inspector, Save changes in review. Hover draws the 2px accent ring inside the edge. Disabled is wash with faint text and a hairline border.
- **Secondary:** paper with a 1px ink border and ink text (Search, Open in editor, Reveal in Finder, Copy). Hover is wash.
- **Icon-only:** 28×28 with the secondary treatment (Rescan, History, Delete, Close).
- **On an accent fill:** the same three in on-accent terms. Primary is an on-accent fill with accent text; secondary and icon are on-accent outlines.
- **Destructive answers:** a secondary button with problem-red text (Delete, Remove, Discard).

### State Markers (signature)

A 7px square leads every item (9px in the inspector's state line). Its shape carries the state and it takes the colour of the text around it, so it inverts with a selected row:

- **Active:** a solid square, with no text label.
- **Inactive** (not used here, disabled, cached version): a hollow square, a muted name, and a short text label.
- **Unknown / needs approval:** a dotted hollow square and a label prefixed with "?".
- **Problem:** a solid problem-red diamond (the square turned 45°) and a red semibold label. On an accent fill the diamond takes the on-accent colour, since red does not read there; the shape still says problem.

Keyboard focus is a 2px ink outline, 2px off the element. It is not the accent: terracotta on paper is 2.88:1. Inside an accent fill the outline takes the on-accent colour.

### View Tabs and Facets

- **View tabs:** 30px tabs sitting on the 2px rule. The active tab is an accent fill with on-accent text and a 2px border on three sides (ink in light mode, accent in dark); idle tabs are muted semibold text. Each carries its count in the pixel face; the Findings count is red while problems exist and its tab is idle.
- **Facets:** 28px joined tabs with a 1px border, a kind icon, a label, and a pixel count, sitting on a 2px rule. The selected facet is ink inversion. "All" always comes first.

### Show Inactive Switch

A 28×14 track with a 2px border and a 6px square thumb, in the view bar, applying to every view. When on, the track is ink and the thumb moves right. The label includes the hidden count: "Show inactive (40)".

### Startup Summary (signature)

One block above a project's Inventory ("A new session starts with") and above the Projects table ("Your global setup loads"). The Global title describes the global sources only: a project can disable some of them, which its row then shows.

- **Head:** the title as a muted label; in a project, the findings link sits at the right end.
- **Numbers:** "~263 startup" with the figure at 44px, then "~81 on demand" with the figure at 22px (the bar does not include it), then "N unmeasured" when sources could not be measured. Values always carry "~".
- **Bar:** 16px tall, one ink dot-fill segment per startup instruction file, its density set by layer, then the skill index as an accent checkerboard. The selected file's segment turns accent.
- **Load list:** under the bar, each startup instruction in load order as a 22px button: a 12px swatch in the segment's pattern, its estimate, then its path, both in the pixel face. The path tells same-named files apart: files outside the project read from `~` where they sit under the home folder (otherwise as an absolute path), project files lead with the project's folder name ("agent-mapper/CLAUDE.md"). Selecting one opens it in the inspector and fills its button with the accent. The skill index closes the list and opens the **Skill index dialog**. The note "Estimated tokens: characters ÷ 4" sits at the right end.
- **Findings link:** in a project, "2 problems · 3 other" with a dotted underline and an arrow (only problems are red). Absent when there are none.

### Inventory Groups and Rows

- **Group head:** a 26px strip above the rows: an ink tab holding the layer icon, the label and the count in the pixel face, then a location hint, then a light dot fill running to the right edge, with a 2px rule beneath. Plugin groups show the plugin name and version. In a project, its own groups (Project, User) swap the layer icon for the tool glyph.
- **Inherited panel:** a 1px dotted muted outline around everything a project inherits. Its 32px head row holds a chevron, the layer names, a count, and "Comes from outside this project", and folds the groups away.
- **Source cluster:** skills installed from the same repo sit under a 32px wash row (chevron, repo and count in the pixel face) that folds them away.
- **Row:** 36px: kind icon, state marker, name (13px semibold grotesk), a symlink chip slot, a detail slot (path, matcher, or version, in faint pixel type), and a right-aligned state label. Rows are separated by dotted hairlines. Hover is wash. An active row that wins an override or shares its name with another skill carries a faint note in the label slot ("overrides AGENTS.md", "shared name") and shows its path even where the path is conventional.
- **Selected row (signature):** an accent fill. Everything in it takes the on-accent colour, a 7×13px block cursor follows the name, and the dither edge closes the right end.
- **Row actions:** the name is the row's button, stretched over the row. Rows for files the app can edit show 28px buttons while hovered, focused or selected: primary **Edit**, then on skills and agents **Copy** and a Delete icon button (not on plugin or managed items). They float over the right end of the row on the row's own fill, so the columns keep their widths.

### Symlink Chip and Links (signature)

- **Chip:** an 18px rectangle with a 1px dotted outline, a link icon and the word "symlink" (11px, in the surrounding text colour). It appears on any entry whose resolved path differs from its entry path, in the Inventory and the inspector. As a button, its outline turns solid on hover and it opens a popover (native `popover`, anchored under the chip) with the folder the link resolves into and **Open in Finder**.
- **Two-way links:** the inspector for a symlink shows **Symlink to** with a clickable row to the source file. The source's inspector shows **Linked from N places**, with a clickable row for each link. Rows from the other tool show that tool's glyph.

### Projects Table (signature)

One 2px ruled box. The head row is ink inversion with pixel column names in sentence case; body rows are separated by dotted hairlines and wash on hover. The row header (project name in semibold grotesk over its path in faint pixel type) opens the project.

- **Startup:** the project's approximate startup tokens, in the pixel face.
- **Adds:** what the project's own folder contributes, as kind icon, count, and kind name ("2 Skills"). Each opens that project's Inventory filtered to the kind. Empty reads "Nothing of its own".
- **Differs from global:** global sources that apply globally but not plainly here, grouped by their state in the project ("Not used here reviewer", "Disabled context7"), or "Does not reach" when the project's scan does not list them. Hooks add their matcher, since several share an event name. Up to three names per state, then a "+N more" button that shows the rest. A name opens the item in that project; one the project never reached opens the global record in the inspector. No differences reads "Same as global" in muted text.
- **Findings:** "1 problem · 2 other" linking to that project's Findings, or "None".
- A project that is still scanning or failed to scan says so across the row and claims nothing. While a project rescans, its previous results stay at 40% opacity, and a previous error reads "Rescanning…".

### Confirmations and Dialogs

- **Dialog:** a 520px paper panel with a 2px ink border, hung 12vh from the top over a 40% black backdrop. The title is 22px pixel type with a Close icon button; answers sit right-aligned in a footer.
- **Inline question** (worktree Remove and Prune, the project list's remove, Discard changes): the button gives way to the question, **Keep** and a red-text answer, without a dialog. In table rows and the sidebar the question floats as a strip (paper, 2px ink border) over the row, so nothing moves: in a table it grows left from the action cell; in the sidebar it starts at the row's left edge and extends past the sidebar over the content, so the full question fits. Escape, a click elsewhere, or scrolling keeps.
- **Skill index dialog:** titled "Skill index", with one sentence on what the index is, the total at 22px with the skill and command counts, and the "Estimated tokens: characters ÷ 4" note. Then one 36px row per skill or command, largest first: its estimate in the pixel face, kind icon, name, its source (plugin name or layer) only when sources differ, and an 8px bar: an accent checkerboard on a wash track, scaled to the largest row. Choosing a row closes the dialog and opens the item in the inspector. No footer.
- **Delete dialog** (skills and agents): titled "Delete name?" with one sentence on what goes to the Trash (a folder with its file count and size, a file, or only a symlink while its target stays), warnings for other paths that will break or installer records left behind, and a note that Put Back restores it. Cancel and a red-text **Delete**.

### Inspector

A paper pane on the right behind a 2px rule, 20px side padding:

- a kind line (kind icon, kind name, tool glyph, symlink chip with its popover);
- the Headline name, followed inline by a 21×30px accent block cursor;
- a state line (marker, semibold state text, then facts such as "7 lines · ~90 tokens" with their figures in the pixel face) and the reason in muted body text;
- a provenance breadcrumb in pixel type inside a dotted outline (`Global › ~/.claude/CLAUDE.md`, or `Plugins › plugin version › skills/x/SKILL.md › locator`);
- sections under small muted sentence-case headings: precedence (**Overridden by**, **Overrides**, **Shares its name with**) with a clickable row per related item, symlink sections, **Imports** with each import's status (red when missing or unreadable), a contributions grid for plugins (1px ink tiles with a 22px count), a Details key-value list, and "Reaches N of M projects" (a project it does not reach shows a short dash in place of a marker);
- for files the app can edit, a document block: an action row (primary **Edit**; **Copy** and **Delete** on skills and agents; a History icon button at the far end), then the Preview/Source toggle on its own row above the text, which sits in a 1px ink box (a Codex agent is TOML, which has no preview, so it shows source only);
- the actions (Open in editor, Reveal in Finder).

When nothing is selected, it shows a centered 22px layers icon, a hint, and the active/inactive counts. Coverage notes open here too.

### Markdown Preview

Body text is 13px/20px grotesk. Headings are the pixel face in two sizes for six levels: `h1` and `h2` at 22px, `h3` to `h6` at 11px; a 2px rule sets `h1` apart from `h2`, and muted ink sets `h4` and below apart from `h3`. Lists use square bullets. Inline code and code blocks sit on wash in the source font. Block quotes have a 2px dotted ink edge. Table heads have a 1px ink underline and rows a dotted hairline. Links are ink with an underline, not the accent: terracotta on paper falls short of 4.5:1.

### Editor and Review

- **Document toolbar:** tool glyph, the file name at 22px, an "Unsaved changes" note with a 7px square, the path in pixel type, and the actions (Back to edit, primary Save changes, Back to inventory).
- **Editor:** 13px/20px source font on paper. The caret is 2px ink; the active line is wash; a focused selection is the 40% accent tint; search matches are the 30% tint with a 1px ink outline and plain ink text, and the current match is a full accent fill with on-accent text. The find widget is a floating panel at the top right.
- **Diff:** removed lines sit on wash and added lines on the 18% accent tint; `−` and `+` beside the line numbers mark them. Where one side has no lines, a light dot fill holds the gap.
- **Review notes:** "3 lines changed" with dense and light swatches for added and removed counts, then the scanned contexts the file affects, each with its tool glyph, path and state. Scans still running or failed stay listed, so impact is never overstated.
- **History:** a list of versions with dotted dividers; the chosen one is an accent fill.

### Navigation (sidebar)

- **Brand:** the pixel bot at 22px in paper on a 26px ink square, then "agent-mapper" in 11px pixel type, then a 24px icon button that cycles Auto → Light → Dark and shows the current choice.
- Global (globe icon), then a muted "Projects" label and project rows: folder icon, name in pixel type, and a branch icon with the worktree count. On hover the count gives way to a remove button.
- The selected project expands to show its first three worktrees (26px rows in pixel type) and "N more worktrees".
- Rows are 30px. The active row is ink inversion; hover is wash.
- The footer, above a dotted hairline, holds Removed (when any) and Add folder….

### Search Palette

`⌘K` opens a 640px floating panel with a 48px borderless input at 15px, a 2px rule under it, results as 36px inventory rows, and a footer of key hints in pixel type (↑↓ navigate · ↵ inspect · esc close). The active result is an accent fill. Results are scoped to the selected tool, with inactive items listed last.

### Findings

A stack of boxes (2px rule, 12px padding, 8px apart, at most 900px wide): an info icon or a red alert icon, the title in semibold grotesk, a level tag (a 1px ink outline with the level in pixel type; a problem's tag is red), the reason in muted text, and clickable source paths in pixel type, each led by an arrow, that open the inspector.

### Worktrees

Checkout rows and difference rows reuse the Inventory group head and the 36px row. A pull request badge is an 18px outlined tag in pixel type: solid ink when open, dotted and muted when draft, merged or closed; hover inverts it. The detail pane mirrors the inspector.

### Logo and Marks

- **Logo** (`docs/logo/`, for GitHub and the README only): a Code 128 barcode of "agent-mapper", split around the pixel bot, stacked over the pixel wordmark. One fill: ink on light, paper on dark. It does not appear in the app.
- **Brand mark** (in the app): the pixel bot on an ink square. It does not change with the tool.
- **Favicon:** the pixel bot in ink on a square of the selected tool's hue.

## Do's and Don'ts

### Do:

- **Do** show one tool at a time and let symlink links carry the connection between tools.
- **Do** order layers Global → Plugins → Project → User everywhere: Inventory groups, the startup bar, and breadcrumbs.
- **Do** keep active items silent. Put a text label only on non-active states.
- **Do** hide inactive items (not used, disabled, cached) behind the Show inactive switch and always show the hidden count.
- **Do** collapse repeats: cached plugin versions and shared source repos. A project that matches the global setup says "Same as global" instead of listing anything.
- **Do** make every item selectable and explain it in the inspector: state, reason, provenance, precedence, links, reach.
- **Do** mark the selected item with an accent fill, and every other "on" state with ink inversion.
- **Do** put everything inside an accent fill in the on-accent colour, and use the on-accent button variants there.
- **Do** set the pixel face only at 11, 22, 33 or 44px, at one weight, without tracking or smoothing.
- **Do** show quantity with dot fills: density for layers, the accent checkerboard for the skill index.
- **Do** give a floating panel a 2px ink border on paper.
- **Do** keep the filename visible when paths are cut, and show project paths relative to the project root.
- **Do** keep text at 4.5:1 or better on the fill it sits on, in both themes.
- **Do** check every screen in light and dark mode and with both tools selected, including empty, loading, error, and partial-coverage states.

### Don't:

- **Don't** round a corner or cast a shadow.
- **Don't** add a hue. The accent and problem red are the only colours outside source syntax.
- **Don't** use green anywhere, or colour to mean active, healthy or done.
- **Don't** use red for anything except verified problems, errors, and the text of a destructive answer. Shadowed, disabled, and unknown are neutral.
- **Don't** put red text on an accent fill.
- **Don't** use the accent as a text colour on paper: terracotta is 2.88:1 and Codex blue 4.07:1.
- **Don't** set item names in rows, labels, or prose in the pixel face, and don't set multi-line source in it.
- **Don't** use an icon library, an emoji, or a font glyph as an icon. Icons are 11×11 bitmaps.
- **Don't** separate regions with a tonal step. Draw a rule.
- **Don't** use strikethrough for inactive items. It reads as "deleted"; use a hollow marker and a muted name.
- **Don't** badge every row with a state pill. "expected", "configured", and "selected" together say nothing.
- **Don't** label MCP servers Connected, Healthy, or Authenticated.
- **Don't** repeat summary panels above every view. The startup summary belongs on the two landing views only.
- **Don't** use uppercase letter-spaced eyebrows or all-caps column headings.
