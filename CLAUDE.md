# Slide Into DMs — Game Jam Project

Game jam entry. Theme: **"slide"**. Time limit: **1.5 days**. Scope ruthlessly.

## Concept

**Everyone is a slide (a slipper)** in a high school romance. The player is a nervous, clumsy slipper trying to slide into their crush's DMs. Replying is a **bullet hell minigame** inside a phone screen: collect the right words in order, dodge the cringe ones. Whatever you collect gets sent, so mistakes produce a garbled, embarrassing message and the crush reacts to it. Two separate meters track how it's going: the crush's **satisfaction** (health) and the player's **anxiety** (difficulty). From level 2 on, his friends' **group chat sabotage** him: notifications slide in and cover the play area.

## Story & characters

- **Finn** (protagonist, he/him): a clumsy **fish slipper** who is always slipping. His clumsiness is the core joke: just as he slips in real life, he "slips" in his texts.
- **Clover** (crush, she/her): a **bunny slipper** girl at the same school, with long wobbly ears.
- **Zig** (best friend, optional): **striped slippers**, the hype man in story scenes. Written without pronouns.
- **The group chat** ("2E3 Slide Squad"): Zig plus two more friends, **Jun Hao** and **Aisyah**, who only exist as notification senders. Besides friends, notifications can be random school/Singapore-flavoured app pings (Canvas assignments, Shopee deals, Grab).

**Setup:** in a freshly mopped corridor Finn rushes, slips, and crashes into Clover (a classic anime meet-cute, but with slides). She walks off. That night he decides to text her an apology. Over the five levels the apology slowly turns into flirting.

**Level arc** (ids in `levels.json`):

| # | id | stage | Her message is about |
|---|---|---|---|
| 1 | `apology` | apology | "are you the slipper who flattened me?" |
| 2 | `smalltalk` | awkward small talk | "what do you do for fun?" |
| 3 | `teasing` | light teasing | "do you slip on purpose?" |
| 4 | `courage` | working up the courage | "are you going to the dance?" |
| 5 | `question` | the big question | "why are you really texting me?" |

**Death phrases are Finn's texting accidents.** Keep them in character: typos, blurting, and puns on falling, slipping and footwear (e.g. "head over heels"). See "Death phrases".

**Endings** are picked from the tone counts (see "Branching endings"): good (she agrees to walk to class with him), neutral (they stay friends), or funny-bad (he slips one last time).

## Game flow

Title → **story scenes** (intro: the corridor crash, then Finn at home) → level 1 → short story beat → level 2 → ... → level 5 → **ending scene** (good / neutral / funny-bad, picked by tone counts).

Story scenes are visual-novel style: character sprites on a background, speech bubbles with typewriter text, click/Space to advance. They set up why the player is texting and react to how each level went.

## Core loop (one level)

1. **Crush message** appears at the top of the phone chat (with a "typing..." indicator first).
2. **Bullet phase starts.** The player controls a small sprite (sweating heart) inside the play area.
   - **Target words** drift/slide around. Touching the *next correct word* adds it to the reply bar.
   - **Bad words** ("u up?", "lol", "k", "sorry", "😳") fire in bullet patterns. Touching one **inserts it into the message**, **lowers crush satisfaction**, and **raises anxiety**. It never ends the level on its own.
   - Touching a correct word out of order is a **smaller mistake**: it is inserted in the wrong place and costs less satisfaction than a bad word.
   - **Group chat notifications** (levels that enable them) slide in over the play area and hide what's underneath. Dismiss them while dodging (see "Group chat sabotage").
3. **Two meters** run during the phase (see "Meters" below). Satisfaction is the health bar. Anxiety is the difficulty driver and can never make you lose.
4. **Send:** the message auto-sends as soon as any of these happens:
   - the sentence is complete,
   - the timer runs out (sends whatever is in the bar),
   - satisfaction hits zero,
   - a **death phrase** forms in the reply bar (see "Death phrases").
5. **Crush reply** depends on the outcome:
   - **Sentence completed with satisfaction left** → level passed. The reply is the answer's `reply`. A perfectly clean message gets the amused face; a message with mistakes in it still passes, but the crush stays neutral.
   - **Satisfaction empty or timeout** → level failed, with a generic funny reaction from `failReplies` ("seen 11:42pm", "who is this", etc.).
   - **Death phrase** → level failed instantly, with the special reveal and the phrase's own `reply`.
