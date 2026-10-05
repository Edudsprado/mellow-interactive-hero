param(
  [Parameter(Mandatory = $true)][string]$Clip,
  [string]$FFmpeg = 'ffmpeg',
  [string]$FramesDirectory = (Join-Path $PSScriptRoot 'frames')
)
$ErrorActionPreference = 'Stop'
$assetsDirectory = Join-Path $PSScriptRoot 'dist\assets'
New-Item -ItemType Directory -Force -Path $FramesDirectory,$assetsDirectory | Out-Null
& $FFmpeg -hide_banner -y -i $Clip -map 0:v:0 -fps_mode passthrough (Join-Path $FramesDirectory 'frame-%04d.png')
if ($LASTEXITCODE -ne 0) { throw 'Frame extraction failed.' }
$frameCount = @(Get-ChildItem -LiteralPath $FramesDirectory -Filter 'frame-*.png').Count
if ($frameCount -ne 240) { throw "Expected 240 frames for this supplied clip; got $frameCount. Update animation.js and sprite.json for another clip." }
$filter = '[0:v]scale=640:360:flags=lanczos,split[a][b];[a]palettegen=stats_mode=full[p];[b][p]paletteuse=dither=bayer:bayer_scale=4,tile=240x1:nb_frames=240[out]'
& $FFmpeg -hide_banner -framerate 24 -i (Join-Path $FramesDirectory 'frame-%04d.png') -filter_complex $filter -map '[out]' -frames:v 1 -y (Join-Path $assetsDirectory 'character-sprite.png')
if ($LASTEXITCODE -ne 0) { throw 'Sprite assembly failed.' }
& $FFmpeg -hide_banner -i (Join-Path $FramesDirectory 'frame-0088.png') -q:v 2 -frames:v 1 -y (Join-Path $assetsDirectory 'idle.jpg')
if ($LASTEXITCODE -ne 0) { throw 'Poster extraction failed.' }
Write-Output "Extracted all $frameCount frames and assembled one horizontal sprite sheet."
