# Mission Orders: CHASQUI — Imperial Messenger (Codex)

> Chasqui runs on ChatGPT Codex. Copy-paste the relevant task below
> as a self-contained prompt. Chasqui doesn't read CLAUDE.md, so each
> task includes all necessary context.

---

## About Chasqui

Named for the Inca relay runners who carried quipus between cities.
Fast and reliable for specific deliveries, but operates under different
protocols. Give clear messages, clear destinations. Don't ask for
improvisation.

---

## Task 1: News Ticker Content

**Copy this entire block as a Codex prompt:**

```
You are writing content for a satirical web app called "Farts Around The World"
— a global flatulence monitoring system styled like an OSINT intelligence
war room dashboard. It has a CNN/Bloomberg-style breaking news ticker at
the bottom of the screen.

Write 40 ticker messages. Each should be 1 sentence, 80-120 characters,
written in the deadpan style of a real intelligence agency alert or
breaking news chyron. The humor comes from treating farts with the gravity
of geopolitical events.

Rules:
- Reference real countries from this list: US, GB, DE, FR, JP, CN, BR, IN, AU, CA, MX, RU, NG, ZA, EG, AR, KR, ID, TR, IT
- Mix these categories: geographic alerts, dietary correlations, diplomatic incidents, suspicious patterns, weather-style advisories, analyst assessments
- No actual offensive content — the joke is the gap between serious tone and silly subject
- Use military/intelligence jargon: SIGINT, FLASH TRAFFIC, ADVISORY, ANALYST BRIEF, ASSESSMENT, etc.
- Some should reference specific foods as suspected causes
- Some should reference "suspicious silence" (low-activity zones)
- A few should be seasonal or time-of-day references

Format: Return as a JavaScript array of strings, ready to paste into code.

Example entries:
"FLASH TRAFFIC: Embassy staff evacuated in Rome following sustained emission event — diplomatic incident assessment pending"
"ADVISORY: Suspicious fart gap detected across Scandinavia — Regional silence exceeds 4-hour threshold"
"SIGINT INTERCEPT: Munich bratwurst festival correlated with 340% EPM surge — GASCON upgraded to CRITICAL"
```

**Where to put the output:**
Save it. Mark will paste the array into `src/config/humor.ts` as
`export const TICKER_MESSAGES: string[] = [...]`

---

## Task 2: Country Intelligence Dossier Templates

**Copy this entire block as a Codex prompt:**

```
You are writing satirical "intelligence dossier" profiles for a web app
called "Farts Around The World" — a global flatulence monitoring system
styled like an OSINT war room.

Write mock intelligence profiles for these 10 countries:
US, GB, DE, FR, JP, IT, BR, IN, AU, MX

Each profile should be a JSON object with these fields:
{
  "country": "XX",
  "codename": "OPERATION [FUNNY NAME]",
  "threatAssessment": "LOW | MODERATE | ELEVATED | HIGH | CRITICAL",
  "primaryDietaryVector": "the food most associated with this country's emissions",
  "peakActivityWindow": "e.g., '12:00-14:00 LOCAL (post-lunch surge)'",
  "signatureCharacteristic": "one sentence about this country's unique fart profile",
  "analystNote": "2-3 sentence deadpan intelligence assessment",
  "suspectedCorrelations": ["array", "of", "3-4", "funny correlations"]
}

Rules:
- Play on real cultural food stereotypes in a lighthearted way (no actual offense)
- Use military/intelligence language throughout
- The humor is deadpan — write it as if this is a genuine classified brief
- Each profile should feel distinct and capture something real about the country's cuisine

Format: Return as a JavaScript/TypeScript array of objects, ready to paste into code.

Example:
{
  "country": "IT",
  "codename": "OPERATION VESUVIUS",
  "threatAssessment": "HIGH",
  "primaryDietaryVector": "Pasta carbonara, aged cheese, espresso",
  "peakActivityWindow": "13:00-15:00 LOCAL (post-pranzo digestive event)",
  "signatureCharacteristic": "Italian emissions exhibit a distinctive warmth and complexity, with pronounced dairy undertones.",
  "analystNote": "The Italian Peninsula has been a persistent hotspot since monitoring began. Intelligence suggests a direct correlation between regional cheese aging traditions and ambient methane levels. The afternoon siesta period is assessed as a force multiplier.",
  "suspectedCorrelations": ["Truffle season", "Sunday family dinners", "Espresso consumption rate", "Proximity to Parmesan aging caves"]
}
```

**Where to put the output:**
Save it. Mark will add it to `src/config/` as a new file when we build
the country dossier feature (Phase 2).

---

## Task 3: Submission Ceremony Text Sequences

**Copy this entire block as a Codex prompt:**

```
You are writing UI text for a satirical web app's "fart submission" form.
When a user submits a fart event, a dramatic progress sequence plays
(like filing a classified intelligence report).

Write 3 different submission sequences. Each sequence has 5 steps shown
in order with a delay between each. Steps should be short (3-6 words)
and feel like a military processing pipeline.

Also write 10 different "confirmation" messages shown after successful
submission. Each should be 1 sentence, deadpan, acknowledging the
submission as if it were vital intelligence.

Format: Return as JavaScript objects ready to paste into code.

Example sequence:
["TRIANGULATING COORDINATES...", "CLASSIFYING EMISSION TYPE...", "CROSS-REFERENCING DIETARY DATABASE...", "ASSIGNING FIELD OPERATIVE...", "REPORT FILED — CONFIRMED"]

Example confirmations:
"Your contribution to the global intelligence picture is noted and appreciated."
"The Council has received your report. The potato nods in acknowledgment."
```

**Where to put the output:**
Save it. Mark will add it to `src/config/humor.ts` when the submission
form is ready.

---

## Notes for Mark

- Copy each task as a standalone Codex prompt
- Codex will return formatted code — paste it into the right config files
- Don't ask Chasqui to modify existing source files — just content generation
- These are low-risk, high-comedy tasks perfect for Codex's strengths