6. Next level, or game over screen with retry.

## Meters

### Satisfaction (crush health, shown near the crush's avatar)

- Starts full. Bad-word hit: big loss (default: about **3 hits empties it**). Correct word touched out of order: smaller loss.
- The crush's avatar face follows it: neutral, then unimpressed as it drops.
- At zero, the garbled message sends and the level is failed with a generic fail reply.

### Anxiety (difficulty driver, shown next to the protagonist)

- Does **not** cause losing. It only changes difficulty and feel: bullet speed, screen shake, text wobble, sweat vignette, protagonist face.
- Rises steadily over time during the bullet phase, on bad-word hits, and slightly on **near-misses** (a bad word passing within a small radius of the player without touching).
- Drops a little each time a correct word is collected.
- All rates (time rise, hit rise, near-miss rise, near-miss radius, correct-word drop) live in `ANXIETY_CONFIG`.

## Group chat sabotage

During the bullet phase his friends' group chat keeps buzzing. Notification banners **slide in** (from the top, left or right edge of the play area), **stay**, and hide whatever is underneath. He has to **slide them away** while still dodging and collecting. It fits the theme: everything here slides.

- **Banners are harmless:** they never damage the player and never block collisions or word pickups. Bullets and words keep moving and hitting underneath. The danger is **not seeing** incoming bad words. The player's own heart is always drawn on top of banners so you can always see yourself.
- **Dismiss:** with the mouse, **drag/swipe** the banner away (past ~60px it flies off in the swipe direction; a shorter drag springs back) or just **click** it. With the keyboard, press **Q** to dismiss the **most recent** banner, so keyboard-only players can handle them while moving. A dismissed banner whooshes off screen.
- **Anxiety:** every banner left on screen slowly raises anxiety (per banner, per second). Dismissing one gives a small anxiety drop. This makes ignoring them costly without making them deadly.
- **Cap:** at most `maxOnScreen` banners (default 3) at once, placed so they don't overlap when there's room, so the play area is never fully blocked. New ones wait until there's a free slot.
- **Feel:** a phone-buzz sound when one arrives, a slide-in animation, and a quick whoosh when it's swiped away.
- **Content:** each banner has a sender and a text. Friends hype or tease him ("DID U TEXT HER YET", "bro is typing for 10 mins 💀", "just say u love her lol"), or it's a random app ping (Canvas assignment, Shopee 9.9 sale, Grab). Messages should fit the level's story moment, be light Singlish at most, and stay school-appropriate and affectionate.
- **Pacing:** level 1 has none (learn the basics first). Level 2 introduces them at a low rate, and later levels ramp up. A story beat before level 2 explains why his phone is blowing up.
- **Tuning:** all timing and anxiety numbers live in `NOTIF_CONFIG` (`notifications.js`): slide-in time, max on screen, first-banner delay, anxiety per second per banner, anxiety drop on dismiss, swipe distance. Per-level frequency is `notificationRate` in `levels.json`.

## Death phrases

Rare, coherent, **telegraphed** instant fails. A death phrase forms when individual words combine in the reply bar, possibly across word boundaries. Example: the good words "be" and "at" and the bad word "u up" are each scored normally on their own, but if the bar reads "be at u up" in sequence, that reads as "beat u up" and the level fails instantly, even if satisfaction isn't empty.

- **Matching:** after every word is added to the bar, the assembled message and each death phrase are compared lowercased with all spaces (and `. , ! ? '`) removed, as a substring match. So "be at u up" matches "beat u up". On a match, the message sends immediately. A death phrase beats every other end condition that happens on the same word.
- **Fairness:** every death phrase must require at least one bad word, so a correct answer can never trigger one (misplaced good words count as good words). On level load the game checks this and logs a `console.warn` if a phrase could be built from good words alone, would match a correct answer, or is unreachable even with the bad words.
- **Telegraph:** if the bar is one word away from completing a death phrase, the reply bar flashes red and the crush switches to a suspicious face (`char_crush_suspicious.png`), so the player can see it coming and dodge.
- **Fail screen:** show the sent message, then reveal what it reads as with a highlight (e.g. "be at u up" → **BEAT U UP**) and a slow zoom, then the crush's special reply. The reveal is the comedic payoff.
- **Content rules:** each level has exactly one death phrase. Design the phrase first, then adjust that level's good and bad words so it is actually reachable. Keep phrases silly, never threatening or crude.

