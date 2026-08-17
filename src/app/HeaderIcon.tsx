// Retro pixel-art bikini figure, built on a strict pixel grid (rect
// elements, no curves) per design.md. Blonde hair, simple eyes/mouth (no
// sunglasses), bikini in green with straps and a tapered bottom so it
// reads clearly as swimwear rather than a plain waist gap. `mirror` flips
// it so the raised arm always points inward toward the title.
export default function HeaderIcon({ mirror = false }: { mirror?: boolean }) {
  return (
    <svg className="header-icon" viewBox="0 0 38 40" xmlns="http://www.w3.org/2000/svg" shapeRendering="crispEdges" aria-hidden="true">
      <g transform={mirror ? "translate(38,0) scale(-1,1)" : undefined}>
        <g fill="#F5E6A8">
          <rect x="16" y="0" width="6" height="1" />
          <rect x="13" y="1" width="12" height="2" />
          <rect x="11" y="3" width="16" height="3" />
          <rect x="10" y="6" width="18" height="4" />
        </g>
        <g fill="#F2B705">
          <rect x="16" y="3" width="6" height="3" />
          <rect x="15" y="6" width="8" height="3" />
          <rect x="16" y="9" width="6" height="2" />
        </g>
        <g fill="#8A5A0A">
          <rect x="16" y="7" width="2" height="1" />
          <rect x="20" y="7" width="2" height="1" />
          <rect x="17" y="9" width="4" height="1" />
        </g>
        <g fill="#F2B705">
          <rect x="17" y="11" width="4" height="2" />
          <rect x="12" y="13" width="14" height="1" />
          <rect x="14" y="14" width="10" height="2" />
          <rect x="15" y="16" width="8" height="2" />
          <rect x="26" y="13" width="4" height="2" />
          <rect x="28" y="10" width="4" height="3" />
          <rect x="27" y="7" width="4" height="3" />
          <rect x="8" y="13" width="4" height="3" />
          <rect x="9" y="16" width="4" height="2" />
        </g>
        <g fill="#39FF6A">
          <rect x="15" y="15" width="1" height="3" />
          <rect x="22" y="15" width="1" height="3" />
          <rect x="15" y="18" width="8" height="3" />
        </g>
        <rect x="11" y="23" width="16" height="5" fill="#F2B705" />
        <g fill="#39FF6A">
          <rect x="14" y="23" width="10" height="1" />
          <rect x="15" y="24" width="8" height="1" />
          <rect x="16" y="25" width="6" height="1" />
        </g>
        <g fill="#F2B705">
          <rect x="14" y="28" width="10" height="2" />
          <rect x="14" y="30" width="4" height="3" />
          <rect x="20" y="30" width="4" height="3" />
          <rect x="15" y="33" width="3" height="3" />
          <rect x="20" y="33" width="3" height="3" />
          <rect x="15" y="36" width="2" height="1" />
          <rect x="21" y="36" width="2" height="1" />
          <rect x="14" y="37" width="4" height="2" />
          <rect x="20" y="37" width="4" height="2" />
        </g>
      </g>
    </svg>
  );
}
