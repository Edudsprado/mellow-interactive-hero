# Mellow — interactive hero

Open `dist/index.html`, or serve `dist` with any static web server. The hero uses plain HTML, CSS, and vanilla JavaScript. It has no package dependencies or external asset requests.

## Assets

The supplied file contains 240 video frames at 24 fps (10 seconds), despite the brief describing a four-second clip. FFmpeg extracted every frame without frame dropping. The horizontal PNG sheet contains all 240 frames in source order, each scaled proportionally from 1280 × 720 to 640 × 360. It measures 153600 × 360 pixels. An adaptive 256-color palette keeps the download around 14 MB. The idle poster comes from frame 87, counting from zero.

`dist/assets/sprite.json` records the dimensions and pose landmarks. The display preserves the source's proportions and centers its character at the source focal point, 63.2% across the image. The responsive viewport crops only the surrounding scenery; it does not move or distort the character independently.

## Interaction

`animation.js` projects cursor coordinates onto a calibrated path of the clip's actual left/right and up/down poses. Repeated poses favor nearby frames, avoiding unnecessary travel through the clip. Exponential damping smooths frame indices independent of refresh rate, and the canvas crossfades neighboring cells for fractional-frame interpolation. Pointer exit eases back to the idle frame over 580 ms. New input interrupts that return immediately.

Touch movement, keyboard arrow keys, Escape to reset, a motion toggle, reduced-motion preferences, and a still-poster fallback are included. Rendering stops when settled, offscreen, or in a hidden tab. The large sheet decodes once; each paint copies only the two current frame cells. The decoded full-color image can use roughly 211 MiB of memory; a smaller sheet can be substituted by updating the frame dimensions in the configuration. Very old browsers with low maximum image dimensions will retain the still portrait.

## Rebuild the sprite

Run `extract-frames.ps1` with the original clip and an installed FFmpeg executable:

```powershell
./extract-frames.ps1 -Clip 'path/to/original.mp4' -FFmpeg 'path/to/ffmpeg.exe'
```

The source frames are generated into `frames/`. This script is specific to the supplied 240-frame clip. Original extracted frames from this build are also included in the separate `extracted-frames.zip` deliverable.
