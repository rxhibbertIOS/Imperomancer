# Grid effects

Turn on and lock a grid, then use a secondary click or a 0.5-second long press on a cell to open the effect palette. Keyboard users can press `Alt+E` to open it at the current view centre. Origins snap to the centre of square, pointy-hex, and flat-hex cells.

- **Line** measures from the origin to the endpoint.
- **Circle** is centred on the origin; drag its radius.
- **Square** is centred on the origin and always remains square.
- **Cone** is set in two stages: first set direction and length, then set the base width.

Set colour, label, opacity, permanence, and player-table visibility in **Grid → Effect defaults & layers** before drawing. Temporary effects clear automatically. Persistent effects are saved with their scene, remain fixed to map coordinates during pan/zoom, and appear in the layer list.

Use **Select on map** to choose an existing persistent effect; then update its properties or delete it from the layer controls. Private effects remain visible only to the DM; public effects sync to the table display.

## Scene media limits

To keep the DM and player displays responsive, scene images are limited to 25 MB and videos to 50 MB. Videos are currently loaded in memory for preview and table sync, so shorter, compressed clips provide the best experience.
