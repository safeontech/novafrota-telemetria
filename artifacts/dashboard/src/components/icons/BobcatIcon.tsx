import { SVGProps } from "react";

/**
 * Monochrome Bobcat silhouette — uses currentColor.
 * For sidebar nav / tiny sizes.
 */
export function BobcatIcon({ className, ...props }: SVGProps<SVGSVGElement> & { className?: string }) {
  return (
    <svg
      viewBox="0 0 80 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Bobcat skid-steer"
      {...props}
    >
      <rect x="2" y="50" width="76" height="12" rx="6" fill="currentColor" opacity="0.95" />
      <circle cx="72" cy="56" r="5.5" fill="currentColor" />
      <circle cx="8" cy="56" r="5.5" fill="currentColor" />
      <circle cx="28" cy="56" r="3" fill="currentColor" opacity="0.6" />
      <circle cx="44" cy="56" r="3" fill="currentColor" opacity="0.6" />
      <path d="M62 50 L62 17 L28 17 L18 38" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.95" />
      <rect x="32" y="19" width="38" height="31" rx="3" fill="currentColor" />
      <rect x="32" y="13" width="38" height="8" rx="4" fill="currentColor" />
      <rect x="56" y="21" width="12" height="17" rx="2" fill="currentColor" opacity="0.12" />
      <rect x="34" y="21" width="18" height="17" rx="2" fill="currentColor" opacity="0.08" />
      <rect x="12" y="34" width="9" height="14" rx="2" fill="currentColor" opacity="0.88" />
      <path d="M2 37 L16 37 L21 50 L2 50 Z" fill="currentColor" opacity="0.9" />
      <rect x="1" y="48.5" width="21" height="3" rx="1.5" fill="currentColor" />
    </svg>
  );
}

/**
 * Realistic full-color Bobcat skid-steer icon.
 *
 * Machine faces LEFT (bucket on left, cab on right).
 * ViewBox 200×150 — matches a 4:3 display container perfectly.
 *
 * Key anatomy (matching reference image):
 *  - Two large round rubber tires, yellow wheel centers
 *  - Compact boxy cab with ROPS canopy above
 *  - Dark-tinted ROPS side glass (main window)
 *  - Distinctive lift arms arcing up from the rear, over the top, down to bucket
 *  - Hydraulic cylinders (lift + tilt)
 *  - Dark metal bucket with cutting edge
 */