## Branching endings

Most levels offer **multiple valid sentences** (chill / flirty / unhinged). Which one the player completes picks the crush's reply and affects the final ending. The game keeps a simple score object (`chill`, `flirty`, `unhinged` counts, one per level passed).

After the last level the ending scene is chosen from those counts by the `endings` rules in `story.json` (first matching rule wins):

| Ending | Rule | Scene |
|---|---|---|
| funny-bad: he slips one last time | `unhinged` ≥ 3 | `ending_bad` |
| good: she agrees to walk to class with him | `flirty` ≥ 3 | `ending_good` |
| neutral: they stay friends | anything else | `ending_neutral` |

Levels must offer enough of each tone for every ending to be reachable (flirty answers exist in levels 2–5, unhinged in all five).

## Title & end screens

- **Title screen:** an **animated title** (the letters skid in from the left, then bob, and every few seconds the logo "slips" sideways and recovers), a **START button** (click, or Space/Enter), and **three ending icons** under the label "ENDINGS n / 3". An icon is a dark "?" silhouette until that ending has been cleared; then it lights up (glow, sparkles) and shows the ending's name. A small "reset progress" link (two clicks to confirm) erases the cleared endings.
- **End screen** (after any ending scene): an **animated ending title** (the letters drop in and bounce), the name of the ending reached and the tone counts, the same three icons, and a **BACK TO START button** (click, Space/Enter or Esc). If this run cleared the ending for the first time, its icon **lights up with a burst** and "NEW ENDING UNLOCKED!" blinks.
- **Game over screen** (only reachable when a failed level has no `afterFail` scene): animated "GAME OVER" with RETRY (same level) and START SCREEN buttons.
- **Cleared endings are remembered** between visits in the browser's `localStorage` (key `sdm_endings_v1`). If storage is blocked they last for the session only. A run reaching an ending through the `ending` target records it; the `end` target without endings does not.
- Logos and icons are **placeholders until the art exists**: a missing logo draws an animated text version with its filename underneath; a missing icon draws a coloured circle (lit) or a dark "?" (locked). When the real PNGs arrive, the same animations are applied to them. A logo may also be a spritesheet declared in `data/sprites.json` (see Spritesheet convention), in which case its frames animate too. The locked version of a real icon is the same image darkened by code, so only **one icon image per ending** is needed.
- Layout numbers live in `SCREEN_CONFIG` (`screens.js`).

## Juice & sound

- **Typing indicator:** each level opens with the crush's "typing..." bubble (bouncing dots, ~1.1s), then her message pops in, then the bullet phase starts. Space/click skips the wait. The result screen shows the same dots before her reply. Numbers: `GAME_CONFIG.intro`, `CONFIG.replyDelay`.
- **Hit flash:** touching a bad word flashes the screen red and jolts it (an out-of-order word flashes orange and jolts less). `GAME_CONFIG.fx`. This is on top of the anxiety shake, which is always on at high anxiety.
- **Chip pop:** words pop (grow then settle) when they land in the reply bar.
- **Send whoosh:** when the message sends, a bright band sweeps across the reply bar with a whoosh before the result screen (`CONFIG.send`).
- **Screen transitions:** every screen change slides the new screen in from the right while the old one slides out (`CONFIG.transition`). It's a game about slides.
- **Sound effects** are synthesized in code (`audio.js`), so the game has sound with no files: `click`, `tick` (story typewriter), `type` (typing dots), `pop`, `collect` (pitch climbs as the sentence builds), `wrong`, `hit`, `warn` (death phrase telegraph), `whoosh`, `win`, `fail`, `boom` (death phrase slam), `thud` / `boing` / `swish` (story shake / bounce / slideIn), `buzz` (a notification arrives), `swipe` (a notification is dismissed). To use a real recording, put the file in `assets/sfx/` and map the effect name to it in `data/sfx.json`, e.g. `{ "hit": "hit.wav" }`; effects without an entry keep the synthesized sound. Browsers only allow audio after a key press or click, so sound starts after the first input. **M** toggles mute (remembered).

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
  anxiety.js     # anxiety meter (difficulty) + its effects
  satisfaction.js # crush satisfaction meter (health) + crush face
  deathphrase.js # death phrase matching, telegraph check, level validation
  notifications.js # group chat sabotage: notification banners, dismissing, anxiety
  screens.js     # title + end/game over screens, buttons, animated logos, ending icons, cleared-endings save
  assets.js      # asset loading with placeholder fallback
  audio.js       # sound effects (synthesized with WebAudio, optional real files)
