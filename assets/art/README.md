# Art checklist

**8 of 43 images are done. 35 still show placeholders.**
(Checked against commit `d4bdd04`, 2026-10-24.)

The game runs fine without any of them. A missing image is drawn as a coloured box or circle with its
filename on it, so you can see exactly which file will replace it. Drop a PNG with the **exact filename**
into this folder and reload the page (a normal reload is enough; no hard refresh needed on a local server).

## Rules of thumb
- **Exact filenames**, PNG, transparent background where it makes sense.
- **Export at 2× the display size** (the sizes below are already the 2× export sizes).
- Everything is drawn by code scaled to its slot, so the aspect ratio matters more than exact pixels. Full-screen images must be **9:16** (900×1600).
- **Spritesheets** are one horizontal row of equal frames. Frame size and count live in `data/sprites.json`. If you change a sheet's size, update its entry (`frameWidth × frames` must equal the image width, `frameHeight` the image height).

## Done ✅

| File | Size | What it is |
|---|---|---|
| `bg_bedroom.png` | 900×1600 | Finn's bedroom background (8 story scenes) |
| `bg_corridor.png` | 900×1600 | Corridor background (5 scenes: the intro crash, two teasing scenes, 2 endings) |
| `char_crush_neutral.png` | 192×192 | Clover's avatar, neutral face |
| `char_player_idle.png` | 192×192 | Finn's avatar, idle face |
| `story_player_nervous_sheet.png` | 400×150 (4 frames of 100×150) | Finn, nervous (6 scenes) |
| `story_player_slip_sheet.png` | 400×150 (4 frames of 100×150) | Finn mid-slip (intro crash, bad ending) |
| `story_crush_neutral_sheet.png` | 400×150 (4 frames of 100×150) | Clover, neutral (intro, neutral ending) |
| `story_friend_hype_sheet.png` | 400×150 (4 frames of 100×150) | Zig, hyped (9 scenes) |
| `player_heart.png` | 48×48 | The little heart you steer during the bullet phase. Its hitbox is a tiny dot in the middle, so a simple readable shape works best. |
| `screen_title.png` | 900×1600 | Title screen background (the logo, START button and ending icons are drawn on top). |
| `screen_ending.png` | 900×1600 | End screen background. |
| `char_player_idle.png` | 192×192 | Finn's default avatar and the avatar shown after a pass. |
| `notif_avatar_zig.png` | 80×80 | Sender avatar: Zig (levels 2–5). |
| `notif_avatar_birkeny.png` | 80×80 | Sender avatar: Birkeny (levels 2–5). |
| `notif_avatar_kroks.png` | 80×80 | Sender avatar: Kroks (levels 2–5). |
| `notif_avatar_kanbos.png` | 80×80 | Sender avatar: Kanbos (levels 2–5). |
| `notif_avatar_shupee.png` | 80×80 | Sender avatar: Shupee (levels 2, 3, 5). |
| `notif_avatar_glab.png` | 80×80 | Sender avatar: Glab (level 4). |
| `bg_classroom.png` | 900×1600 | Classroom background (after small talk, neutral ending). |
| `icon_ending_good.png` | 128×128 | Ending icon "Walk to class". One image: code darkens it while locked and lights it up when cleared. |
| `icon_ending_neutral.png` | 128×128 | Ending icon "Just friends". |
| `icon_ending_bad.png` | 128×128 | Ending icon "One last slip". |


Note on the story sheets: each frame is 100×150 and is shown at 200×300, so it is scaled up 2×. That works, but
it will look softer than the rest. For crisper sprites, export frames at **400×600** (a 1600×600 sheet) and set
`frameWidth` 400 / `frameHeight` 600 in `data/sprites.json`.

## Still placeholders

### 1. Seen in every playthrough (gameplay screen)
| File | Export size (px) | What it is |
|---|---|---|
| `chip_good.png` | about 120×56, stretches | Background of a correct word (green in the placeholder). The word is drawn on top by code; the whole image is stretched to fit the word, so avoid fine detail near the edges. |
| `chip_bad.png` | about 120×56, stretches | Background of a bad word (red in the placeholder). Same stretching as above. |
| `bubble_crush.png` | about 626×140, stretches | Clover's chat bubble (her message at the top). Stretched to the message size, so keep the corners simple. |
| `bubble_player.png` | about 626×300, stretches | Finn's reply bubble holding the collected words. Same note. |
| `char_crush_amused.png` | 192×192 | Clover's avatar after a clean message (and the happy replies). |
| `char_crush_unimpressed.png` | 192×192 | Clover's avatar when satisfaction drops and after a fail. |
| `char_player_panic.png` | 192×192 | Finn's avatar when anxiety is elevated and on the fail result screen. |
| `fx_sweat_vignette.png` | 900×1600 | Full-screen overlay that fades in as anxiety rises (transparent in the middle, sweaty/dark at the edges). |

### 2. Story scenes
| File | Export size (px) | What it is |
|---|---|---|
| `story_player_slip_sheet.png` | same as the other sheets | Finn slipping/panicking. Used in 9 scenes (intro, home, group chat, all 5 fail scenes, after courage). |
| `story_friend_unsure_sheet.png` | same | Zig, unsure. Used in the group chat beat and 4 fail scenes. |
| `story_crush_amused_sheet.png` | same | Clover, amused; used after small talk, in all 3 endings, and for surprised reactions in the crash and bad ending. |
| `story_player_happy_sheet.png` | same | Finn, happy. Used after courage and in the good and bad endings. |
| `bubble_speech.png` | about 820×340, stretches | Speech bubble for every story line (a rounded box; the name tag is drawn separately). |

### 3. Title, ending and menu screens
| File | Export size (px) | What it is |
|---|---|---|
| `title_logo.png` | 760×380 | Animated game logo. Static image or a spritesheet listed in `data/sprites.json`; code adds the slide-in, bob and slip. |
| `ending_title.png` | 760×300 | "The End" title; code drops it in with a bounce. |
| `screen_gameover.png` | 900×1600 | Game over background. Currently never shown (every failed level has a fail scene), so it is the lowest priority. |

### 4. Group chat notifications (levels 2–5)
The avatar names come from the sender names in `data/levels.json`: lowercase, spaces removed, as `notif_avatar_<sender>.png`.
Avatars are optional extras; the banner itself is the more visible one.
| File | Export size (px) | What it is |
|---|---|---|
| `notif_banner.png` | 720×160 | Notification banner background (levels 2–5). Stretchable; keep the centre plain, the sender and message are drawn on top. |
## How to re-check this list
Open the game and the browser console (F12). Every missing image prints one line like
`[assets] missing assets/art/chip_good.png, using placeholder`. When you add a file its line disappears.
If a sheet animates wrongly, see the spritesheet rule above.

Full details (sizes, usage, naming) are in the "Asset list" section of `CLAUDE.md`.
