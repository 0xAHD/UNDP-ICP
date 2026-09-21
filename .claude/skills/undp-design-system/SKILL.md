---
name: UNDP Design System
description: Apply UN visual and voice standards to every output. Use for any artifact, HTML, written document, brief, report, or piece of copy meant to look or read like it belongs to UNDP or the wider United Nations system. Covers colours, typography, spacing, component patterns, tone, structure, and anti-patterns.
---

# UNDP Design System

> **Why this copy lives in the repo.** The account-level copy of this skill is
> *synced* and is overwritten when it next syncs, which would silently restore
> the wrong colour values. This project-scoped copy is version-controlled and
> wins for work in this repository. If the synced copy is ever corrected
> upstream, reconcile and delete this one.
>
> Corrections made here, measured from the live stylesheet rather than recalled:
> brand is `#006EB5` (not `#009edb`), ink is `#232E3D` (not `#1a1a1a`), rules
> are `#D4D6D8`, page headlines are UPPERCASE, and the primary button is a
> bright accent fill with BLACK text (not blue with white). Fonts are
> ProximaNova / SohneBreit — licensed, so substitute and say so.


This skill tells you how to make anything you produce look and sound like it belongs to the United Nations Development Programme. Apply it silently — do not narrate the rules or explain the design choices unless the user asks. Just produce outputs that follow them.

**Visual tokens verified 21 September 2026** against the live stylesheet at
innovation.eurasia.undp.org. Part 2 and Part 5 carry measured values, not
recalled ones. If they conflict with memory, trust the file.

**How this skill is organised:**
- Part 1 covers ALL outputs (voice, tone, structure). Always applies.
- Part 2 covers interactive artifacts (HTML/CSS/JS tools). Applies whenever generating a clickable prototype.
- Part 3 covers written documents (reports, briefs, notes). Applies whenever generating written material.
- Part 4 is the anti-patterns list — what NEVER to do.
- Part 5 is a paste-ready CSS quick reference for artifacts.

If a request only needs artifact styling, ignore Part 3. If it only needs written output, ignore Part 2. Parts 1 and 4 always apply.

---

## PART 1 — CORE PRINCIPLES (always applies)

### Voice and tone

The UNDP voice is:

- **Measured.** No hyperbole, no marketing language, no exclamation points. Never "revolutionary," "game-changing," "world-class," "cutting-edge." If a claim is strong, let the evidence carry it.
- **Evidence-first.** Every meaningful assertion should be attached to a number, a source, or a caveat. If there is no evidence, name that ("preliminary findings suggest…").
- **Concrete.** Prefer specific places, dates, numbers, and people over abstractions. "In three districts of Malawi in 2025" beats "in multiple countries recently."
- **British English.** Colour, organisation, programme, centre, analyse.
- **Non-partisan.** UNDP works with governments across the political spectrum. Never take a stance on domestic politics or contested geopolitical questions.
- **Human-first, not tech-first.** Even when writing about digital solutions, lead with who benefits and how — technology is the vehicle, not the destination.
- **Respectful of country ownership.** UNDP does not impose solutions; it supports national priorities. Language should reflect partnership, not delivery.

### Structural conventions

- **Numbers matter.** Where a claim can be quantified, quantify it. Round large numbers to 2-3 significant figures and use the correct unit ("USD 2.4M" not "2,400,000 dollars").
- **Names spell out on first use.** "United Nations Development Programme (UNDP)" on first mention; UNDP thereafter. Same for country office ("UNDP Tanzania Country Office"), programmes, SDGs, and funds ("Green Climate Fund (GCF)").
- **Attribute.** When citing a figure or claim, name the source ("2024 Annual Report," "internal M&E dashboard," "World Bank data").
- **Distinguish evidence from projection.** Never present a forecast as a fact. Use "projected," "estimated," "if fully deployed" for future claims. Baseline numbers should be labelled as such.

### Cultural sensitivity

