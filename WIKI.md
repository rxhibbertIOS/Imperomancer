# Imperomancer knowledge base

## Table of contents

- [Quick start](#quick-start)
- [Scenes and media](#scenes-and-media)
- [Grids and calibration](#grids-and-calibration)
- [Effects and measurement](#effects-and-measurement)
- [Player display and sync](#player-display-and-sync)
- [Troubleshooting](#troubleshooting)

## Quick start

Open the DM view, prepare a scene, then use **Go Live** to open the player display. Publish a prepared scene when it is ready for the table. The player display receives public scenes, initiative, dice, status messages, focus pings, grids, and public permanent effects.

## Scenes and media

Scenes keep their own map, view, and grid settings. Images are limited to 25 MB; videos are limited to 50 MB. Prefer compressed, short video loops: media is currently held in memory while it is previewed and shared with the player display.

## Grids and calibration

Choose Square, Pointy Hex, or Flat Hex, align the grid to the art, set units, then lock it when using a physical table. Locked effects snap to the centre of actual square or hex cells. Use table calibration to make a displayed cell physically one inch.

## Effects and measurement

Open the palette with a secondary click, a 0.5-second long press, or `Alt+E` at the view centre. Circle and square effects grow from the selected cell centre. A cone is defined in two steps: choose its length/direction, then choose base width.

Set colour, opacity, label, table visibility, and permanence in **Grid → Effect defaults & layers**. Permanent effects are stored with their scene; public ones sync to the table, while private ones remain DM-only. Select an existing permanent effect on the map or in the layer list to update or delete it.

Use **Measure only** (blue ruler) to answer a range question locally. It never appears on the player display. Use **Line** to draw a visible temporary line on the table.

## Player display and sync

The player display requests the latest state when it opens. State revisions prevent a delayed packet replacing newer state. If a display disconnects, use **Go Live** again; popup blockers may need permission for the player window.

## Troubleshooting

- **Grid does not line up:** adjust cell size and X/Y origin, then lock after calibration.
- **Effect does not appear on the table:** ensure it is marked visible on the table and the scene is published/live.
- **Video will not load:** check the format, file size, and browser autoplay permissions; videos are muted for reliable autoplay.
- **Slow map changes:** reduce media size or resolution; Data URL media has a memory overhead.
