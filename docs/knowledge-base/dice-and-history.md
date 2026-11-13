# Dice and roll history

Dice supports both visible table rolls and private DM rolls using standard dice notation.

## Make a roll

1. Choose **Public roll** to show the result on the player display, or switch it off for a private DM roll.
2. Enter notation such as `1d20`, `2d6+3`, or `4d6-1`.
3. Optionally add a message, such as “Fireball damage.”
4. Select **Roll**. The quick buttons provide Initiative, Perception, and Damage starting rolls.

The notation builder is available from the notation field and supports more advanced rules, including keep/drop, exploding dice, rerolls, criticals, and target numbers. The result view shows totals, individual dice, dropped dice, successes/failures, and calculation audit information when the selected notation produces it.

## Public and private behavior

Public rolls are executed and animated on the player display, then their result returns to the DM. Keep the player display connected for this mode. Private rolls resolve silently on the DM screen. Both kinds are recorded in Roll History, but only public rolls are presented to players.

If a public result does not return, the controls unlock after a short timeout; reconnect the table display and roll again if needed.

## Roll history

Open **Roll History** in the Dice card to review recent rolls. Filter by public, private, critical, or failed results. History is retained in the browser on the DM device and keeps the most recent 50 entries. Clearing it removes that local history only; it does not alter any player-facing result already shown.
