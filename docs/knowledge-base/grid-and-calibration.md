# Grid, calibration, and units

The grid overlays a scene image or video. It can be a square grid, pointy-top hex grid, or flat-top hex grid.

## Align a grid

1. Enable **Show grid**.
2. Choose the grid type that matches your map.
3. Set **Grid size** until the cell spacing fits the source map.
4. Correct the alignment with the X and Y offset fields. Use reset to return the origin to zero.
5. Optionally show coordinate labels and choose how often they appear.

Grid size is measured in source-scene pixels, not browser pixels. This means the overlay stays attached to the map when the view is panned or zoomed. Adjusting the line opacity can help it sit over an already-printed map grid without overpowering the artwork.

## Describe distance

In **Grid units**, choose how many units one cell represents and provide singular/plural names. The default is 5 feet. Distance labels on measurements and effects use these values, so you can use metres, squares, or any system-specific unit instead.

## Calibrate a physical table

Calibration is only needed when the player display is a physical table and one grid cell should equal one physical inch.

1. In **Table display calibration**, enter the display diagonal and aspect ratio.
2. Use **Show square on table**. A dashed one-inch square appears on the player display.
3. Measure that square with a ruler and enter the result in **Measured square**.
4. Enable **Lock to 1″ cells**.

When locked, the application chooses the map scale so a cell is physically one inch. Zoom controls are disabled because arbitrary zoom would break the physical scale. The lock becomes available only once the player display has reported usable dimensions and calibration information.

## Practical notes

Calibrate after changing display hardware or its resolution. If the table image looks shifted rather than incorrectly sized, adjust the alignment offsets instead of recalibrating. Grid settings are stored per prepared scene, making it safe to use different map scales across an adventure.
