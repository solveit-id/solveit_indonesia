---
name: Solveit Indonesia
description: Company profile and portfolio assembled from the logo's own geometry, four capsules on a 33 degree axis.
colors:
  brand-navy: "#082a56"
  brand-slate: "#5c7392"
  brand-cobalt: "#1452ed"
  brand-deep: "#1136d6"
  brand-azure: "#178bff"
  brand-cyan: "#19b8f2"
  paper: "#f1f4f9"
  paper-raised: "#f8fafd"
  paper-sunken: "#e6ecf5"
  ink: "#082a56"
  ink-muted: "#4a6283"
  ink-faint: "#6b809d"
  line: "rgb(8 42 86 / 0.13)"
  line-strong: "rgb(8 42 86 / 0.28)"
  accent: "#1452ed"
  accent-hover: "#1136d6"
  accent-ink: "#f6f9ff"
  accent-text: "#1146d8"
  field: "#1136d6"
  field-ink: "#f4f7ff"
  field-ink-muted: "#c9d6fb"
  field-line: "rgb(244 247 255 / 0.22)"
  focus: "#1452ed"
  selection: "rgb(20 82 237 / 0.18)"
  paper-dark: "#050f22"
  paper-raised-dark: "#0a1830"
  paper-sunken-dark: "#030a18"
  ink-dark: "#e9effa"
  ink-muted-dark: "#a3b5cf"
  ink-faint-dark: "#8094b3"
  accent-hover-dark: "#2a66ff"
  accent-text-dark: "#6aa6ff"
  field-dark: "#0f34cc"
typography:
  display:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 4.7vw, 4.4rem)"
    fontWeight: 720
    lineHeight: 1
    letterSpacing: "-0.03em"
    fontVariation: "\"wdth\" 118"
  title:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2rem, 4.2vw, 3.6rem)"
    fontWeight: 720
    lineHeight: 1.02
    letterSpacing: "-0.03em"
    fontVariation: "\"wdth\" 112"
  headline:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.4rem, 2.1vw, 1.85rem)"
    fontWeight: 720
    lineHeight: 1.15
    letterSpacing: "-0.03em"
    fontVariation: "\"wdth\" 118"
  lede:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.125rem, 1.5vw, 1.375rem)"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.6
    fontFeature: "\"tnum\""
    fontVariation: "\"wdth\" 100"
  label:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.3
rounded:
  focus: "0.375rem"
  field: "1.25rem"
  panel: "1.75rem"
  capsule: "9999px"
spacing:
  gutter: "clamp(1rem, 4vw, 3rem)"
  section: "clamp(5rem, 11vw, 9.5rem)"
  header: "4.5rem"
  container: "88rem"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.capsule}"
    padding: "0 1.4rem"
    height: "3rem"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
    textColor: "{colors.accent-ink}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.capsule}"
    padding: "0 1.4rem"
    height: "3rem"
  button-on-field:
    backgroundColor: "{colors.field-ink}"
    textColor: "{colors.field}"
    rounded: "{rounded.capsule}"
    padding: "0 1.4rem"
    height: "3rem"
  input-text:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.capsule}"
    padding: "0.85rem 1.25rem"
    height: "3.25rem"
  input-textarea:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "0.85rem 1.25rem"
  choice-capsule:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.capsule}"
    padding: "0.55rem 1.1rem"
    height: "2.75rem"
  choice-capsule-checked:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  panel-raised:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "2.25rem"
  panel-accent:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.panel}"
    padding: "2rem"
  field-band:
    backgroundColor: "{colors.field}"
    textColor: "{colors.field-ink}"
---

# Design System: Solveit Indonesia

## Overview

**Creative North Star: "Precision in Motion"**

Every surface is built from the logo: four rounded capsules, each tilted to the same 33 degree axis, that lock together into an S. The capsule is the system's one shape for anything single-line and interactive, the 33 degree line is its only diagonal, and the logo's cobalt is its only accent. Parts becoming a solution is the brand story, and the hero tells it literally by assembling the mark from its four capsules.

The ground is cool porcelain read in daylight, with logo navy as ink. Cobalt shows up two ways: sparingly as the action color, and boldly as committed fields (the closing call to action and footer band, accent tiles, process panels). Type is one variable grotesk, Archivo, pushed semi-expanded and heavy for display, normal width for reading. Density is moderate and generous with section rhythm; layouts are asymmetric 12-column splits rather than centred stacks. Light is the default for every visitor; a dark theme, chosen with the header switch and remembered, keeps the same structure on a deep navy night ground. Every page exists in Indonesian and English with the same composition.