data/
  levels.json    # ALL level content lives here
  story.json     # ALL story/dialogue content lives here
  sfx.json       # optional: swap a synthesized sound for a real file in assets/sfx/
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
| `player_heart.png` | Player sprite in bullet phase (a little sweating heart, not a slide) | 24×24 |
| `char_player_idle.png`, `char_player_sweat.png`, `char_player_panic.png`, `char_player_happy.png` | Finn's avatar, a **fish slipper** (reactions switch by anxiety/result) | 96×96 |
| `char_crush_neutral.png`, `char_crush_amused.png`, `char_crush_unimpressed.png`, `char_crush_suspicious.png` | Clover's avatar, a **bunny slipper** with long ears (`suspicious` = death phrase telegraph) | 96×96 (192×192 file at 2×) |
| `bubble_crush.png`, `bubble_player.png` | Chat bubbles (9-slice if possible) | stretchable |
| `chip_good.png`, `chip_bad.png` | Word bullet backgrounds (text drawn on top in code) | stretchable |
| `fx_sweat_vignette.png` | High-anxiety overlay | full screen |
| `title_logo.png` | Title screen logo ("Slide Into DMs"). Animated by code (slide-in, bob, slip); may also be a spritesheet listed in `data/sprites.json` | ~380×190 (760×380 export) |
| `ending_title.png` | End screen title ("The End"). Animated by code (drops in and bounces); may also be a spritesheet | ~380×150 (760×300 export) |
| `icon_ending_good.png`, `icon_ending_neutral.png`, `icon_ending_bad.png` | One icon per ending (name = `icon_ending_<id>.png`, the `id` from `story.json` `endings`). Drawn full-colour and glowing once cleared; the code darkens the same image into a silhouette while locked | 64×64 (128×128 export) |
| `notif_banner.png` | Group chat notification banner background. Stretchable; **keep the centre plain**, the sender and message text are drawn in code on top | 360×80 (720×160 export) |
| `notif_avatar_<sender>.png` (optional), e.g. `notif_avatar_zig.png`, `notif_avatar_junhao.png`, `notif_avatar_aisyah.png`, `notif_avatar_canvas.png`, `notif_avatar_shopee.png`, `notif_avatar_grab.png` | Sender avatar on a banner. `<sender>` is the sender name lowercased with spaces removed. Missing ones show a labeled placeholder | 40×40 (80×80 export) |
| `screen_title.png`, `screen_gameover.png`, `screen_ending.png` | Menus | full screen |
| `bg_bedroom.png`, `bg_classroom.png`, `bg_corridor.png` | Story scene backgrounds: Finn's bedroom, the classroom, and the freshly mopped school corridor where the crash happens | full screen (900×1600 export) |
| `story_player_<expression>_sheet.png` | Finn's story sprite (fish slipper), e.g. `story_player_nervous_sheet.png` | ~200×300 per frame |
| `story_crush_<expression>_sheet.png` | Clover's story sprite (bunny slipper) | ~200×300 per frame |
| `story_friend_<expression>_sheet.png` | Zig's story sprite (striped slippers, the hype-man best friend) | ~200×300 per frame |
| `bubble_speech.png` | Story speech bubble (9-slice if possible) | stretchable |

### Spritesheet convention

- One animation per file, frames in a **single horizontal row**, every frame the **same size**.
- Frame size and count are declared in `data/sprites.json`, e.g. `{ "story_player_nervous_sheet.png": { "frameWidth": 400, "frameHeight": 600, "frames": 4, "fps": 6, "loop": true } }`. Claude adds entries here; the artist updates the numbers if they change.
- A single non-sheet PNG must also work (treated as 1 frame).
- If a sheet is missing, show a labeled placeholder that still "animates" (e.g. bobs) so timing can be tested.
- Edits show up on a **normal reload**: `data/*.json` is re-checked on every load, and on `localhost` images get a cache-busting query so re-exported PNGs aren't served from the browser cache. (Before this, a stale `sprites.json` made a fixed sheet keep showing all frames side by side.) If a sheet still looks wrong, check that `frameWidth × frames` equals the image width and `frameHeight` equals its height.

