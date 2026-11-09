# Rex native monochrome badge rendering

Static inspection of the official Rex 1.1 (24) macOS ARM64 executable. The application was never executed. Findings apply directly to this inspected executable; no iOS runtime result is claimed.

- Executable: `Rex.app/Contents/MacOS/Rex`
- Size: 68,622,320 bytes
- SHA-256: `94f6e651ed800d5ccc3a292e5b670fef55594d7222bccf8e1a374a8af55a5789`

## What triggers the native adaptation

The image detector at virtual address `0x102581420` is reached through `RexBadgeCore.ResourceBadgeImageTone`. Its caller at `0x102582904` converts tone return values 0 (black) and 1 (white) to true; values 2/3 become false. This is a whole-image decision.

The detector does the following:

1. Rasterizes into a DeviceRGB bitmap with width `min(originalWidth, 128)` and height `min(originalHeight, 128)`. Uses 8 bits per component, four bytes per pixel, `CGBitmapInfo` value `0x4001` (32-bit big-endian order with premultiplied last alpha) and interpolation quality value 3 (high).
2. Ignores pixels with alpha below 8. All other pixels count toward the visible denominator, including colored and middle-gray pixels.
3. Unpremultiplies each channel using integer arithmetic: `min(255, (premultipliedChannel * 255 + floor(alpha / 2)) / alpha)`, with integer division.
4. A pixel is near-neutral only if `max(R,G,B) - min(R,G,B) < 9`.
5. A neutral pixel is black when `max(R,G,B) <= 20`, or white when `min(R,G,B) >= 235`.
6. The image is classified as black if black pixels / visible pixels is at least 0.98. Otherwise it is white if white pixels / visible pixels is at least 0.98. Otherwise it is neither. A mix of black and white does not combine to qualify: either side must independently reach 98%.

Relevant addresses: dimensions `0x102581438`–`0x10258145c`; bitmap `0x1025814a0`–`0x1025814e0`; alpha test `0x102581538`–`0x102581540`; channel recovery `0x102581550`–`0x1025815a4`; color thresholds `0x1025815c4`–`0x102581600`; 0.98 ratio comparisons `0x102581648`–`0x102581684`. The IEEE-754 threshold bits are `0x3fef5c28f5c28f5c`, exactly the stored double approximation to 0.98.

## How the image gets its theme color

The network badge loading path at `0x100e5ec1c` obtains a `CGImage` and calls the asynchronous image tone lookup at `0x1025819dc`. Its completion callback at `0x100e5f4b0` stores the resulting Boolean into `MacResourceBadgeView.imageIsMonochrome` and calls the view appearance update at `0x100e5dc08`.

That appearance update checks both the badge's `adaptsMonochromeImage` and the view's monochrome result. When enabled for a detected monochrome image, it calls:

- `NSImage.setTemplate:` at `0x100e5dd74`, through selector stub `0x1033b3300`.
- `NSColor.labelColor` at `0x100e5ddc8`, through selector stub `0x1033ac700`.
- `NSImageView.setContentTintColor:` at `0x100e5dde8`, through selector stub `0x1033b0900`.

`labelColor` is the native semantic label color. The image is tinted as a complete template using its alpha mask. Filter `textColor` is processed separately later through `setTextColor:`; it is not the adaptive image tint source. No special URL prefix or extra subscription field is needed for this detected path.

The app exposes a user preference named `adaptiveResourceBadgeIconColors`, with the Chinese label “黑白图标自适应” and detail “逐张检测，纯黑或纯白图标会自动适配深浅模式；彩色图标保持原样。” This aligns with the renderer and detector rather than merely suggesting a possible mechanism.

## Consequences for our PNG assets

- Pure white RGB with preserved transparency is compatible with the detector. The native renderer supplies the current semantic color.
- Our light-mode RGB `#16181C` has channels 22, 24, 28. It is outside the black threshold, so it should not be used as the monochrome native source.
- The reference's middle grays `#979797`/`#989898` are outside both thresholds in this inspected app version. That does not establish what occurred in the user's particular app/version or invalidate their observation.
- A colored logo with white lettering remains a single colored image unless at least 98% of all visible sampled pixels qualify as white. The native feature cannot recolor only its white letters while retaining other colors.
- Approximate Python rasterization can check likely classification of assets, but cannot exactly reproduce CoreGraphics high-quality resampling and color conversion. Such a check is static asset validation, not an app runtime test.
