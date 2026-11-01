/**
 * The canvas every game's cover art is drawn on.
 *
 * A cover appears in two very different shapes — a 2:1 card, which crops the sides, and a
 * page-wide lobby banner nearer 5:1, which crops top and bottom (both use
 * `preserveAspectRatio="xMidYMid slice"`). So anything that matters has to sit inside the overlap
 * of the two: **x 120-520, y 34-166**. The canvas was 320x160 at first, which left the banner
 * cropped about three times into the middle of the picture.
 */
export const ART_W = 640;
export const ART_H = 200;