The build rejects the SaaS template: centred headline over a gradient, three identical feature cards, testimonial carousels, decorative glow, and arbitrary decorative icons.

**Key Characteristics:**
- Full capsules for buttons, inputs, choice pills, tags, and icon wells; 28px panels for containers.
- 33 degrees is the only diagonal: hero lattice, generative cover art, menu icon, system map connectors, tile wipes.
- One accent (cobalt), committed as fields, never sprinkled; cyan lives only inside capsule gradients.
- Archivo variable on its width axis: wide and heavy for headings, normal width for text.
- Flat surfaces separated by tone and hairlines; the only shadow is the primary button's cobalt lift.
- Scroll-coupled motion with a distinct role per section, all of it optional under reduced motion. Real scroll parallax is used in three places only: the hero's layered planes, portfolio covers drifting inside their frames, and the About mark that reassembles as its section reaches the middle of the screen.

## Colors

A cool, nearly monochrome blue world: porcelain and navy carry everything, and the logo's cobalt is the single voice that asks for action.

### Primary
- **Logo Cobalt** (accent): primary buttons, active nav underline, the process rail fill and lit markers, the hovered project arrow well, and full accent tiles. Hover deepens to **Logo Deep Cobalt** (accent-hover) in light and brightens (accent-hover-dark) in dark.
- **Accent Text Cobalt** (accent-text): cobalt for words on paper, a hair darker than the button cobalt for small-text contrast; becomes a light sky blue (accent-text-dark) on the night ground. Used for the emphasised word in headlines and the active mobile menu item.
- **Field Cobalt** (field): the committed full-bleed band holding the closing call to action and footer. Text on it uses **Field Ink** (field-ink), **Field Ink Muted** (field-ink-muted) for secondary lines, and **Field Line** (field-line) for dividers.

### Secondary
- **Logo Azure** (brand-azure) and **Logo Cyan** (brand-cyan): never flat UI colors. They appear only as gradient stops inside lit capsules (the brand mark and generative cover art).

### Neutral
- **Porcelain** (paper): page ground. **Porcelain Raised** (paper-raised) for panels, inputs, and choice pills; **Porcelain Sunken** (paper-sunken) for a stepped section such as the work showcase band.
- **Logo Navy** (ink): primary text, the checked state of choice pills, and the navy tile in the principles bento.
- **Muted Slate Ink** (ink-muted): secondary text, ledes, breadcrumbs, metadata. A darkened version of the logo's slate so small text passes contrast.
- **Faint Slate Ink** (ink-faint): large text only (about 3.7:1 on paper).
- **Hairline** (line) and **Strong Hairline** (line-strong): navy at 13% and 28%. Hairlines divide sections and index rows; strong hairlines outline secondary buttons, inputs, pills, and the hero lattice.
- **Night ground** (paper-dark, paper-raised-dark, paper-sunken-dark) with **Night Ink** (ink-dark) and its muted and faint steps replace the light neutrals in the dark theme (`:root[data-theme="dark"]`); the cobalt accent itself does not change. The OS colour scheme is deliberately not followed: light is the default.
- **Danger** (`--danger`): #b42318 light, #ff9c8f dark, for field errors and the form error summary only.

### Named Rules
**The One Voice Rule.** Cobalt is the only accent. Where it appears in quantity it is a committed field or tile, not a tint scattered across components.

**The Gradient Containment Rule.** Gradients exist only inside capsules (azure and cyan stops on the mark and cover art). No gradient backgrounds, no gradient text.

## Typography

**Display Font:** Archivo Variable (with ui-sans-serif, system-ui, sans-serif)
**Body Font:** Archivo Variable, same family at normal width

**Character:** One self-hosted grotesk, subset to Latin and limited to width 100 to 120 percent and weight 400 to 800. Headings use the width axis to go semi-expanded and heavy, echoing the logo's wordmark; text stays at normal width so reading stays easy.

### Hierarchy
- **Display** (720, clamp(2.5rem, 4.7vw, 4.4rem), line-height 1, width 118%): page H1s only (hero and inner-page intros), held to about 15 to 18ch.
- **Title** (720, clamp(2rem, 4.2vw, 3.6rem), line-height 1.02, width 112 to 118%): section H2s, held to about 12 to 18ch.
- **Headline** (720, clamp(1.4rem, 2.1vw, 1.85rem), line-height 1.15, width 118%): H3s in tiles, process steps, large project cards.
- **Lede** (400, clamp(1.125rem, 1.5vw, 1.375rem), line-height 1.5): the one-sentence summary under a heading, in muted ink, capped at 62 to 64ch.
- **Body** (400, 1.0625rem, line-height 1.6, normal width, tabular numerals): running text, capped at 64ch by the measure utility.
- **Label** (600, 0.9375rem): field labels and fieldset legends, sentence case. Metadata is 0.875rem in muted ink.

