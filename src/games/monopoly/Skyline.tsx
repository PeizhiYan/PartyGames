/**
 * A city silhouette for the middle of the ring.
 *
 * The ring's hole is about sixty percent of the board, and on a desktop it held nothing but the
 * board's name. These fill it with somewhere to be: landmarks anyone who has been there would
 * name, drawn flat in `currentColor` so they take the theme with them. Only the ring has a
 * middle, so none of this renders on a phone.
 *
 * Everything stands on y=200 in a 600x200 box. Keep to silhouettes — detail at this size is
 * noise, and the board behind it is what people are reading. Test a change by looking at it:
 * a pagoda whose roofs have no body between them is a Christmas tree.
 */

/** A hill, a far ridge, a headland: drawn fainter so the landmarks read in front of it. */
const Back = ({ d }: { d: string }) => <path d={d} className="sky-back" />;

/** The ground every silhouette stands on. */
const Ground = () => <path d="M0 194h600v6H0z" />;

/**
 * The battlements along the top of the Great Wall.
 *
 * Generated rather than drawn: the wall climbs a hill, so every merlon sits at a different
 * height, and thirty hand-written rectangles would be thirty chances to put one in mid-air.
 */
function Battlements({ top, from, to, step = 15 }: {
  top: [number, number][];
  from: number;
  to: number;
  step?: number;
}) {
  const yAt = (x: number) => {
    for (let i = 1; i < top.length; i += 1) {
      const [x0, y0] = top[i - 1];
      const [x1, y1] = top[i];
      if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
    return top[top.length - 1][1];
  };
  const merlons = [];
  for (let x = from; x < to; x += step) merlons.push(x);
  return (
    <>
      {merlons.map((x) => <rect key={x} x={x} y={yAt(x) - 11} width="8" height="12" />)}
    </>
  );
}

const WALL_TOP: [number, number][] = [[0, 176], [58, 138], [116, 172], [170, 150], [196, 158]];

const SKYLINES: Record<string, () => JSX.Element> = {
  /* Lions Gate, Canada Place, Harbour Centre, Science World, and the North Shore behind. */
  vancouver: () => (
    <>
      <Back d="M0 200v-58l80-74 66 64 60-48 92 86 84-66 96 84 60-46 62 52v6z" />
      {/* Lions Gate Bridge */}
      <path className="sky-line" d="M2 152h200M14 146q38-54 68-54t68 54" />
      <path d="M84 84h11v68H84zM126 84h11v68h-11zM84 84h11l-5.5-12zM126 84h11l-5.5-12z" />
      {/*
        Canada Place. Five sails of different heights, each steep on its mast side and falling
        away to the right — symmetrical points in a row read as fir trees, whatever you do to
        the curve, and that was two attempts at this.
      */}
      <path d="M202 150l7-58 31 58zM236 150l7-70 31 70zM270 150l7-54 31 54zM304 150l7-66 31 66zM338 150l6-48 28 48z" />
      <path className="sky-line" d="M209 150V94M243 150V82M277 150V98M311 150V86M344 150v-46" />
      <path d="M196 150h182v12H196z" />
      {/* Harbour Centre */}
      <path d="M382 94h15v106h-15zM389 58h2v38h-2z" />
      <ellipse cx="389.5" cy="94" rx="29" ry="10" />
      {/* Science World */}
      <path d="M432 200a46 46 0 0 1 92 0z" />
      <path className="sky-line" d="M440 180h76M454 164h48M478 156v40M456 160l22 38M500 160l-22 38" />
      <Ground />
    </>
  ),

  /* Liberty, the Brooklyn Bridge, Empire State, Chrysler and One World Trade. */
  newyork: () => (
    <>
      <Back d="M0 200v-38l40-10 36 14 50-20 44 16 52-26 48 20 56-16 50 22 48-18 56 20 40-12 80 18v30z" />
      {/* Statue of Liberty */}
      <path d="M28 200v-44l9-5 3-24h20l3 24 9 5v44z" />
      <path d="M50 127a8 8 0 1 1 0 16 8 8 0 0 1 0-16z" />
      <path d="M42 126l-5-9 6 4 2-7 3 7 2-8 2 8 3-7 2 7 6-4-5 9z" />
      <path d="M64 130l8-36 7 2-8 35zM70 90l8 2 3-12-6 3-2-7-3 8-4-2z" />
      <path d="M20 200v-16h60v16z" />
      {/* Brooklyn Bridge */}
      <path className="sky-line" d="M94 166h122M102 160q36-48 56-48t56 48" />
      <path d="M124 114h13v52h-13zM176 114h13v52h-13zM124 114h13l-6.5-13zM176 114h13l-6.5-13z" />
      {/* Midtown */}
      <path d="M224 200v-52h26v52zM254 200v-70h22v70z" />
      {/* Empire State */}
      <path d="M284 200V96h36v104zM292 96V64h20v32zM299 64V42h6v22zM300 42h4l-2-20z" />
      <path d="M326 200v-58h24v58z" />
      {/* Chrysler */}
      <path d="M358 200V84h28v116zM359 84l13-26h4l13 26zM371 58V38h4v20zM371 38h4l-2-16z" />
      <path d="M392 200v-44h22v44z" />
      {/* One World Trade */}
      <path d="M424 200l7-150h22l7 150zM438 50h5V18h-5z" />
      <path d="M466 200v-64h26v64zM496 200v-48h22v48zM522 200v-78h24v78zM550 200v-54h30v54z" />
      <Ground />
    </>
  ),

  /* Fuji, a torii, a pagoda, Tokyo Tower and the Skytree. */
  japan: () => (
    <>
      <Back d="M74 200L212 62l26-14 22 14 20-10 22 16L442 200z" />
      {/* Torii */}
      <path d="M34 200v-92h13v92zM87 200v-92h13v92z" />
      <path d="M20 96q50-11 100 0v11q-50-11-100 0z" />
      <path d="M28 120h84v10H28z" />
      <path d="M62 96h14v38H62z" />
      {/* Pagoda: five roofs, each with a body under it, or it is a fir tree */}
      <path d="M134 92h56l-9 11h-38zM140 103h44v11h-44z" />
      <path d="M128 116h68l-10 11h-48zM138 127h48v11h-48z" />
      <path d="M122 140h80l-11 11h-58zM136 151h52v11h-52z" />
      <path d="M116 164h92l-12 11h-68zM134 175h56v25h-56z" />
      <path d="M159 72h6v20h-6zM160 58h4l-2-13z" />
      {/* Tokyo Tower */}
      <path d="M422 200l34-156h6l34 156h-19l-18-86-18 86z" />
      <path d="M436 142h44v11h-44zM445 102h26v9h-26z" />
      <path d="M457 44h4V18h-4z" />
      {/* Skytree */}
      <path d="M522 200l11-124h6l11 124zM529 82h16l-5-32h-6z" />
      <ellipse cx="537" cy="92" rx="18" ry="8" />
      <ellipse cx="537" cy="54" rx="12" ry="6" />
      <path d="M536 52h3V12h-3z" />
      <Ground />
    </>
  ),

  /* The Great Wall, the Temple of Heaven, the Oriental Pearl, CCTV and Shanghai Tower. */
  china: () => (
    <>
      <Back d="M0 200v-60l74-48 64 42 60-28 74 36 68-32 76 36 66-28 72 34 46-20v68z" />
      {/* Great Wall, climbing the hill, with two watchtowers */}
      <path d={`M0 200v-24L58 138l58 34 54-22 26 8v42z`} />
      <Battlements top={WALL_TOP} from={4} to={196} />
      <path d="M28 150h30v38H28zM22 144h42v8H22zM110 148h32v40h-32zM104 142h44v8h-44z" />
      {/* Temple of Heaven */}
      {/* Shallow roofs on a round body. A tall cone on a tall cone is a fir tree. */}
      <path d="M206 86l26-20 26 20zM214 86h36v12h-36z" />
      <path d="M194 118l38-20 38 20zM204 118h56v12h-56z" />
      <path d="M182 154l50-24 50 24zM196 154h72v36h-72z" />
      <path d="M230 52h4V66h-4zM231 52h2l-1-9z" />
      <path d="M176 190h112v10H176z" />
      {/* Oriental Pearl */}
      <path d="M322 200l14-56h5l-9 56zM360 200l-14-56h-5l9 56zM337 200l3-70h4l3 70z" />
      <circle cx="341" cy="124" r="23" />
      <circle cx="341" cy="68" r="13" />
      <path d="M340 58h3V20h-3z" />
      {/* CCTV */}
      <path d="M380 200v-80h24v80zM436 200v-80h24v80zM380 120V94h80v26zM436 94V54h24v66h-24z" />
      {/* Shanghai Tower */}
      <path d="M494 200c4-42 14-80 22-108h18c8 28 18 66 22 108z" />
      <path d="M562 200v-62h26v62z" />
      <Ground />
    </>
  ),
};

/** The silhouette for a board, or nothing for a board that has none yet. */
export default function Skyline({ id }: { id: string }) {
  const draw = SKYLINES[id];
  if (!draw) return null;
  return (
    <svg className="sky" viewBox="0 0 600 200" preserveAspectRatio="xMidYMax meet" aria-hidden>
      {draw()}
    </svg>
  );
}