- Country names use their preferred English form (Türkiye, Côte d'Ivoire, Democratic Republic of the Congo — spelled out).
- Do not group countries into unhelpful buckets ("developing world," "third world"). Prefer specific regions or the phrase "low and middle-income countries" where a grouping is unavoidable.
- Beneficiary language is respectful: "smallholder farmers," "displaced households," "people living with disabilities" — never "the poor," "the disabled," "victims."

---

## PART 2 — INTERACTIVE ARTIFACTS

Apply this section whenever generating an HTML/CSS/JS artifact, interactive tool, mockup, or visualization.

### Colours

**These are the real tokens**, read from the live UNDP Design System stylesheet
on innovation.eurasia.undp.org (verified 21 September 2026). Do not approximate
them from memory — earlier guesses at "UN blue" were wrong by a noticeable
margin.

```
/* Brand */
--undpds-color-brand:     #006EB5   /* NOT #009edb — that is the older UN blue */

/* Neutrals — the grey ramp does most of the work */
--undpds-color-white:     #ffffff
--undpds-color-gray-100:  #FAFAFA
--undpds-color-gray-200:  #F7F7F7   /* section backgrounds */
--undpds-color-gray-300:  #EDEFF0
--undpds-color-gray-400:  #D4D6D8   /* borders, rules */
--undpds-color-gray-500:  #A9B1B7
--undpds-color-gray-530:  #84929D
--undpds-color-gray-560:  #677383   /* meta text */
--undpds-color-gray-600:  #55606E   /* secondary text */
--undpds-color-gray-700:  #232E3D   /* headings and body ink — NOT black */
--undpds-color-black:     #000000

/* Accents — bright, used as flat fills with BLACK text on them */
--undpds-color-azure-200: #A2DAF3   --undpds-color-azure-400: #60D4F2   --undpds-color-azure-600: #00C1FF
--undpds-color-green-200: #B8ECB6   --undpds-color-green-400: #6DE354   --undpds-color-green-600: #59BA47
--undpds-color-yellow-200:#FFE17E   --undpds-color-yellow-400:#FFEB00   --undpds-color-yellow-600:#FBC412
--undpds-color-red-200:   #FFBCB7   --undpds-color-red-400:   #EE402D   --undpds-color-red-600:   #D12800

/* Button fills seen in production — black text, never white */
--button-bg: #d0f54f    /* lime */
--button-bg: #13d882    /* green */
--button-text: #000000
```

How to apply it:

- **Ink is `gray-700` (#232E3D), not black and not #1a1a1a.** This is the single
  most common mistake. Body copy, headings, everything.
- **Paper is white.** `gray-200` (#F7F7F7) for section bands and inset panels.
- **Borders are `gray-400` (#D4D6D8).**
- Brand blue is for links and occasional headings — it is NOT the dominant
  colour. The palette reads as near-black type on white with bright accents.
- **The 600-weight accents carry semantic meaning**: green-600 confirmed / open,
  red-600 blocked / closed, yellow-600 attention. The 400 weights are decorative
  accents (card tints, category markers), not status.
- Accents are **flat fills with black text**. Never white text on an accent.

### Typography

The live site uses two licensed faces:

- **ProximaNova** — body, UI, everything by default
- **SohneBreit** — display, used sparingly for large headings

Both are licensed and cannot be shipped in most work. When unavailable,
substitute and say so rather than silently using something else:

- ProximaNova → **Mulish** is the closest free match for its
  geometric-humanist proportions. Montserrat is too wide; Roboto is too
  neutral and reads as Android rather than UNDP.
- Alias the substitute (`font-family: 'UNDP Sans'`) so swapping in the real
  woff2 later is a one-line change.

**Self-host fonts. Do not load from Google Fonts.** A third-party font request
tells that party who visited the page, which is inappropriate for UNDP work and
actively contradictory on anything making a privacy claim. `@fontsource/*`
packages provide woff2 files that can be copied into a build.

```
h1: 40px / 1.1 / weight 800 / UPPERCASE / letter-spacing -0.01em / text-wrap balance
h2: 22px / 1.3 / weight 700
h3: 18px / 1.4 / weight 700
body: 15-16px / 1.45-1.6 / weight 400
small: 13px / 1.5
kicker: 11px / weight 500 / 0.14em letter-spacing / uppercase / brand blue
```

**Page-level headlines are UPPERCASE.** The live site sets
`text-transform: uppercase` on its hero title, with `text-wrap: balance`. This
is the most recognisable single cue of the current UNDP look — a sentence-case
hero reads as generic corporate. Section headings (h2/h3) stay sentence case.

Kickers — small uppercase labels in brand blue above a heading — signal the
start of a content block. Use them liberally.


### Spatial rules

- **No rounded corners.** UN design is rectilinear. Border-radius is 0 or, at most, 2px for form inputs. Never round buttons, cards, images, or containers.
- **No drop shadows.** Elevation is communicated through borders, spacing, or background colour — never shadows. Interactive states can use a 1px outline or a subtle background shift.
- **No gradients.** Solid colours only. If depth is needed, use adjacent tones from the palette.
- **Generous whitespace.** Between sections: 48px on desktop, 32px on mobile. Between related elements: 16-24px. Inside cards: 24px padding minimum. Cramped layouts feel administrative, not institutional.
- **Content max-width.** Body copy caps at 720px for readability. Full-width layouts should still have generous side padding (48px+ on desktop).

### Component patterns

**Buttons.** Rectangular, square corners. Primary is a **flat bright accent fill with BLACK text** (lime #d0f54f or green #13d882 in production) — not a blue fill with white text. Secondary is transparent with a brand-blue border and brand-blue text. Padding 12px 24px, text uppercase 12px, letter-spacing 0.1em, weight 500. Hover darkens the fill slightly. No icons unless they carry meaning.

**Cards.** White background, 1px `--rule` border, no shadow, no rounded corners. Padding 24px. Section kicker in UN Blue, title in Roboto weight 500, body in Roboto 15px. Cards do not lift on hover; if interactive, show a brand-blue left border on hover.

**Tables.** No zebra striping. Header row uses `--paper-soft` background and Roboto weight 500. Cell padding 12px vertical / 16px horizontal. Bottom border only, 1px `--rule`. Numbers right-aligned in Roboto Mono. Text left-aligned in Roboto.

**Forms.** Labels above inputs (never inline). Labels in Roboto weight 500, 13px, ink colour. Inputs: 1px `--rule` border, 12px padding, 15px Roboto text, no border-radius. Focus state: 2px brand-blue outline. Never use placeholder text as a label.

**Data visualization.** Use brand blue as the primary series colour. Additional series use `--ink-soft`, then `--muted`, then semantic colours only if they carry meaning. Chart backgrounds are `--paper`, not `--paper-soft`. Axes and gridlines are `--rule`. Labels in Roboto 12px `--ink-soft`.

**Navigation.** Top nav uses brand-blue background with white text. Links weight 400, uppercase, 13px, letter-spacing 0.1em. Active state: 3px white underline. Do not use dropdowns without a clear reason.

**Status indicators.** Use short text labels ("On track," "At risk," "Blocked") next to a 8px filled circle in the corresponding semantic colour. Never use just a colour circle — always pair with text for accessibility.

### Layout principles

- Content organized in clear horizontal bands, each with a purpose (header, intro, main content, related items, footer).
- Grid: 12-column on desktop, 4-column on mobile. Gutter 24px.
- Kickers signal the start of a new content type. Use them liberally to help scannability.
- Everything should be legible on a 375px-wide mobile screen.

### Accessibility

- Text contrast must meet WCAG AA (4.5:1 for body, 3:1 for large text).
- All interactive elements need a visible focus state (2px brand-blue outline).
- Never rely on colour alone to convey information — always pair colour with text or icon.
- Buttons and links have minimum touch target of 44×44px on mobile.

---

## PART 3 — WRITTEN DOCUMENTS

Apply this section whenever producing reports, briefs, concept notes, memos, or long-form written content.

### Document structure

Every UNDP document should have:
- **Title** in Roboto Slab, weight 700, sentence case (not Title Case)
- **Kicker line above title** identifying document type ("PROGRAMME BRIEF," "COUNTRY OFFICE UPDATE")
- **Meta line below title** — date, author or unit, version if applicable
- **Executive summary** — one paragraph, 100-150 words, containing: what this is about, why it matters, the ask or takeaway
- **Body** — organized by argument, not chronologically
- **References or annexes** — clearly separated from main body

### Section structure

Sections open with a bold sentence stating the point of the section. Then evidence and elaboration. Then a transition to the next point.

Bad: *"This section discusses gender indicators."*
Good: *"Gender-disaggregated data collection improved in three of the four programme components, driven mainly by the M&E team's revised guidance issued in Q1."*

### Paragraph shape

- Lead with the point. Do not build to it.
- Evidence in the middle. Numbers, quotes, references.
- End with implication or transition.
- 3-5 sentences average. Break up longer arguments into multiple paragraphs.

### Numbers, dates, units

- Numbers under 10 spelled out ("three districts"), 10 and above as numerals ("42 households").
- Large numbers rounded and unitised: "USD 2.4M," not "2,400,000 dollars."
- Dates: "25 May 2026" (day-first, no ordinals).
- Percentages: "12%" not "12 percent."
- Currencies use ISO codes: USD, EUR, GBP.

### Callouts and pull-quotes

Use sparingly. When used, format as:
- **Data callout:** A single number (Roboto Slab weight 700, 48px) with a short caption below (Roboto 13px, `--muted`).
- **Pull quote:** A short excerpt (Roboto Slab weight 400, italic, 20px) with attribution below (Roboto 12px small caps).

### Tone specifics for common document types

- **Concept notes**: crisp, argumentative, closes with a specific ask.
- **Progress reports**: honest about setbacks, quantitative on results, forward-looking on adaptation.
- **Donor briefs**: leads with impact numbers, uses accessible language, avoids jargon.
- **Country office updates**: focuses on partnership and local ownership, uses country partner names.

---

## PART 4 — ANTI-PATTERNS (never do these)

Regardless of what is being generated, avoid the following.

### Visual anti-patterns

- Rounded corners on anything (border-radius > 2px)
- Drop shadows on cards, buttons, or containers
- Gradient backgrounds or gradient text
- Accent colours outside the documented undpds ramp
- Neon or saturated colours for backgrounds
- Purple, hot pink, or any "startup" palette
- Emoji as UI elements (a single relevant emoji in body copy is fine; emoji as buttons or icons is not)
- Icons without labels
- Glassmorphism, neumorphism, or trendy effects
- Animation for its own sake — only animate when it aids understanding

### Copy anti-patterns

- Marketing language ("revolutionary," "game-changing," "unlock," "empower" as a verb)
- Exclamation points (except in a direct quote)
- Corporate buzzwords ("synergy," "leverage" as a verb, "circle back," "moving forward")
- Startup voice ("we're on a mission to…," "join us as we…," "the future of X")
- Casual second-person addressing readers ("you'll love this feature") — UNDP writes for institutions, not consumers
- American English spellings (color, organization, program, center, analyze)
- Unsourced statistics
- Superlatives without evidence ("the largest," "the most effective")
- Political stance on any contested domestic or geopolitical issue
- Language that positions UNDP as saviour or lead actor rather than partner

### Structural anti-patterns

- Deep nesting (more than 2 levels of indentation)
- Long uninterrupted text without visual breaks
- Titles in Title Case (UNDP uses sentence case for titles)
- Numbers without units
- Dates in US format (05/25/2026) — use 25 May 2026
- Country groupings that flatten diversity ("Africa," "the Global South" without context)

---

## PART 5 — QUICK REFERENCE CSS

Paste at the top of any artifact stylesheet as a baseline. Overrides only where the specific artifact needs it.

```css
:root {
  --brand: #006EB5;
  --brand-dark: #005691;
  --ink: #232E3D;          /* gray-700 */
  --ink-soft: #55606E;     /* gray-600 */
  --muted: #677383;        /* gray-560 */
  --rule: #D4D6D8;         /* gray-400 */
  --paper: #ffffff;
  --paper-soft: #F7F7F7;   /* gray-200 */
  --success: #59BA47;      /* green-600 */
  --warning: #FBC412;      /* yellow-600 */
  --danger: #D12800;       /* red-600 */
  --accent-lime: #d0f54f;  /* primary button fill, black text */
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'UNDP Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif;
  color: var(--ink);
  background: var(--paper);
  font-size: 15px;
  line-height: 1.6;
}

h1, h2, h3 { font-weight: 700; letter-spacing: -0.01em; }
h1 { font-size: 40px; line-height: 1.1; font-weight: 800;
     text-transform: uppercase; text-wrap: balance; }
h2 { font-size: 22px; line-height: 1.3; }
h3 { font-size: 18px; line-height: 1.4; }

.kicker {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--brand);
  margin-bottom: 8px;
}

button, .btn {
  border: none;
  padding: 12px 24px;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-primary { background: var(--accent-lime); color: #000; }
.btn-primary:hover { background: #c2eb33; }
.btn-secondary { background: transparent; color: var(--brand); border: 1px solid var(--brand); }

.card {
  background: var(--paper);
  border: 1px solid var(--rule);
  padding: 24px;
}
```

Self-host the fonts; never load them from Google. Use brand blue only for links, kickers and occasional headings — the palette reads as near-black type on white with bright accent fills. No rounded corners, no shadows, no gradients. Kickers signal section starts. British English. Sentence case for titles.

That is the skill. Apply it to every output.