All headings share letter-spacing -0.03em and balanced wrapping; paragraphs use pretty wrapping.

### Named Rules
**The Width Axis Rule.** Hierarchy comes from width and weight together: headings expand (112 to 118 percent) and go to 720; text never leaves 100 percent width.

**The Sentence Case Rule.** No uppercase tracked labels. Small headings, legends, and metadata stay sentence case at normal tracking.

## Layout

A 88rem container with a fluid gutter (clamp(1rem, 4vw, 3rem)) and a 12-column grid from the `lg` breakpoint. Compositions are asymmetric splits: the hero is 7 over 5, the service index is a 7-column list beside a 5-column sticky preview, the process rail is 4 sticky over 7. Sections breathe on a single fluid rhythm (clamp(5rem, 11vw, 9.5rem)) and are separated by hairline top borders or a tonal step, not cards. The header is a fixed 72px bar: open over the hero, a translucent porcelain surface once content passes beneath, and from 768px a floating capsule further down the page (see Navigation). It never changes height and never hides. Below `lg` everything stacks to one column; the work showcase becomes a native horizontal snap scroller, and pinned or parallax effects are skipped. Anchored targets keep a 6rem scroll margin to clear the header.

## Elevation & Depth

Flat by default. Depth comes from tonal steps (paper, raised, sunken), hairlines, and committed cobalt or navy fields. The single shadow belongs to the primary button: a tight, negatively spread cobalt shadow that reads as lift and deepens on hover. The translucent header uses a medium backdrop blur once scrolled. Pointer-driven parallax on the hero mark (fine pointers only) supplies the remaining sense of depth.

### Shadow Vocabulary
- **Cobalt lift** (`box-shadow: 0 10px 24px -14px rgb(17 54 214 / 0.75)`; hover `0 14px 30px -14px rgb(17 54 214 / 0.85)`): primary button only; removed when disabled.
- **Overlay** (`0 24px 48px -28px rgb(var(--shadow-tint) / 0.6)`): floating layers only (the WhatsApp number menu, the assistant panel, the route status chip, and, slightly tighter, the floating dock controls and the compact header capsule), to read as above the page. Cards and panels in the flow still carry none.

### Named Rules
**The Tone Not Shadow Rule.** Containers separate by tone and hairline. Cards and panels carry no shadow.

## Shapes

The form language is the logo's capsule. Anything single-line and interactive (buttons, text inputs, choice pills, tags, demo labels, arrow wells, rail markers) is a full capsule (9999px). Containers, tiles, cover art frames, and preview panels use the panel radius (1.75rem, 28px); multi-line fields and contact cards use the field radius (1.25rem, 20px). Focus rings keep a small 0.375rem radius. The only diagonal in the system is 33 degrees: the menu icon's bars, the lattice and cover capsules, system map connectors, and the clip-path wipes on tiles and the closing band. Generative cover art is a deterministic composition of capsules on that axis, never screenshots.

## Components

### Buttons
Confident capsules with an arrow that nudges forward on hover.
- **Shape:** full capsule (9999px), min height 3rem (2.75rem in the header), 1.4rem side padding, 600 weight at 1rem.
- **Primary:** cobalt on near-white ink with the cobalt lift shadow; hover deepens the cobalt and the shadow.
- **Secondary:** transparent with a strong hairline outline in ink; hover darkens the outline to full ink.
- **On field:** field ink background with cobalt text, for use on the cobalt band; hover goes to pure white.
- **States:** press shifts down 1px and scales to 0.985; the trailing arrow icon slides 3px right on hover; disabled drops to 55% opacity without shadow. Transitions use the expo-out curve over 0.25s.

### Chips (choice capsules)
- **Style:** radio or checkbox rendered as a pill, raised porcelain with a strong hairline, 550 weight at 0.9375rem, min height 2.75rem.
- **State:** hover darkens the outline to muted ink; checked inverts to navy fill with porcelain text; keyboard focus draws the 2px focus ring around the pill.
- **Static tags:** the same capsule outline at text-sm without fill; the demo label uses a dashed strong hairline.

