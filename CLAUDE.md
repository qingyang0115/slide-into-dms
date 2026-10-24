# Slide Into DMs — Game Jam Project

Game jam entry. Theme: **"slide"**. Time limit: **1.5 days**. Scope ruthlessly.

## Concept

The player is a nervous loser trying to slide into their crush's DMs. Replying is a **bullet hell minigame** inside a phone screen: collect the right words in order, dodge the cringe ones. Whatever you collect gets sent, so mistakes produce a garbled, embarrassing message and the crush reacts to it.

## Game flow

Title → **story scene** (intro) → level 1 → short story beat → level 2 → ... → ending scene.

Story scenes are visual-novel style: character sprites on a background, speech bubbles with typewriter text, click/Space to advance. They set up why the player is texting and react to how each level went.

## Core loop (one level)

1. **Crush message** appears at the top of the phone chat (with a "typing..." indicator first).
2. **Bullet phase starts.** The player controls a small sprite (sweating heart) inside the play area.
   - **Target words** drift/slide around. Touching the *next correct word* adds it to the reply bar.
   - **Bad words** ("u up?", "lol", "k", "sorry", "😳") fire in bullet patterns. Touching one **inserts it into the message** and raises anxiety.
   - Touching a correct word out of order also counts as a mistake (inserted in the wrong place).
3. **Anxiety meter** rises over time and on hits. Higher anxiety = faster bullets, screen shake, sweat vignette, text wobble.
4. **Send:** the message auto-sends when the sentence is complete, or when the timer runs out / anxiety maxes (sends whatever is in the bar).
5. **Crush reply** depends on result:
   - Clean message → the level's ending branch for success.
   - Garbled message → funny fail reaction ("seen 11:42pm", "who is this", etc.).
6. Next level, or game over screen with retry.

## Branching endings

Some levels offer **multiple valid sentences** (e.g. chill / flirty / unhinged). Which one the player completes picks the crush's reply and affects the final ending. Track the choices in a simple score object (`chill`, `flirty`, `unhinged` counts).

## Tech stack

- **Plain HTML + CSS + JavaScript**, using **Canvas 2D** for the bullet hell play area. No build step, no framework. HTML/CSS is fine for menus, chat UI and story speech bubbles.
- Animation: spritesheet frame cycling in JS (canvas or CSS `background-position`), CSS transitions/keyframes for slides, bounces, shakes and fades.
- Must run by opening `index.html` through a simple local server (`npx serve` or `python -m http.server`).
- Target: **itch.io HTML5 upload** (zip the folder). Keep all paths relative.
- Fixed logical resolution (e.g. 450×800 portrait, phone-shaped), scaled to fit the window. Must work with **mouse and keyboard** (WASD/arrows to move, Shift for slow-focus movement). Touch support is a stretch goal.

## File structure

```
index.html
style.css
src/
  main.js        # boot, scene/state switching
  story.js       # story scenes: sprites, speech bubbles, typewriter, advance
  sprites.js     # spritesheet animation helper
  game.js        # bullet phase: loop, collisions, scoring
  patterns.js    # bullet pattern definitions
  chat.js        # chat UI: crush messages, typing indicator, reply bar
  anxiety.js     # anxiety meter + its effects
  assets.js      # asset loading with placeholder fallback
  audio.js       # sound effects
data/
  levels.json    # ALL level content lives here
  story.json     # ALL story/dialogue content lives here
assets/
  art/           # PNGs made by the artist (human)
  sfx/           # sound effects
```

## ⚠️ Art rules (important)

**All art is drawn by a human team member.** Claude must NOT generate, draw, or replace art.

- Load every image **by exact filename** from `assets/art/`.
- If a file is missing, draw a **labeled placeholder** (colored rectangle/circle with the filename as text) so the game is always playable.
- Never hardcode sizes that depend on the final art. Read the image's dimensions at load time, or scale to the sizes listed below.
- Art is drawn at **2× display size**, PNG with transparency.

### Asset list

| File | Use | Display size (approx) |
|---|---|---|
| `bg_phone.png` | Phone frame / chat background | full screen |
| `player_heart.png` | Player sprite in bullet phase | 24×24 |
| `char_player_idle.png`, `char_player_sweat.png`, `char_player_panic.png`, `char_player_happy.png` | Protagonist reactions (switch by anxiety/result) | 96×96 |
| `char_crush_neutral.png`, `char_crush_amused.png`, `char_crush_unimpressed.png` | Crush avatar reactions | 96×96 |
| `bubble_crush.png`, `bubble_player.png` | Chat bubbles (9-slice if possible) | stretchable |
| `chip_good.png`, `chip_bad.png` | Word bullet backgrounds (text drawn on top in code) | stretchable |
| `fx_sweat_vignette.png` | High-anxiety overlay | full screen |
| `screen_title.png`, `screen_gameover.png`, `screen_ending.png` | Menus | full screen |
| `bg_bedroom.png`, `bg_classroom.png` | Story scene backgrounds | full screen |
| `story_player_<expression>_sheet.png` | Protagonist story sprite, e.g. `story_player_nervous_sheet.png` | ~200×300 per frame |
| `story_crush_<expression>_sheet.png` | Crush story sprite | ~200×300 per frame |
| `story_friend_<expression>_sheet.png` | Optional friend/hype-man sprite | ~200×300 per frame |
| `bubble_speech.png` | Story speech bubble (9-slice if possible) | stretchable |

