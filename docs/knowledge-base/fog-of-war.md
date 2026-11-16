# Fog of war

Fog of war covers a scene on the player display while allowing the DM to reveal or restore areas directly on the map. It is scene-specific, so a prepared dungeon can retain its exploration state.

## Reveal an area

1. Enable **Fog of war**. This begins with the entire scene covered.
2. Select **Reveal**, choose a round or square brush, and set its size in cells.
3. Select **Edit fog on map** if editing is not already active.
4. Drag over the DM map. The corresponding areas are cut out on the table display.
5. Choose **Done editing fog** before returning to ordinary map interaction.

Brush size follows the current grid cell size, so a two-cell brush remains meaningful even if you later align the grid more precisely.

## Restore and reset

Use **Repaint** to cover areas again. This is useful after the party leaves a location or if a reveal was made too generously. Repainted fog keeps the same translucent appearance in the DM view as the surrounding fog, while it remains fully opaque on the Player display. **Remove all** removes every fog stroke and leaves the whole map visible. **Reapply fog** discards the current reveal/paint history and returns the scene to fully covered fog.

Choose a fog color that works with the map and room lighting. The effect is synchronized as you work; players see the fog state, not the editing controls or brush cursor.

## Operating advice

Fog is best used after you have finished the grid alignment. It is recorded in scene coordinates, so it stays aligned during panning and view changes. To prepare a hidden map in advance, edit the selected scene while another scene is published, then publish only when ready.
