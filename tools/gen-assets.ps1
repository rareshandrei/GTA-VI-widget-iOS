# Regenerates every asset the widget needs: bg.jpg, digits/0-9.png and digits.json.
#
# Requires Jason_and_Lucia_Robbery_landscape.jpg and tools/ChakraPetch-Bold.ttf next to it.
# Run from anywhere:  pwsh -File tools\gen-assets.ps1
#
# Scriptable can only draw FILLED text and cannot load font files, so the outlined
# digits have to be baked into PNGs here and composited on the phone at runtime.

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$font = Join-Path $PSScriptRoot "ChakraPetch-Bold.ttf"
$src  = Join-Path $root "Jason_and_Lucia_Robbery_landscape.jpg"

# --- design constants: these must stay in sync with CONFIG in widget.js ---
$W = 1014; $H = 474        # medium widget @3x
$CROP_TOP   = 25           # trim mostly off the bottom so Jason's head survives
$NUM_HEIGHT = 180          # cap height of the digits
$STROKE     = 6            # outline weight
$DIGIT_EM   = 200          # nominal em size before scaling; arbitrary, cancels out

# ---------------------------------------------------------------- background
$img = [System.Drawing.Image]::FromFile($src)
$cropH = [int]($img.Width / ($W / $H))
$bg = New-Object System.Drawing.Bitmap $W, $H
$g = [System.Drawing.Graphics]::FromImage($bg)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.DrawImage($img, (New-Object System.Drawing.Rectangle 0,0,$W,$H),
             (New-Object System.Drawing.Rectangle 0,$CROP_TOP,$img.Width,$cropH),
             [System.Drawing.GraphicsUnit]::Pixel)
$g.Dispose(); $img.Dispose()

$enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
$ep = New-Object System.Drawing.Imaging.EncoderParameters 1
$ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 82
$bg.Save((Join-Path $root "bg.jpg"), $enc, $ep)
$bg.Dispose()
"bg.jpg          $W x $H"

# ---------------------------------------------------------------- digits
$pfc = New-Object System.Drawing.Text.PrivateFontCollection
$pfc.AddFontFile($font)
$fam = $pfc.Families[0]
$style = [System.Drawing.FontStyle]::Regular
foreach ($s in @([System.Drawing.FontStyle]::Bold, [System.Drawing.FontStyle]::Regular)) {
    if ($fam.IsStyleAvailable($s)) { $style = $s; break }
}
$fmt = [System.Drawing.StringFormat]::GenericTypographic

# One shared scale + baseline derived from all ten digits together, so every glyph
# lands on the same cap line no matter what its own bounding box happens to be.
$all = New-Object System.Drawing.Drawing2D.GraphicsPath
$all.AddString("0123456789", $fam, [int]$style, $DIGIT_EM, (New-Object System.Drawing.PointF 0,0), $fmt)
$common = $all.GetBounds()
$all.Dispose()
$scale = $NUM_HEIGHT / $common.Height

$measure = [System.Drawing.Graphics]::FromImage((New-Object System.Drawing.Bitmap 1,1))
$measure.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
$measureFont = New-Object System.Drawing.Font $fam, $DIGIT_EM, $style, ([System.Drawing.GraphicsUnit]::Pixel)

$digitsDir = Join-Path $root "digits"
New-Item -ItemType Directory -Force -Path $digitsDir | Out-Null

$canvasH = [int][math]::Ceiling($NUM_HEIGHT + $STROKE)
$advances = @{}; $widths = @{}

foreach ($d in 0..9) {
    $ch = "$d"
    $adv = $measure.MeasureString($ch, $measureFont, (New-Object System.Drawing.PointF 0,0), $fmt).Width * $scale
    $cw = [int][math]::Ceiling($adv + $STROKE)

    $bmp = New-Object System.Drawing.Bitmap $cw, $canvasH
    $dg = [System.Drawing.Graphics]::FromImage($bmp)
    $dg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

    $p = New-Object System.Drawing.Drawing2D.GraphicsPath
    $p.AddString($ch, $fam, [int]$style, $DIGIT_EM, (New-Object System.Drawing.PointF 0,0), $fmt)

    # Applied to a point in reverse call order: lift to the shared cap line, scale, then pad.
    $m = New-Object System.Drawing.Drawing2D.Matrix
    $m.Translate($STROKE / 2.0, $STROKE / 2.0)
    $m.Scale($scale, $scale)
    $m.Translate(0, -$common.Y)
    $p.Transform($m)

    $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White), $STROKE
    $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Miter
    $dg.DrawPath($pen, $p)
    $pen.Dispose(); $p.Dispose(); $dg.Dispose()

    $bmp.Save((Join-Path $digitsDir "$d.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()

    $advances["$d"] = [math]::Round($adv, 2)
    $widths["$d"] = $cw
}
$measure.Dispose(); $measureFont.Dispose(); $pfc.Dispose()

# Metrics the widget needs to lay the digits out identically to a single DrawPath call.
$meta = [ordered]@{
    canvasHeight = $canvasH
    capHeight    = $NUM_HEIGHT
    stroke       = $STROKE
    advance      = [ordered]@{}
    canvasWidth  = [ordered]@{}
}
foreach ($d in 0..9) { $meta.advance["$d"] = $advances["$d"]; $meta.canvasWidth["$d"] = $widths["$d"] }
$json = $meta | ConvertTo-Json -Depth 5
$json | Set-Content -Path (Join-Path $root "digits.json") -Encoding UTF8

# Same metrics as a plain script, because preview.html runs from file:// where fetch()
# of a local .json is blocked but a <script src> is not.
"window.DIGIT_METRICS = $json;" | Set-Content -Path (Join-Path $PSScriptRoot "digits-metrics.js") -Encoding UTF8

"digits/0-9.png  {0} x {1}, advances {2}" -f $widths["0"], $canvasH, (($advances.Keys | Sort-Object | ForEach-Object { $advances[$_] }) -join ", ")
"digits.json     written"