If an asset is added that isn't in this table, add it to the table.

Story sprite sheets the current `story.json` uses (each needs an entry in `data/sprites.json`): `story_player_nervous_sheet.png`, `story_player_panic_sheet.png`, `story_player_happy_sheet.png`, `story_player_slip_sheet.png` (Finn mid-slip, used in the crash), `story_friend_hype_sheet.png`, `story_friend_unsure_sheet.png`, `story_crush_neutral_sheet.png`, `story_crush_amused_sheet.png`, `story_crush_surprised_sheet.png`.

## Level data format (`data/levels.json`)

All content is data. Adding a level must never require code changes.

```json
{
  "levels": [
    {
      "id": "apology",
      "afterWin": "scene:after_apology",
      "afterFail": "scene:fail_apology",
      "crushMessage": "wait... are you the slipper who flattened me in the corridor?",
      "answers": [
        { "words": ["yes", "that", "was", "me", "apologies"], "tone": "chill", "reply": "it's ok! my ears are still ringing tho 🐰" },
        { "words": ["the", "floor", "started", "it"], "tone": "unhinged", "reply": "...the floor. sure. ok." }
      ],
      "badWords": ["sorry", "lol", "u up?", "my bad", "k", "ow"],
      "patterns": ["rain"],
      "bulletSpeed": 1.0,
      "timeLimit": 25,
      "failReplies": ["seen 9:41pm", "...who is this", "ok. i'm pretending that was a typo"],
      "deathPhrases": [
        { "phrase": "that was meow", "reply": "...did you just meow at me?? i'm a BUNNY 😭" }
      ]
    }
  ]
}
```

- `answers`: one or more valid sentences. Whichever the player starts collecting first becomes the target (the first word of each answer is spawned as a good word at the start).
- `patterns`: names from `patterns.js`, cycled through during the level.
- `deathPhrases` (optional, exactly one per shipped level): `phrase` is what the bar reads as when it triggers, `reply` is the crush's special reaction. Each must need at least one bad word (e.g. "i'll beg" = good "i'll", good "be", bad "g"). See "Death phrases".
- `failReplies`: generic fail reactions (satisfaction empty, timeout).
- Group chat sabotage (all optional; a level with none of them has no notifications):
  - `notificationsEnabled`: `true` / `false`. Set `false` to switch them off even if a list is present (level 1 does this).
  - `notificationRate`: banners **per minute** (e.g. `8` is one every ~7.5s on average, with some randomness). The first banner waits `NOTIF_CONFIG.firstDelay` seconds into the bullet phase.
  - `notifications`: the messages for this level, picked in a shuffled order, e.g. `[{ "sender": "Zig", "text": "DID U TEXT HER YET" }, { "sender": "Shopee", "text": "9.9 Sale! Slippers 50% off" }]`. Sender names also pick the avatar file (`notif_avatar_zig.png`).
  - On load the game warns if a level has notifications enabled but no messages or no rate.
- Difficulty ramps through the level data (`bulletSpeed`, `timeLimit`, more `badWords`), not code.

## Story data format (`data/story.json`)

All dialogue is data. Rewriting the story must never require code changes.

```json
{
  "speakers": { "player": "Finn", "friend": "Zig", "crush": "Clover" },
  "scenes": {
    "intro": {
      "background": "bg_corridor.png",
      "lines": [
        { "text": "8:58am, corridor B. Finn the fish slipper is almost late. the floor is freshly mopped." },
        { "speaker": "player", "sprite": "story_player_panic_sheet.png", "position": "left", "text": "late late late late—", "effect": "bounce" },
        { "speaker": "player", "sprite": "story_player_slip_sheet.png", "position": "left", "text": "WHOOOOA—", "effect": "shake" }
      ],
      "next": "scene:intro_home"
    }
  },
  "endings": [
    { "scene": "ending_bad", "when": { "unhinged": 3 } },
    { "scene": "ending_good", "when": { "flirty": 3 } },
    { "scene": "ending_neutral" }
  ]
}
```

