# Whiteboard

The whiteboard is a table-wide annotation layer. It is ideal for quick sketches, arrows, plans, and rules explanations that should sit above the current scene.

## Draw on the table

1. Open **Whiteboard** and select **Show whiteboard**.
2. Choose a tool: Pencil, Line, Rectangle, Ellipse, or Eraser.
3. Choose a color and stroke size.
4. Draw on the map preview. The same mark appears on the table display.

Pencil records a freehand path. Line, Rectangle, and Ellipse use the point where you press as their starting point and the point where you release as their end point. Eraser removes by painting over existing marks.

## Clear and hide

**Clear whiteboard** permanently removes all current strokes. **Hide whiteboard** turns off the layer but does not erase its strokes, so you can temporarily remove annotations and show them again later.

## How it scales

Whiteboard coordinates are normalized to the displayed canvas rather than stored as bitmap pixels. A drawing therefore scales cleanly between the DM preview and the player/table display, even when their resolutions differ. Whiteboard content is session-wide rather than part of a prepared scene; clear or hide it when transitioning to a new encounter if it is no longer relevant.