### Cards / Containers
- **Corner Style:** panel radius (28px).
- **Background:** raised porcelain with a hairline for neutral panels; cobalt or navy for committed tiles; generative cover art inside project cards.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Internal Padding:** 2rem to 3rem, scaling up at `lg`.
- **Project card:** 4:3 cover (16:7 for a lead entry), title in the wide face, metadata separated by a short vertical hairline, and a capsule arrow well that fills cobalt and rotates 45 degrees on hover while the cover slowly scales and drifts.

### Inputs / Fields
- **Style:** raised porcelain, strong hairline, full capsule for single-line inputs (min height 3.25rem), field radius for textareas (min height 9rem, vertical resize). Caret is cobalt.
- **Focus:** border turns cobalt with a 3px soft cobalt selection ring.
- **Error:** border and message switch to a red (#b42318 light, #ff9c8f dark); hints sit below in muted ink at 0.875rem.

### Navigation
- **Order:** Beranda, Tentang Kami, Layanan, Portofolio, Proses Kerja (Home, About Us, Services, Portfolio, Process), then the contact page as the primary capsule ("Mulai konsultasi"), so the header never shows two links to one page. "Beranda" joins the desktop row from 1280px; the logo is always the home link.
- **Adaptive bar:** one 72px box in three states. Transparent over the hero; a translucent porcelain plate with a bottom hairline after 8px of scroll; past 96px the plate is clipped (`clip-path: inset(... round 9999px)`) into a floating capsule edged by a fading hairline capsule, and the logo condenses to 90%. It expands again only below 40px (hysteresis). Below 768px the plate stays full-bleed, because a capsule leaves the 44px controls no room.
- **Desktop:** text links at about 0.97rem, 500 weight, muted ink; the current section (nested case studies included) goes full ink and sits over one 3px cobalt capsule indicator that slides between links on hover and keyboard focus and settles back (transform only, 0.55s expo-out). Before hydration a static underline holds the same spot. On the contact page the capsule button reads as pressed (Logo Deep Cobalt with an inner hairline, in both themes).
- **Preferences:** an ID / EN segmented capsule and a 44px capsule theme switch sit between the links and the contact capsule. The language thumb slides to the target the moment it is chosen (from the pending navigation), stretching along its axis as it travels, and breathes while a slow switch loads. The theme switch carries sun and moon on one dial pivoting below the button: half a turn sets the sun and raises the moon, and the reverse plays the same path back. Both share one state set: hover tints the capsule with sunken porcelain, press compresses it (100ms), focus draws the ring. Below 640px a single 44px capsule naming the other language (EN or ID) stays in the header, and the menu panel shows the full segmented switch with language names.
- **Mobile:** a secondary capsule toggle with a two-bar 33 degree icon and a text label opens a full-height panel of large wide-face links divided by hairlines; the current page turns accent-text cobalt with a short capsule marker on the 33 degree axis. The panel foot holds the contact capsule and the WhatsApp menu. It leaves with a 220ms lift before hiding; a route change closes it at once.
- **Inline links:** the link sweep, a 1px underline that sweeps in from the left over 0.45s.

### Contact channels
- **WhatsApp menu:** one "Chat WhatsApp" capsule (secondary on porcelain, outlined on the cobalt field, or an inline footer link) discloses a raised panel with the three confirmed numbers as equal rows: index capsule, number, arrow. No owner, department, or hours are shown because none are confirmed. Built on `<details>`; closes on Escape, outside click, or a pick.
- **WhatsApp list:** the same rows laid out in a raised card on the contact page, above the email and Instagram cards.
- **Contact card:** raised porcelain, hairline, field radius, icon in accent-text cobalt, label over value, arrow that nudges up-right on hover.
- **Instagram:** the official account as a plain external link (footer, contact page) and in `Organization.sameAs`; no feed or counts.

### Forms
- The inquiry form is three groups (about you, about the project, send), each opened by a hairline and a heading with a 2rem outlined index capsule, like the process rail markers.
- Rhythm: 1.75rem between a group heading and its fields, 1.5rem between fields, 0.5rem between label, hint, control, and error. Required fields carry a cobalt asterisk; optional ones say so in muted ink.
- Paired single-line fields share a two-column row from 768px; selects use the same capsule as inputs with a slate chevron. The WhatsApp recipient is a row of choice capsules; switching it never touches the composed message.

### Floating dock
- Bottom right, inside the safe area: a 44px porcelain back-to-top capsule above the assistant launcher. Back-to-top appears after 1.2 screen heights, steps aside while the assistant is open, and returns focus to the page after scrolling up (smooth unless reduced motion).
- Both step off-screen to the right while a `[data-floating-avoid]` element (the contact form's send buttons) sits in the bottom 28% of the screen. The footer's last row carries extra bottom space so nothing ends under the dock.
- Rendered only after hydration, so neither ever shows as a dead button.

### Solveit Assistant
- **Launcher:** a navy (ink) capsule holding the gradient mark in a porcelain well, labelled "Tanya Solveit"; icon-only below 640px and on the contact page. Open, the mark turns into a close glyph and the label rolls to "Tutup".
- **Panel:** raised porcelain, panel radius, overlay shadow, 24rem wide above the launcher; a bottom sheet over a scrim below 640px (modal: the page goes inert). Header: mark well, title, the honest subtitle "Panduan otomatis, bukan AI atau staf", restart and close. Guide bubbles in paper with a hairline; the visitor's bubbles in ink. Points use short cobalt capsules on the 33 degree axis. Topic chips are choice capsules that invert to ink on hover. The hand-off block is dashed, like every other "not yet" signifier.
- **Motion:** opens in 420ms from the launcher corner, closes in 220ms; each new message enters from its own side.

### Loading feedback
- Branded load screen on document loads only ("Four capsules. One solution."), full (about 1.3s) on the first load in a browser tab and a compressed version (about 0.6s) on later reloads in that tab: a fullscreen porcelain sheet where the four capsules of the primary lockup arrive along the 33 degree axis, the wordmark slides out from behind the mark, and INDONESIA drops in; as soon as the fourth capsule locks and the page is ready the stage lifts and the sheet, trailed by a cobalt band, wipes away to the bottom right. Static CSS and SVG driven by `<html data-boot>`, capped at 2.6s, never shown without JavaScript, a still mark and a short fade under reduced motion. Client navigations show a thin indeterminate cobalt runner along the top edge after 150ms, and after 900ms a porcelain status chip whose mark is the four capsules drifting apart and locking back together. No percentages.

### Client stories
- Until a client approves a testimonial, the home page shows a pledge: a quotation mark built from two gradient capsules on the 33 degree axis, the promise, and dashed capsule slots for what every story will carry (name and role, project context, approval date).
- With approved testimonials, the same slot shows one large quote at a time (Archivo 560 at 106% width, about 34ch), a hairline-led caption, and capsule previous/next buttons. Quotes are uncovered along the diagonal and leave in 200ms; there is no autoplay. No Review or AggregateRating markup is ever emitted.

### Brand mark assembly (signature)
The logo mark sits over a faint lattice of outlined capsules on the 33 degree axis and assembles from its four capsules on load, with pointer depth on fine pointers. A monochrome version of the mark repeats inside the cobalt closing band.

### Process rail (signature)
A vertical hairline with a cobalt fill that grows as the reader scrolls; capsule markers (2.75rem circles) light cobalt as each step is passed. Without JavaScript or under reduced motion every marker is lit.

## Do's and Don'ts

### Do:
- **Do** make every single-line interactive element a full capsule (9999px) and every container a 28px panel.
- **Do** keep 33 degrees as the only diagonal, for lines, capsules, icons, and clip-path wipes alike.
- **Do** spend cobalt as a committed field or the single action color, and keep azure and cyan inside capsule gradients.
- **Do** set headings in Archivo at 720 weight, 112 to 118 percent width, -0.03em tracking; keep running text at normal width, 1.0625rem, line-height 1.6.
- **Do** separate sections with the section rhythm (clamp(5rem, 11vw, 9.5rem)) plus a hairline or tonal step.
- **Do** keep content visible without JavaScript and under reduced motion; hero copy enters by CSS, everything scroll-driven belongs to GSAP and is optional.
- **Do** use generative capsule covers for portfolio imagery, and label demonstration concepts with the dashed demo capsule.

### Don't:
- **Don't** build the SaaS template: centred headline over a gradient, three identical feature cards, testimonial carousel.
- **Don't** use glow, gradient backgrounds, or gradient text; gradients belong inside capsules only.
- **Don't** add shadows to cards or panels; the cobalt lift is reserved for the primary button.
- **Don't** introduce uppercase tracked eyebrows or kickers above headings.
- **Don't** use arbitrary decorative icons; icons are functional Phosphor arrows and carets.
- **Don't** alter the logo's shapes; only its monochrome version on cobalt and the dark-mode wordmark color are allowed variations.
- **Don't** set a global `scroll-behavior: smooth` or add a smooth-scroll library; both break Back-button scroll restoration or nested scrolling here.
- **Don't** show fake progress or hold the page back for an animation; the one full-screen moment is the first-load brand sequence, which leaves as soon as its entrance has played and the page is ready, and every other wait gets feedback scaled to its real length.
- **Don't** use Faint Slate Ink for small text.