- `next` (and a level's `afterWin` / `afterFail`) is a target: `level:<id>`, `scene:<id>`, `retry` (replay the level that was just played), `ending` (pick an ending scene from the tone counts, see `endings` below), `end` (win screen) or `title`. If `afterWin` / `afterFail` is missing, a won level goes to the next level (or `end` after the last) and a failed level goes to the game over screen. A target scene that doesn't exist is skipped, so the game never dead-ends.
- `speakers` (top-level, optional) maps a line's `speaker` id to the name shown on the name tag, e.g. `{ "player": "You", "friend": "Jo", "crush": "Sam" }`. Lines with no `sprite` are narration (no highlighted character). `position` is `left`, `center` or `right`; a character stays on screen until another sprite takes their position.
- `endings` (top-level, optional) is a list of `{ "scene", "when", "id", "name", "slot" }` rules checked in order when a target is `ending`; the first rule whose `when` holds wins. `id` (default: the scene id) names the icon file and the save entry, `name` is shown under the icon and on the end screen, and `slot` is the icon's position on the title screen (left to right; default: list order, which matters for matching, so set `slot` to display them differently). `when` maps tones to minimum counts (`{ "flirty": 3 }`); a rule with no `when` always matches (use it last as the default). Without `endings` the game goes straight to the win screen.
- A scene has **one background**. To change location mid-story, chain scenes with `next` (the intro does this: corridor, then Finn's bedroom).
- On load the game warns in the console about unknown targets, bad positions/effects and empty scenes. `data/story.json` is optional: without it, scenes are skipped.
- `effect` (optional): `shake`, `bounce`, `slideIn`, `fadeIn`.
- Typewriter text; click/Space finishes the line instantly, a second press advances. Add a small "skip scene" button.
- The group chat is introduced in a short beat before level 2 (`group_chat`): his friends find out he's texting her and his phone starts blowing up, with a hint that notifications can be swiped away (click, or Q).
- Keep the whole story short: **intro (~6–10 lines), 1–3 lines between levels, ending (~5 lines)**. The bullet hell is the main game.

## Bullet patterns (keep to 3–4)

1. `rain` — bad words fall from the top at random x.
2. `aimed` — bad words are shot from the left, right and top edges toward where the player was when the shot spawned (never from the bottom).
3. `spiral` — bad words spray out in a sweeping fan from the top-left corner of the play area (right under the crush's avatar).
4. `wall` — a horizontal line of bad words falls with one gap (at least ~120px wide) to slip through. Wall chips use full-size hitboxes and sit side by side so the wall is solid and every word stays readable.

A level's `patterns` list **takes turns**: one pattern is active at a time and the next one takes over every `PATTERN_CONFIG.cycleTime` seconds (default 6), wrapping around. Bullets already in flight keep going when the pattern changes. Speeds are base values; the level's `bulletSpeed` and the anxiety multiplier scale them. All pattern numbers live in `PATTERN_CONFIG` (`patterns.js`). On load the game warns about pattern names that don't exist.

Make one pattern feel good before adding the next.

## Build order (do these in sequence, test each before moving on)

1. Scaffold: index.html, phone-shaped canvas, scaling, state machine (title → level → result → game over), placeholder asset loader.
2. Player movement in the play area (with Shift focus mode), plus a single `rain` pattern.
3. Good words, the reply bar, collision rules (correct / wrong order / bad word), and message assembly.
4. Timer, auto-send, crush reply (success vs garbled fail), level loading from `levels.json`.
5. Satisfaction meter (health, crush face), anxiety meter and its effects (speed, shake, vignette, protagonist face), and death phrases (match, telegraph, reveal).
6. Story system: `story.json` loading, background, sprites with the spritesheet helper, speech bubbles, typewriter, advance/skip, effects. Wire scenes into the game flow with `next` / `afterWin` / `afterFail`.
7. Remaining patterns (`aimed`, `spiral`, `wall`). (Branching answers/tones and the tone-based ending pick are already in.)
8. Juice: typing indicator, hit flash, send whoosh, screen shake, sound effects, transitions between story and gameplay.
9. Title screen, game over + retry, ending screen (done: see "Title & end screens"). Prepare the itch.io zip.

**Extra mechanic (added after step 8):** group chat sabotage (notification banners), described above.

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

Comedic and cringe, but affectionate. Slide/slipper puns are welcome (slip, sole, traction, heels, "slide into DMs"), and Finn's clumsiness is the running joke, never his worth as a person. Fail messages should be funny, never mean. Keep everything school-appropriate.
