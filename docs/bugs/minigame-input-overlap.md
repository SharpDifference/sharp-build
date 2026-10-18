# Mini-game input overlaps scene dialogue

## Reproduction

Start a scene with an NPC, leave the normal action field open, then start a mini-game.
The scene action field can remain underneath the table chat field on the first turn.
Long chat drafts also rise into the native dialogue box. Games requesting typed answers
need their field visible throughout, so hiding every mini-game input is not a valid fix.

## Fix

The running table temporarily owns scene input. The native action row is hidden, inert
and disabled, and releases its caret. Its draft is retained and restored on table exit.
This includes solo tables without a chat field. Outside a table the scene behaves as before.

Optional table chat uses the native hover divider, stays open while focused, and closes
after sending. Required typed games and requested answers remain visible. A disabled
typed field between requests retains a readable height and status placeholder. A newly
requested answer mounts an enabled editor. The native dialogue box follows the measured
height and visibility of the table input, including multiline drafts.

No game rules, scene closing, narrator calls, agreement checks or stat rewards change.
Prior browser checks covered native SceneChrome ownership, focus/draft restoration,
multiline chat at 720p/1080p/2048×1218 and Truth or Dare answer submission using mock replies.
These checks do not require the Darts pack to be installed.