export function BobcatColorIcon({ className, ...props }: SVGProps<SVGSVGElement> & { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 150"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Bobcat skid-steer loader"
      {...props}
    >
      {/* ── Ground shadow ─────────────────────────────────────────────── */}
      <ellipse cx="100" cy="146" rx="90" ry="5" fill="#000" opacity="0.10" />

      {/* ══ REAR WHEEL ══════════════════════════════════════════════════ */}
      {/* Machine faces left; rear is on the RIGHT */}
      {/* Outer tyre */}
      <circle cx="158" cy="112" r="30" fill="#1A1A1A" />
      {/* Tread band */}
      <circle cx="158" cy="112" r="27" fill="none" stroke="#111" strokeWidth="4" strokeDasharray="6 4" />
      {/* Hub face */}
      <circle cx="158" cy="112" r="19" fill="#C09500" />
      <circle cx="158" cy="112" r="17" fill="#D4A800" />
      <circle cx="158" cy="112" r="20" fill="none" stroke="#A07800" strokeWidth="1.5" />
      {/* Centre cap */}
      <circle cx="158" cy="112" r="7" fill="#6a6a6a" />
      <circle cx="158" cy="112" r="4.5" fill="#4a4a4a" />
      {/* 6 lug bolts (r = 12 from centre) */}
      <circle cx="170" cy="112" r="2.5" fill="#555" />
      <circle cx="164" cy="122.4" r="2.5" fill="#555" />
      <circle cx="152" cy="122.4" r="2.5" fill="#555" />
      <circle cx="146" cy="112" r="2.5" fill="#555" />
      <circle cx="152" cy="101.6" r="2.5" fill="#555" />
      <circle cx="164" cy="101.6" r="2.5" fill="#555" />

      {/* ══ FRONT WHEEL ═════════════════════════════════════════════════ */}
      {/* Bucket side — on the LEFT */}
      <circle cx="44" cy="112" r="28" fill="#1A1A1A" />
      <circle cx="44" cy="112" r="25" fill="none" stroke="#111" strokeWidth="4" strokeDasharray="6 4" />
      <circle cx="44" cy="112" r="17" fill="#C09500" />
      <circle cx="44" cy="112" r="15" fill="#D4A800" />
      <circle cx="44" cy="112" r="18" fill="none" stroke="#A07800" strokeWidth="1.5" />
      <circle cx="44" cy="112" r="6" fill="#6a6a6a" />
      <circle cx="44" cy="112" r="4" fill="#4a4a4a" />
      {/* 6 lug bolts (r = 11) */}
      <circle cx="55" cy="112" r="2.5" fill="#555" />
      <circle cx="49.5" cy="121.5" r="2.5" fill="#555" />
      <circle cx="38.5" cy="121.5" r="2.5" fill="#555" />
      <circle cx="33" cy="112" r="2.5" fill="#555" />
      <circle cx="38.5" cy="102.5" r="2.5" fill="#555" />
      <circle cx="49.5" cy="102.5" r="2.5" fill="#555" />

      {/* ══ CHASSIS / LOWER FRAME ═══════════════════════════════════════ */}
      <rect x="16" y="97" width="168" height="18" rx="4" fill="#A07800" />
      {/* Top highlight stripe */}
      <rect x="16" y="97" width="168" height="7" rx="3" fill="#C09500" />

      {/* ══ LIFT ARMS ═══════════════════════════════════════════════════ */}
      {/* The arm goes: rear-lower pivot → up the back → across the top → down to bucket */}
      {/* Drawn BEFORE the cab so the cab body sits on top naturally */}

      {/* Shadow / outer arm */}
      <path d="M150 100 L150 22 L76 22 L52 66"
        stroke="#7a5c00" strokeWidth="15"
        strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Main arm colour */}
      <path d="M150 100 L150 22 L76 22 L52 66"
        stroke="#C09500" strokeWidth="11"
        strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Bright top-edge highlight */}
      <path d="M150 100 L150 22 L76 22 L52 66"
        stroke="#E8C000" strokeWidth="4"
        strokeLinecap="round" strokeLinejoin="round" fill="none" />

      {/* ══ LIFT HYDRAULIC CYLINDER ═════════════════════════════════════ */}
      {/* Barrel (lower, fat) */}
      <line x1="144" y1="98" x2="116" y2="46"
        stroke="#4a4a4a" strokeWidth="10" strokeLinecap="round" />
      <line x1="144" y1="98" x2="116" y2="46"
        stroke="#888" strokeWidth="7" strokeLinecap="round" />
      {/* Piston rod (thinner, lighter) */}
      <line x1="132" y1="84" x2="116" y2="46"
        stroke="#ccc" strokeWidth="4" strokeLinecap="round" />

      {/* ══ MAIN CAB BODY ═══════════════════════════════════════════════ */}
      {/* Body shadow base */}
      <rect x="70" y="52" width="104" height="52" rx="4" fill="#A07800" />
      {/* Body face */}
      <rect x="70" y="48" width="104" height="52" rx="4" fill="#D4A800" />

      {/* ══ ROPS CANOPY ═════════════════════════════════════════════════ */}
      {/* ROPS shadow */}
      <rect x="68" y="20" width="108" height="32" rx="5" fill="#A07800" />
      {/* ROPS body */}
      <rect x="68" y="17" width="108" height="32" rx="5" fill="#D4A800" />
      {/* Top highlight */}
      <rect x="70" y="17" width="104" height="5" rx="2.5" fill="#F2C800" />

      {/* ══ ROPS SIDE GLASS (the main visible window from side view) ════ */}
      <rect x="72" y="21" width="101" height="24" rx="3" fill="#1A2030" />
      {/* Subtle glass glare — top-left triangle */}
      <path d="M74 23 L94 23 L74 33 Z" fill="white" opacity="0.07" />
      {/* Centre pillar (ROPS upright) */}
      <line x1="125" y1="21" x2="125" y2="45" stroke="#C09500" strokeWidth="3" />

      {/* ══ FRONT FACE OF CAB (narrow strip — NOT a truck face) ═════════ */}
      {/* This is the forward-facing wall of the cab — Bobcats have a steep
          windshield, so from the side you only see a narrow strip */}
      <rect x="68" y="49" width="7" height="49" rx="2" fill="#1E2838" />
      {/* Thin bright pillar at cab front edge */}
      <line x1="75" y1="48" x2="75" y2="100" stroke="#B88C00" strokeWidth="2" />

      {/* ══ BODY PANEL DETAILS ══════════════════════════════════════════ */}
      {/* Horizontal seam mid-body */}
      <line x1="75" y1="76" x2="174" y2="76" stroke="#B88C00" strokeWidth="1.5" opacity="0.7" />
      {/* Rear engine ventilation slots */}
      <rect x="164" y="54" width="8" height="8" rx="1" fill="#B88C00" opacity="0.6" />
      <rect x="164" y="66" width="8" height="8" rx="1" fill="#B88C00" opacity="0.6" />
      <rect x="164" y="78" width="8" height="8" rx="1" fill="#B88C00" opacity="0.5" />
      {/* Access steps */}
      <rect x="152" y="82" width="14" height="4" rx="1.5" fill="#B88C00" />
      <rect x="152" y="88" width="14" height="4" rx="1.5" fill="#B88C00" />
      {/* Door grab handle hint */}
      <rect x="142" y="58" width="2" height="12" rx="1" fill="#B88C00" opacity="0.6" />

      {/* ══ TILT HYDRAULIC CYLINDER ═════════════════════════════════════ */}
      {/* Shorter cylinder that tilts the bucket angle */}
      <line x1="63" y1="60" x2="50" y2="78"
        stroke="#555" strokeWidth="8" strokeLinecap="round" />
      <line x1="63" y1="60" x2="50" y2="78"
        stroke="#999" strokeWidth="5" strokeLinecap="round" />
      <line x1="60" y1="65" x2="50" y2="78"
        stroke="#ccc" strokeWidth="3" strokeLinecap="round" />

      {/* ══ QUICK-ATTACH PLATE ══════════════════════════════════════════ */}
      <rect x="40" y="60" width="14" height="24" rx="2" fill="#3d3d3d" />
      <rect x="42" y="62" width="10" height="20" rx="1" fill="#2d2d2d" />
      {/* Attachment pins */}
      <circle cx="47" cy="66" r="2.5" fill="#555" />
      <circle cx="47" cy="80" r="2.5" fill="#555" />

      {/* ══ BUCKET ══════════════════════════════════════════════════════ */}
      {/* Bucket main shell — compact skid-steer proportions */}
      <path d="M4 62 L44 56 L52 96 L4 96 Z" fill="#2a2a2a" />
      {/* Bucket interior (slightly lighter so it reads as hollow) */}
      <path d="M7 65 L41 59 L48 92 L7 92 Z" fill="#222" />
      {/* Back plate (connects to quick-attach) */}
      <line x1="44" y1="56" x2="52" y2="96" stroke="#3a3a3a" strokeWidth="3" />
      {/* Top lip */}
      <rect x="4" y="59" width="40" height="5" rx="1" fill="#353535" />
      {/* Cutting edge (horizontal bar across front-bottom) */}
      <rect x="2" y="93" width="52" height="6" rx="2" fill="#3d3d3d" />
      {/* Cutting edge teeth */}
      <line x1="10" y1="95" x2="10" y2="99" stroke="#555" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="22" y1="95" x2="22" y2="99" stroke="#555" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="34" y1="95" x2="34" y2="99" stroke="#555" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="46" y1="95" x2="46" y2="99" stroke="#555" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/** @deprecated — BobcatColorIcon supersedes this. */
export function BobcatHeroIcon({ className, ...props }: SVGProps<SVGSVGElement> & { className?: string; active?: boolean }) {
  return <BobcatColorIcon className={className} {...props} />;
}
