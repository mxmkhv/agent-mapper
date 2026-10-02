/** Eleven space-separated rows of `#` and `.`. One horizontal run of filled pixels per path segment, so every edge lands on the 11px grid. */
function fromBitmap(bitmap: string): string {
  return bitmap
    .split(" ")
    .flatMap((row, y) =>
      [...row.matchAll(/#+/g)].map(
        (run) => `M${run.index} ${y}h${run[0].length}v1h-${run[0].length}z`
      )
    )
    .join("");
}

/** Icons are drawn on the same 11px grid as the pixel face, so they sit beside it without blurring. */
const icons = {
  doc: "M1 0h6v1h-6zM1 1h1v1h-1zM6 1h2v1h-2zM1 2h1v1h-1zM6 2h1v1h-1zM8 2h1v1h-1zM1 3h1v1h-1zM6 3h4v1h-4zM1 4h1v1h-1zM9 4h1v1h-1zM1 5h1v1h-1zM3 5h5v1h-5zM9 5h1v1h-1zM1 6h1v1h-1zM9 6h1v1h-1zM1 7h1v1h-1zM3 7h5v1h-5zM9 7h1v1h-1zM1 8h1v1h-1zM9 8h1v1h-1zM1 9h1v1h-1zM9 9h1v1h-1zM1 10h9v1h-9z",
  bolt: "M6 0h2v1h-2zM5 1h2v1h-2zM4 2h2v1h-2zM3 3h2v1h-2zM2 4h7v1h-7zM5 5h2v1h-2zM4 6h2v1h-2zM3 7h2v1h-2zM2 8h2v1h-2zM2 9h1v1h-1z",
  bot: "M5 0h1v1h-1zM5 1h1v1h-1zM1 2h9v1h-9zM1 3h1v1h-1zM9 3h1v1h-1zM1 4h1v1h-1zM3 4h2v1h-2zM6 4h2v1h-2zM9 4h1v1h-1zM1 5h1v1h-1zM3 5h2v1h-2zM6 5h2v1h-2zM9 5h1v1h-1zM1 6h1v1h-1zM9 6h1v1h-1zM1 7h1v1h-1zM4 7h3v1h-3zM9 7h1v1h-1zM1 8h1v1h-1zM9 8h1v1h-1zM1 9h9v1h-9z",
  hook: "M3 0h3v1h-3zM2 1h1v1h-1zM6 1h1v1h-1zM2 2h1v1h-1zM6 2h1v1h-1zM3 3h3v1h-3zM4 4h1v1h-1zM4 5h1v1h-1zM1 6h1v1h-1zM4 6h1v1h-1zM1 7h1v1h-1zM4 7h1v1h-1zM1 8h1v1h-1zM4 8h1v1h-1zM2 9h2v1h-2z",
  server:
    "M1 1h9v1h-9zM1 2h1v1h-1zM9 2h1v1h-1zM1 3h1v1h-1zM3 3h1v1h-1zM9 3h1v1h-1zM1 4h9v1h-9zM1 6h9v1h-9zM1 7h1v1h-1zM9 7h1v1h-1zM1 8h1v1h-1zM3 8h1v1h-1zM9 8h1v1h-1zM1 9h9v1h-9z",
  globe:
    "M3 1h5v1h-5zM2 2h1v1h-1zM5 2h1v1h-1zM8 2h1v1h-1zM1 3h1v1h-1zM5 3h1v1h-1zM9 3h1v1h-1zM1 4h1v1h-1zM5 4h1v1h-1zM9 4h1v1h-1zM1 5h9v1h-9zM1 6h1v1h-1zM5 6h1v1h-1zM9 6h1v1h-1zM1 7h1v1h-1zM5 7h1v1h-1zM9 7h1v1h-1zM2 8h1v1h-1zM5 8h1v1h-1zM8 8h1v1h-1zM3 9h5v1h-5z",
  folder:
    "M1 1h4v1h-4zM1 2h1v1h-1zM5 2h1v1h-1zM1 3h9v1h-9zM1 4h1v1h-1zM9 4h1v1h-1zM1 5h1v1h-1zM9 5h1v1h-1zM1 6h1v1h-1zM9 6h1v1h-1zM1 7h1v1h-1zM9 7h1v1h-1zM1 8h9v1h-9z",
  plus: "M5 1h1v1h-1zM5 2h1v1h-1zM5 3h1v1h-1zM5 4h1v1h-1zM1 5h9v1h-9zM5 6h1v1h-1zM5 7h1v1h-1zM5 8h1v1h-1zM5 9h1v1h-1z",
  search:
    "M2 0h4v1h-4zM1 1h1v1h-1zM6 1h1v1h-1zM0 2h1v1h-1zM7 2h1v1h-1zM0 3h1v1h-1zM7 3h1v1h-1zM0 4h1v1h-1zM7 4h1v1h-1zM0 5h1v1h-1zM7 5h1v1h-1zM1 6h1v1h-1zM6 6h1v1h-1zM2 7h5v1h-5zM7 8h2v1h-2zM8 9h2v1h-2zM9 10h2v1h-2z",
  rescan:
    "M3 1h5v1h-5zM2 2h1v1h-1zM8 2h1v1h-1zM10 2h1v1h-1zM1 3h1v1h-1zM9 3h2v1h-2zM1 4h1v1h-1zM8 4h3v1h-3zM0 6h3v1h-3zM9 6h1v1h-1zM0 7h2v1h-2zM9 7h1v1h-1zM0 8h1v1h-1zM2 8h1v1h-1zM8 8h1v1h-1zM3 9h5v1h-5z",
  history:
    "M3 1h5v1h-5zM2 2h1v1h-1zM8 2h1v1h-1zM1 3h1v1h-1zM5 3h1v1h-1zM9 3h1v1h-1zM1 4h1v1h-1zM5 4h1v1h-1zM9 4h1v1h-1zM1 5h1v1h-1zM5 5h3v1h-3zM9 5h1v1h-1zM1 6h1v1h-1zM9 6h1v1h-1zM1 7h1v1h-1zM9 7h1v1h-1zM2 8h1v1h-1zM8 8h1v1h-1zM3 9h5v1h-5z",
  edit: "M8 0h2v1h-2zM7 1h1v1h-1zM10 1h1v1h-1zM6 2h1v1h-1zM9 2h1v1h-1zM5 3h1v1h-1zM8 3h1v1h-1zM4 4h1v1h-1zM7 4h1v1h-1zM3 5h1v1h-1zM6 5h1v1h-1zM2 6h1v1h-1zM5 6h1v1h-1zM1 7h1v1h-1zM4 7h1v1h-1zM1 8h3v1h-3zM1 9h2v1h-2z",
  "arrow-right":
    "M6 2h1v1h-1zM7 3h1v1h-1zM8 4h1v1h-1zM1 5h9v1h-9zM8 6h1v1h-1zM7 7h1v1h-1zM6 8h1v1h-1z",
  info: "M1 1h9v1h-9zM1 2h1v1h-1zM9 2h1v1h-1zM1 3h1v1h-1zM5 3h1v1h-1zM9 3h1v1h-1zM1 4h1v1h-1zM9 4h1v1h-1zM1 5h1v1h-1zM4 5h2v1h-2zM9 5h1v1h-1zM1 6h1v1h-1zM5 6h1v1h-1zM9 6h1v1h-1zM1 7h1v1h-1zM4 7h3v1h-3zM9 7h1v1h-1zM1 8h1v1h-1zM9 8h1v1h-1zM1 9h9v1h-9z",
  "arrow-left": fromBitmap(
    "........... ........... ....#...... ...#....... ..#........ .#########. ..#........ ...#....... ....#...... ........... ..........."
  ),
  terminal: fromBitmap(
    "........... ########### #.........# #.#.......# #..#......# #.#.......# #.....###.# #.........# #.........# ########### ..........."
  ),
  database: fromBitmap(
    "..#######.. .#.......#. .#########. .#.......#. .#.......#. .#########. .#.......#. .#.......#. ..#######.. ........... ..........."
  ),
  plug: fromBitmap(
    "...#...#... ...#...#... ...#...#... .#########. .#.......#. .#.......#. ..#.....#.. ...#####... .....#..... .....#..... .....#....."
  ),
  branch: fromBitmap(
    "..#.....#.. .#.#...#.#. ..#.....#.. ..#.....#.. ..#....#... ..#...#.... ..####..... ..#........ ..#........ .#.#....... ..#........"
  ),
  "chevron-right": fromBitmap(
    "........... ...#....... ....#...... .....#..... ......#.... .......#... ......#.... .....#..... ....#...... ...#....... ..........."
  ),
  "chevron-down": fromBitmap(
    "........... ........... ........... .#.......#. ..#.....#.. ...#...#... ....#.#.... .....#..... ........... ........... ..........."
  ),
  alert: fromBitmap(
    ".....#..... ....#.#.... ....#.#.... ...#.#.#... ...#.#.#... ..#..#..#.. ..#..#..#.. .#.......#. .#...#...#. ########### ..........."
  ),
  trash: fromBitmap(
    "....###.... .#########. ........... ..#######.. ..#.#.#.#.. ..#.#.#.#.. ..#.#.#.#.. ..#.#.#.#.. ..#.#.#.#.. ..#######.. ..........."
  ),
  link: fromBitmap(
    "........... ........... ........... .####.####. #....#....# #..#####..# #....#....# .####.####. ........... ........... ..........."
  ),
  layers: fromBitmap(
    ".....#..... ...##.##... .##.....##. ...##.##... .##..#..##. ...##.##... .##..#..##. ...##.##... .....#..... ........... ..........."
  ),
  sun: fromBitmap(
    ".....#..... .#...#...#. ..#.....#.. ....###.... ...#####... ##.#####.## ...#####... ....###.... ..#.....#.. .#...#...#. .....#....."
  ),
  moon: fromBitmap(
    "........... ....####... ...###..... ..###...... ..###...... ..###...... ..###...... ..####...#. ...######.. ....####... ..........."
  ),
  "theme-auto": fromBitmap(
    "........... ...#####... ..###...#.. .####....#. .####....#. .####....#. .####....#. .####....#. ..###...#.. ...#####... ..........."
  ),
  "folder-open": fromBitmap(
    "........... .####...... .#..#...... .#..######. .#.......#. .#.######## .##.......# .##......#. .########.. ........... ..........."
  ),
  diff: fromBitmap(
    "........... .....#..... .....#..... ..#######.. .....#..... .....#..... ........... ..#######.. ........... ........... ..........."
  ),
  copy: fromBitmap(
    "........... ...#######. ...#.....#. .#######.#. .#.....#.#. .#.....#.#. .#.....#.#. .#.....###. .#.....#... .#######... ..........."
  ),
  close: fromBitmap(
    "........... .#.......#. ..#.....#.. ...#...#... ....#.#.... .....#..... ....#.#.... ...#...#... ..#.....#.. .#.......#. ..........."
  ),
  "arrow-up": fromBitmap(
    "........... .....#..... ....###.... ...#.#.#... ..#..#..#.. .....#..... .....#..... .....#..... .....#..... .....#..... ..........."
  ),
  "arrow-down": fromBitmap(
    "........... .....#..... .....#..... .....#..... .....#..... .....#..... ..#..#..#.. ...#.#.#... ....###.... .....#..... ..........."
  ),
  "find-case": fromBitmap(
    "........... ........... ..#........ .#.#....... .#.#..###.. #...#....#. #####.####. #...#.#..#. #...#.####. ........... ..........."
  ),
  "find-word": fromBitmap(
    "........... ......#.... ......#.... .###..###.. ....#.#..#. .####.#..#. .#..#.#..#. .####.###.. ........... #.........# ###########"
  ),
  "find-regex": fromBitmap(
    "........... ......#.... ...#..#..#. ....#.#.#.. .....###... ....#.#.#.. ...#..#..#. ......#.... .##........ .##........ ..........."
  ),
  "find-replace": fromBitmap(
    "........... ......#.... .......#... .########.. .......#... ......#.... ........... .####...... .#..#...... .####...... ..........."
  ),
  "find-replace-all": fromBitmap(
    "........... ......#.... .......#... .########.. .......#... ......#.... ........... .####.####. .#..#.#..#. .####.####. ..........."
  )
} as const;

export type PixelIconName = keyof typeof icons;

/** 11px by default; `large` doubles it to 22px. No size in between keeps the pixels square. */
export function PixelIcon({
  name,
  large,
  className = ""
}: {
  name: PixelIconName;
  large?: boolean;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={`block shrink-0 fill-current ${large ? "size-[22px]" : "size-[11px]"} ${className}`}
      shapeRendering="crispEdges"
      viewBox="0 0 11 11"
    >
      <path d={icons[name]} />
    </svg>
  );
}