### Spritesheet convention

- One animation per file, frames in a **single horizontal row**, every frame the **same size**.
- Frame size and count are declared in `data/sprites.json`, e.g. `{ "story_player_nervous_sheet.png": { "frameWidth": 400, "frameHeight": 600, "frames": 4, "fps": 6, "loop": true } }`. Claude adds entries here; the artist updates the numbers if they change.
- A single non-sheet PNG must also work (treated as 1 frame).
- If a sheet is missing, show a labeled placeholder that still "animates" (e.g. bobs) so timing can be tested.

If an asset is added that isn't in this table, add it to the table.

## Level data format (`data/levels.json`)

All content is data. Adding a level must never require code changes.

```json
{
  "levels": [
    {
      "id": "party",
      "crushMessage": "hey are u going to the party?",
      "answers": [
        { "words": ["yeah", "i'll", "be", "there"], "tone": "chill", "reply": "cool see u there" },
        { "words": ["only", "if", "you", "are"], "tone": "flirty", "reply": "omg 😳" }
      ],
      "badWords": ["u", "up?", "lol", "sorry"],
      "patterns": ["rain", "aimed"],
      "bulletSpeed": 1.0,
      "timeLimit": 20,
      "failReplies": ["seen 11:42pm", "???", "who is this"]
    }
  ]
}
```

- `answers`: one or more valid sentences. Whichever the player starts collecting first becomes the target (the first word of each answer is spawned as a good word at the start).
- `patterns`: names from `patterns.js`, cycled through during the level.
- Difficulty ramps through the level data (`bulletSpeed`, `timeLimit`, more `badWords`), not code.

## Story data format (`data/story.json`)

All dialogue is data. Rewriting the story must never require code changes.

```json
{
  "scenes": {
    "intro": {
      "background": "bg_bedroom.png",
      "lines": [
        { "speaker": "player", "sprite": "story_player_nervous_sheet.png", "position": "left", "text": "ok. ok. she posted a story. i'm gonna reply." },
        { "speaker": "friend", "sprite": "story_friend_hype_sheet.png", "position": "right", "text": "BRO just slide in. what's the worst that could happen", "effect": "shake" },
        { "speaker": "player", "sprite": "story_player_panic_sheet.png", "position": "left", "text": "literally everything" }
      ],
      "next": "level:party"
    }
  }
}
```

- `next` is either `level:<id>` or `scene:<id>`. Levels can point to a scene after success/fail via `"afterWin"` / `"afterFail"` fields in `levels.json`.
- `effect` (optional): `shake`, `bounce`, `slideIn`, `fadeIn`.
- Typewriter text; click/Space finishes the line instantly, a second press advances. Add a small "skip scene" button.
- Keep the whole story short: **intro (~6–10 lines), 1–3 lines between levels, ending (~5 lines)**. The bullet hell is the main game.

## Bullet patterns (keep to 3–4)

1. `rain` — bad words fall from the top at random x.
2. `aimed` — bad words shot from the edges toward the player's position.
3. `spiral` — bad words spin out from the crush's avatar.
4. `wall` — a horizontal line of words with one gap.

Make one pattern feel good before adding the next.

## Build order (do these in sequence, test each before moving on)

1. Scaffold: index.html, phone-shaped canvas, scaling, state machine (title → level → result → game over), placeholder asset loader.
2. Player movement in the play area (with Shift focus mode), plus a single `rain` pattern.
3. Good words, the reply bar, collision rules (correct / wrong order / bad word), and message assembly.
4. Timer, auto-send, crush reply (success vs garbled fail), level loading from `levels.json`.
5. Anxiety meter and its effects (speed, shake, vignette, protagonist face swap).
6. Story system: `story.json` loading, background, sprites with the spritesheet helper, speech bubbles, typewriter, advance/skip, effects. Wire scenes into the game flow with `next` / `afterWin` / `afterFail`.
7. Remaining patterns and branching answers/tones, plus the final ending scene based on tone counts.
8. Juice: typing indicator, hit flash, send whoosh, screen shake, sound effects, transitions between story and gameplay.
9. Title screen, game over + retry, ending screen. Prepare the itch.io zip.

**Stretch only if everything above is done:** a bonus "pass the note in class" level, touch controls.

## Working rules for Claude

- Keep the game **playable after every change**. Small, testable steps.
- Prefer simple code over clever code. This is a jam, not production.
- Tunable numbers (speeds, hitbox sizes, anxiety rates) go in one `CONFIG` object at the top of the relevant file.
- Generous hitboxes for good words, small hitbox for the player (standard bullet hell feel).
- Don't add libraries without asking.
- When fixing a bug, explain the cause in one line.
- Feature freeze ~2 hours before the deadline: after that, only bug fixes.

## Tone

Comedic and cringe, but affectionate. Fail messages should be funny, never mean. Keep everything school-appropriate.
