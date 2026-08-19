/**
 * CAD-style construction line-art used as a background layer on cards and
 * sections. Four drawings, picked to match what the host card is about:
 *
 *   gate       — entrance archway, gate leaves and a security grid
 *   villa      — Kerala modern villa elevation with a courtyard plan
 *   commercial — multi-tier floorplate on a structural column grid
 *   planning   — drafting compass, scale rule and golden-ratio curves
 *   retrofit   — existing frame with jacketing, plates and new bracing
 *   tower      — high-rise elevation, used as a broad section backdrop
 *
 * Strokes are set in CSS (`.sketch__*`) so the host controls colour, weight
 * and hover behaviour. Always decorative.
 */
export type SketchVariant = 'gate' | 'villa' | 'commercial' | 'planning' | 'retrofit' | 'tower';

const GRID = (
  <g className="sketch__grid">
    {Array.from({ length: 21 }).map((_, i) => (
      <path key={`v${i}`} d={`M${i * 30} 0V400`} />
    ))}
    {Array.from({ length: 14 }).map((_, i) => (
      <path key={`h${i}`} d={`M0 ${i * 30}H600`} />
    ))}
  </g>
);

const ART: Record<SketchVariant, JSX.Element> = {
  /* Entrance: piers, arched span, twin leaves, intercom post, security mesh. */
  gate: (
    <>
      <g className="sketch__line">
        <path d="M96 340V150h56v190M448 340V150h56v190" />
        <path d="M96 150q152-86 304 0" />
        <path d="M124 122q126-70 252 0" />
        <path d="M152 340V196h144v144M304 340V196h144v144" />
        <path d="M60 340h480" />
        <path d="M300 196v144" />
      </g>
      <g className="sketch__hatch">
        <path d="M164 208v120M188 208v120M212 208v120M236 208v120M260 208v120M284 208v120" />
        <path d="M316 208v120M340 208v120M364 208v120M388 208v120M412 208v120M436 208v120" />
      </g>
      <g className="sketch__dim">
        <path d="M96 366h408M96 358v16M504 358v16" />
        <path d="M540 150v190M532 150h16M532 340h16" />
      </g>
    </>
  ),

  /* 01 — Kerala modern villa: low-pitch roofs, deep eaves, courtyard plan. */
  villa: (
    <>
      <g className="sketch__line">
        <path d="M80 300V196l110-64 110 64v104" />
        <path d="M56 196h268M92 132h196" />
        <path d="M80 300h220" />
        <path d="M118 300v-70h56v70M212 232h52v46h-52z" />
        <path d="M300 300V228l64-36 64 36v72M280 228h168" />
      </g>
      <g className="sketch__hatch">
        <path d="M330 340h180v96H330z" />
        <path d="M366 340v96M438 340v96M330 376h180M330 406h180" />
        <path d="M366 376h72v30h-72z" />
        <path d="M118 246h56M118 262h56M118 278h56" />
      </g>
      <g className="sketch__dim">
        <path d="M56 326h268M56 318v16M324 318v16" />
        <path d="M310 456h220M310 448v16M530 448v16" />
      </g>
    </>
  ),

  /* 02 — multi-tier commercial floorplate with a structural column grid. */
  commercial: (
    <>
      <g className="sketch__line">
        <path d="M70 70h360v250H70z" />
        <path d="M70 195h180M250 70v250" />
        <path d="M250 195h180M340 195v125" />
        <path d="M110 340h280v40H110z" />
      </g>
      <g className="sketch__hatch">
        <path d="M130 118h20v20h-20zM220 118h20v20h-20zM130 252h20v20h-20zM220 252h20v20h-20z" />
        <path d="M310 118h20v20h-20zM400 118h20v20h-20zM310 252h20v20h-20zM400 252h20v20h-20z" />
        <path d="M140 70v250M320 70v250M70 128h360M70 262h360" />
        <path d="M470 100h60v220h-60z" />
        <path d="M470 145h60M470 190h60M470 235h60M470 280h60" />
      </g>
      <g className="sketch__dim">
        <path d="M70 350h180M70 342v16M250 342v16" />
        <path d="M46 70v250M38 70h16M38 320h16" />
      </g>
    </>
  ),

  /* 03 — drafting compass, scale rule and a golden-ratio spiral. */
  planning: (
    <>
      <g className="sketch__line">
        <path d="M300 60 220 300M300 60l80 240" />
        <path d="M300 60a14 14 0 1 1 0 28 14 14 0 0 1 0-28z" />
        <path d="M244 228h112" />
        <path d="M60 340h420v40H60z" />
      </g>
      <g className="sketch__hatch">
        <path d="M90 340v22M120 340v14M150 340v22M180 340v14M210 340v22M240 340v14" />
        <path d="M270 340v22M300 340v14M330 340v22M360 340v14M390 340v22M420 340v14M450 340v22" />
        <path d="M470 96h100v100H470zM470 196h62v62h-62zM532 196h38v38h-38z" />
      </g>
      <g className="sketch__dim">
        <path d="M570 196a100 100 0 0 0-100-100" />
        <path d="M532 196a62 62 0 0 0-62 62" />
        <path d="M570 234a38 38 0 0 0-38-38" />
      </g>
    </>
  ),

  /* 04 — retrofit: existing frame with new jacketing, plates and bracing. */
  retrofit: (
    <>
      <g className="sketch__line">
        <path d="M90 330V110h240v220" />
        <path d="M90 330h240M150 330V110M270 330V110" />
        <path d="M90 220h240" />
      </g>
      <g className="sketch__hatch">
        <path d="M138 110h24v220h-24zM258 110h24v220h-24z" />
        <path d="M90 208h240v24H90z" />
        <path d="M150 220 270 110M150 110l120 110" />
        <path d="M420 130h80v14h-80zM420 300h80v14h-80zM454 144v156" />
        <path d="M446 144h16v156h-16z" />
        <path d="M424 160h72M424 190h72M424 250h72M424 280h72" />
      </g>
      <g className="sketch__dim">
        <path d="M66 110v220M58 110h16M58 330h16" />
        <path d="M400 130v184M392 130h16M392 314h16" />
      </g>
    </>
  ),

  /* High-rise elevation — used as a broad section backdrop. */
  tower: (
    <>
      <g className="sketch__line">
        <path d="M150 356V128h130v228M280 356V184h96v172" />
        <path d="M180 128V92h70v36M215 92V56" />
        <path d="M120 356h320" />
        <path d="M400 356V232h44v124" />
      </g>
      <g className="sketch__hatch">
        <path d="M150 156h130M150 184h130M150 212h130M150 240h130M150 268h130M150 296h130M150 324h130" />
        <path d="M280 212h96M280 240h96M280 268h96M280 296h96M280 324h96" />
        <path d="M400 260h44M400 288h44M400 316h44" />
        <path d="M215 128v228" />
      </g>
      <g className="sketch__dim">
        <path d="M120 382h324M120 374v16M444 374v16" />
        <path d="M96 128v228M88 128h16M88 356h16" />
      </g>
    </>
  ),
};

export default function Sketch({
  variant = 'tower',
  className,
}: {
  variant?: SketchVariant;
  className?: string;
}) {
  return (
    <svg
      className={`sketch ${className ?? ''}`}
      viewBox="0 0 600 400"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      {GRID}
      {ART[variant]}
    </svg>
  );
}
