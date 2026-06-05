/**
 * Reactive landscape illustration (SPEC §8). Inline SVG, lightweight, updates
 * live as inputs change. It is a TRUST/CLARITY device only — it does NOT feed
 * the price (the engine does). The house is fixed (it's their property).
 *
 *  - lastCutIndex (0..4) → grass height & density (neat → overgrown jungle)
 *  - obstructions (0..1) → how many trees/shrubs appear (none → many)
 *  - terrain     (0..1) → ground morphs flat → rolling hills
 */
import type { VNode } from "preact";

const W = 320;
const H = 150;

interface Props {
  lastCutIndex: number;
  obstructions: number;
  terrain: number;
}

export function Landscape({ lastCutIndex, obstructions, terrain }: Props) {
  const amp = terrain * 16; // hill amplitude
  const baseY = 104;

  const groundYAt = (x: number) =>
    baseY - Math.sin((x / W) * Math.PI * 2.2) * amp - amp * 0.15;

  // Ground polygon path following the hill line.
  let path = `M0 ${groundYAt(0).toFixed(1)}`;
  for (let x = 8; x <= W; x += 8) path += ` L${x} ${groundYAt(x).toFixed(1)}`;
  path += ` L${W} ${H} L0 ${H} Z`;

  // Grass blades: height & density grow with neglect.
  const bladeH = 3 + lastCutIndex * 5.5; // 3 → 25px
  const step = 14 - lastCutIndex * 1.8; // denser when overgrown
  const overgrown = lastCutIndex >= 3;
  const blades: VNode[] = [];
  for (let x = 4; x < W; x += Math.max(5, step)) {
    const gy = groundYAt(x);
    const h = bladeH * (0.7 + ((x * 13) % 10) / 14); // slight variation
    const lean = overgrown ? ((x % 3) - 1) * 3 : ((x % 2) - 0.5) * 1.2;
    blades.push(
      <line
        x1={x}
        y1={gy}
        x2={x + lean}
        y2={gy - h}
        stroke={overgrown ? "#6f9a36" : "#5fb23f"}
        stroke-width={1.4}
        stroke-linecap="round"
      />,
    );
  }

  // Trees from obstructions (0 → ~7), placed away from the centered house.
  const treeCount = Math.round(obstructions * 7);
  const slots = [26, 52, 80, 240, 268, 296, 112];
  const trees: VNode[] = [];
  for (let i = 0; i < treeCount && i < slots.length; i++) {
    const x = slots[i];
    const gy = groundYAt(x);
    trees.push(<Tree x={x} groundY={gy} seed={i} />);
  }

  // House centered, sitting on the ground line.
  const hx = 160;
  const hGroundY = groundYAt(hx);

  return (
    <div class="lc-scene">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Illustration of your yard">
        <defs>
          <linearGradient id="lc-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#0c1410" />
            <stop offset="1" stop-color="#12211a" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width={W} height={H} fill="url(#lc-sky)" />
        <circle cx="44" cy="34" r="14" fill="#e9e26b" opacity="0.85" />

        {/* ground */}
        <path d={path} fill="#2f7d32" />
        <path d={path} fill="#000" opacity="0.06" />

        {/* grass */}
        <g>{blades}</g>

        {/* house (fixed) */}
        <g>
          <rect x={hx - 22} y={hGroundY - 30} width="44" height="30" fill="#caa06b" />
          <polygon
            points={`${hx - 28},${hGroundY - 30} ${hx},${hGroundY - 52} ${hx + 28},${hGroundY - 30}`}
            fill="#9c4d3c"
          />
          <rect x={hx - 6} y={hGroundY - 18} width="12" height="18" fill="#6b4a32" />
          <rect x={hx + 8} y={hGroundY - 24} width="9" height="9" fill="#8fd3ff" />
          <rect x={hx - 17} y={hGroundY - 24} width="9" height="9" fill="#8fd3ff" />
        </g>

        {/* trees */}
        <g>{trees}</g>
      </svg>
    </div>
  );
}

function Tree({ x, groundY, seed }: { x: number; groundY: number; seed: number }) {
  const h = 30 + (seed % 3) * 6;
  const w = 16 + (seed % 2) * 4;
  return (
    <g>
      <rect x={x - 2} y={groundY - 8} width="4" height="8" fill="#5b3f2a" />
      <polygon
        points={`${x},${groundY - h} ${x - w / 2},${groundY - 6} ${x + w / 2},${groundY - 6}`}
        fill="#3f8f3a"
      />
      <polygon
        points={`${x},${groundY - h + 10} ${x - w / 2 - 2},${groundY - 2} ${x + w / 2 + 2},${groundY - 2}`}
        fill="#347f31"
      />
    </g>
  );
}
