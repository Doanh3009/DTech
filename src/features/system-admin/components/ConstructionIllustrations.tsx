import type { ReactNode } from "react";

export type ConstructionIllustrationKind =
  | "crane"
  | "helmet"
  | "rail"
  | "gear"
  | "beam"
  | "blueprint"
  | "building"
  | "hook"
  | "tape"
  | "wrench"
  | "vest";

export type ConstructionIllustration = {
  kind: ConstructionIllustrationKind;
  viewBox: string;
  drawing: ReactNode;
};

const beamProfilePaths = [
  "M20 88h70v12H60v60h30v12H20v-12h30v-60H20Z",
  "M150 18h70v12h-30v60h30v12h-70V90h30V30h-30Z",
  "m20 88 130-70M90 88l130-70M90 100l130-70M90 172l130-70M20 172l130-70",
  "m60 100 130-70M60 160l130-70M90 160l130-70M50 100l130-70M50 160l130-70",
] as const;

// Technical line drawings inherit stroke, width, and motion from their SVG wrapper.
export const constructionIllustrations: readonly ConstructionIllustration[] = [
  {
    kind: "crane",
    viewBox: "0 0 300 275",
    drawing: <>
      <g data-part="crane-frame">
        <path d="M89 252V78h30v174H89ZM89 78l30 35-30 35 30 35-30 35 30 34M119 78l-30 35 30 35-30 35 30 35-30 34M89 113h30m-30 35h30m-30 35h30m-30 35h30" />
        <path d="M26 61h252v17H26V61Zm0 17 14-17 14 17 14-17 14 17 14-17 14 17 14-17 14 17 14-17 14 17 14-17 14 17 14-17 14 17 14-17 14 17 14-17 14 17" />
        <path d="M94 61V18h21v43M94 18l21 43m0-43L94 61M26 61l78-40 174 40M104 21v-7h8v7M78 252l26 10 36-10M26 78v14h35V78M214 78v8h16v-8" />
      </g>
      <line data-part="crane-cable" x1="222" y1="86" x2="222" y2="170" />
      <g data-part="crane-hook">
        <path d="M215 162h14v18h-14zM217 180l5 8 5-8M222 188v6c0 5-6 6-7 11-1 5 3 9 8 9 6 0 10-4 10-9" />
      </g>
    </>,
  },
  {
    kind: "helmet",
    viewBox: "0 0 190 145",
    drawing: <>
      <path d="M31 98c0-37 21-65 53-68M104 30c31 4 52 32 54 68M80 92l4-62c5-4 15-4 20 0l5 62M87 32l-3 57m15-57 5 57" />
      <path d="M19 101c40-19 112-19 152 0-31 24-120 24-152 0Zm0 0v9c33 28 121 28 152 0v-9M31 98l-3 6m130-6 5 6" />
      <path d="M42 76h14v8H42zM133 76h14v8h-14zM58 46c-9 11-14 23-16 35M133 48c8 10 12 18 14 29" />
    </>,
  },
  {
    kind: "rail",
    viewBox: "0 0 220 260",
    drawing: <g transform="rotate(29 110 130)">
      <path d="M47 40h126v12H47zM47 82h126v12H47zM47 124h126v12H47zM47 166h126v12H47zM47 208h126v12H47z" />
      <path d="M73 19h8v222h-8zM139 19h8v222h-8zM69 19h16m50 0h16M69 241h16m50 0h16" />
      <path d="M67 42h6m8 0h6m46 0h6m8 0h6M67 84h6m8 0h6m46 0h6m8 0h6M67 126h6m8 0h6m46 0h6m8 0h6M67 168h6m8 0h6m46 0h6m8 0h6M67 210h6m8 0h6m46 0h6m8 0h6" />
      <path data-part="rail-sheen" data-stage="1" pathLength="1" d="M77 24v212" />
      <path data-part="rail-sheen" data-stage="2" pathLength="1" d="M143 24v212" />
    </g>,
  },
  {
    kind: "gear",
    viewBox: "0 0 160 160",
    drawing: <g data-part="gear-rotor">
      <path d="M80 30 87.83 20.51 95.53 22.04 99.13 33.81 105 36.7 116.53 32.4 122.43 37.57 119.67 49.56 123.3 55 135.43 57.04 137.96 64.47 129.57 73.47 130 80 139.49 87.83 137.96 95.53 126.19 99.13 123.3 105 127.6 116.53 122.43 122.43 110.44 119.67 105 123.3 102.96 135.43 95.53 137.96 86.53 129.57 80 130 72.17 139.49 64.47 137.96 60.87 126.19 55 123.3 43.47 127.6 37.57 122.43 40.33 110.44 36.7 105 24.57 102.96 22.04 95.53 30.43 86.53 30 80 20.51 72.17 22.04 64.47 33.81 60.87 36.7 55 32.4 43.47 37.57 37.57 49.56 40.33 55 36.7 57.04 24.57 64.47 22.04 73.47 30.43Z" />
      <circle cx="80" cy="80" r="25" />
      <circle cx="80" cy="80" r="34" opacity=".48" />
    </g>,
  },
  {
    kind: "beam",
    viewBox: "0 0 245 190",
    drawing: <>
      <g data-part="beam-outline" opacity=".3">{beamProfilePaths.map((d, index) => <path d={d} key={index} />)}</g>
      {beamProfilePaths.map((d, index) => <path data-part="beam-line" data-stage={index + 1} pathLength="1" d={d} key={index} />)}
    </>,
  },
  {
    kind: "blueprint",
    viewBox: "0 0 220 190",
    drawing: <>
      <path d="M36 31h159v132H36M36 31c0-6-6-11-13-11S10 25 10 31v121c0 7 6 12 13 12s13-5 13-12V31Zm-26 0c0 7 6 12 13 12s13-5 13-12" />
      <g data-part="blueprint-layer" data-stage="1">
        <path d="M57 53h116v89H57ZM64 60h102v75H64Z" />
      </g>
      <g data-part="blueprint-layer" data-stage="2">
        <path d="M64 91h45V60M109 91v44M109 101h57M87 91v44M109 78h57M109 111h9m14 0h34M87 111H64" />
        <path d="M118 111a14 14 0 0 1 14 14m-14-14v14M75 111a12 12 0 0 1 12 12m-12-12v12" />
      </g>
      <g data-part="blueprint-layer" data-stage="3">
        <path d="M55 47h119M57 43v8m116-8v8M49 51v93m-4-91h8m-8 89h8M55 150h119M57 146v8m116-8v8M64 154v4m23-4v4m22-4v4m57-4v4M182 53v89m-4-89h8m-8 89h8" />
      </g>
    </>,
  },
  {
    kind: "building",
    viewBox: "0 0 235 210",
    drawing: <>
      <g data-part="building-frame">
        <path d="M40 32v153m7-153v153M73 32v153m7-153v153M111 32v153m7-153v153M149 32v153m7-153v153M170 40v136m7-133v136M198 51v136m7-133v136M185 46v135" />
        <path d="M40 32V16m7 16V16M73 32V9m7 23V9M111 32V17m7 15V17M149 32V6m7 26V6M198 51V29m7 25V29M21 187h196m-178 9h159M29 187v-13m180 13v-13" />
      </g>
      <g data-part="building-floor" data-stage="1">
        <path d="M36 160h134l30 12v8l-30-12H36Zm134 0v8" />
      </g>
      <g data-part="building-floor" data-stage="2">
        <path d="M36 120h134l30 12v8l-30-12H36Zm134 0v8" />
      </g>
      <g data-part="building-floor" data-stage="3">
        <path d="M36 80h134l30 12v8l-30-12H36Zm134 0v8" />
      </g>
      <g data-part="building-floor" data-stage="4">
        <path d="M36 40h134l30 12v8l-30-12H36Zm134 0v8" />
      </g>
    </>,
  },
  {
    kind: "hook",
    viewBox: "0 0 160 245",
    drawing: <>
      <path d="M69 12v80M91 12v80" />
      <g data-part="industrial-hook">
        <path d="M69 74h22l19 22v26l-19 29H69l-19-29V96Z" />
        <path d="m58 87 16-13m-24 33 36-33m-36 49 51-39m-42 52 51-39m-29 54 29-22" />
        <path d="M75 151v14c0 12-14 16-15 30-1 13 7 26 22 26 16 0 27-11 27-26v-6c0-4-6-4-6 0v6c0 11-8 18-18 18-11 0-17-8-15-18 2-9 16-14 16-30v-14" />
      </g>
    </>,
  },
  {
    kind: "tape",
    viewBox: "0 0 180 175",
    drawing: <>
      <path d="M68 96V64c0-30 15-45 43-45 29 0 46 18 46 47v34l-45 17-44-21Zm9-9V64c0-24 11-36 34-36 22 0 37 15 37 38v25" />
      <path d="M98 65c0-17 8-25 22-25 15 0 22 10 22 27v13l-44 16V65ZM76 84l10 4v15m-18-7 44 21v-14l45-17" />
      <path d="m68 96-49 34 17 10 50-36m-67 26v14l17 10v-14m0 14v-7M32 126l8 5m3-13 8 5m3-13 8 5m3-13 8 5" />
    </>,
  },
  {
    kind: "wrench",
    viewBox: "0 0 165 175",
    drawing: <>
      <path d="M99 55c-8-12-3-30 11-35l-2 22 18 12 19-11c-1 18-14 31-31 30l-48 66c-7 10-21 14-31 8-13-8-15-25-5-35l69-57Z" />
      <circle cx="47" cy="130" r="11" />
      <path d="m58 117 43-55m-37 61 43-55" />
    </>,
  },
  {
    kind: "vest",
    viewBox: "0 0 190 190",
    drawing: <g data-part="vest-lines">
      <path d="M43 24 70 16c1 23 8 46 25 62 17-16 24-39 25-62l27 8c-2 33 3 52 17 65l-6 73c-22 8-42 10-63 3-21 7-41 5-63-3l-6-73c14-13 19-32 17-65Z" />
      <path d="M70 16c11 9 39 9 50 0M95 78v87M54 21c1 28-4 46-8 68m90-68c-1 28 4 46 8 68M43 24c2 31-2 52-17 65m121-65c-2 31 2 52 17 65" />
      <path d="M28 101c21 1 43 4 67 11 24-7 46-10 67-11M29 114c23 1 44 5 66 11 22-6 43-10 66-11M30 139c22 1 43 5 65 11 22-6 43-10 65-11M31 152c22 1 43 5 64 11 21-6 42-10 64-11" />
      <path d="m57 92 20 4m36 0 20-4M51 33l-6 43m94-43 6 43" />
    </g>,
  },
];
