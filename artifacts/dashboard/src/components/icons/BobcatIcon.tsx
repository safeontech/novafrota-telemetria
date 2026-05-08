import { SVGProps } from "react";

/**
 * Monochrome Bobcat silhouette — uses currentColor.
 * Great for sidebar nav items and tiny sizes where color isn't readable.
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
      {/* Track assembly */}
      <rect x="2" y="50" width="76" height="12" rx="6" fill="currentColor" opacity="0.95" />
      <circle cx="72" cy="56" r="5.5" fill="currentColor" />
      <circle cx="72" cy="56" r="2.5" fill="currentColor" opacity="0.25" />
      <circle cx="8" cy="56" r="5.5" fill="currentColor" />
      <circle cx="8" cy="56" r="2.5" fill="currentColor" opacity="0.25" />
      <circle cx="28" cy="56" r="3" fill="currentColor" opacity="0.6" />
      <circle cx="44" cy="56" r="3" fill="currentColor" opacity="0.6" />
      {/* Lift arms */}
      <path
        d="M62 50 L62 17 L28 17 L18 38"
        stroke="currentColor"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.95"
      />
      {/* Main cab body */}
      <rect x="32" y="19" width="38" height="31" rx="3" fill="currentColor" />
      {/* ROPS canopy */}
      <rect x="32" y="13" width="38" height="8" rx="4" fill="currentColor" />
      {/* Front windshield glass */}
      <rect x="56" y="21" width="12" height="17" rx="2" fill="currentColor" opacity="0.12" />
      <rect x="56" y="21" width="12" height="17" rx="2" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
      {/* Side door glass */}
      <rect x="34" y="21" width="18" height="17" rx="2" fill="currentColor" opacity="0.08" />
      <rect x="34" y="21" width="18" height="17" rx="2" stroke="currentColor" strokeWidth="1" opacity="0.2" />
      {/* Quick-attach plate */}
      <rect x="12" y="34" width="9" height="14" rx="2" fill="currentColor" opacity="0.88" />
      {/* Bucket */}
      <path d="M2 37 L16 37 L21 50 L2 50 Z" fill="currentColor" opacity="0.9" />
      {/* Cutting edge */}
      <rect x="1" y="48.5" width="21" height="3" rx="1.5" fill="currentColor" />
    </svg>
  );
}

/**
 * Realistic full-color Bobcat skid-steer icon.
 * Yellow body, black rubber tires, dark tinted glass — looks like the real machine.
 * Use at 48px+ for best results. Machine faces left (bucket on left).
 */
export function BobcatColorIcon({ className, ...props }: SVGProps<SVGSVGElement> & { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 150"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Bobcat skid-steer loader"
      {...props}
    >
      {/* ── Ground shadow ─────────────────────────────────────────────── */}
      <ellipse cx="120" cy="146" rx="102" ry="5" fill="#000" opacity="0.13" />

      {/* ══ REAR WHEEL (right side) ═════════════════════════════════════ */}
      {/* Outer rubber */}
      <circle cx="178" cy="116" r="33" fill="#1C1C1C" />
      {/* Tread ring */}
      <circle cx="178" cy="116" r="30" fill="none" stroke="#111" strokeWidth="3" />
      {/* Hub face */}
      <circle cx="178" cy="116" r="21" fill="#C09500" />
      <circle cx="178" cy="116" r="19" fill="#D4A800" />
      {/* Hub rim */}
      <circle cx="178" cy="116" r="22" fill="none" stroke="#A07800" strokeWidth="1.5" />
      {/* Center cap */}
      <circle cx="178" cy="116" r="7" fill="#777" />
      <circle cx="178" cy="116" r="4.5" fill="#555" />
      {/* 6 lug nuts at r=13 */}
      <circle cx="191" cy="116" r="2.5" fill="#555" />
      <circle cx="184.5" cy="127.3" r="2.5" fill="#555" />
      <circle cx="171.5" cy="127.3" r="2.5" fill="#555" />
      <circle cx="165" cy="116" r="2.5" fill="#555" />
      <circle cx="171.5" cy="104.7" r="2.5" fill="#555" />
      <circle cx="184.5" cy="104.7" r="2.5" fill="#555" />

      {/* ══ FRONT WHEEL (left side) ═════════════════════════════════════ */}
      <circle cx="65" cy="116" r="31" fill="#1C1C1C" />
      <circle cx="65" cy="116" r="28" fill="none" stroke="#111" strokeWidth="3" />
      <circle cx="65" cy="116" r="19" fill="#C09500" />
      <circle cx="65" cy="116" r="17" fill="#D4A800" />
      <circle cx="65" cy="116" r="20" fill="none" stroke="#A07800" strokeWidth="1.5" />
      <circle cx="65" cy="116" r="6.5" fill="#777" />
      <circle cx="65" cy="116" r="4" fill="#555" />
      {/* 6 lug nuts at r=13 */}
      <circle cx="78" cy="116" r="2.5" fill="#555" />
      <circle cx="71.5" cy="127.3" r="2.5" fill="#555" />
      <circle cx="58.5" cy="127.3" r="2.5" fill="#555" />
      <circle cx="52" cy="116" r="2.5" fill="#555" />
      <circle cx="58.5" cy="104.7" r="2.5" fill="#555" />
      <circle cx="71.5" cy="104.7" r="2.5" fill="#555" />

      {/* ══ CHASSIS / LOWER FRAME ═══════════════════════════════════════ */}
      <rect x="28" y="100" width="185" height="20" rx="4" fill="#A07800" />
      <rect x="28" y="100" width="185" height="9" rx="4" fill="#C09500" />

      {/* ══ LIFT ARMS (Z-bar linkage) ═══════════════════════════════════ */}
      {/* Outer shadow stroke */}
      <path d="M162 107 L162 24 L92 24 L50 62"
        stroke="#8a6600" strokeWidth="14"
        strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Arm body */}
      <path d="M162 107 L162 24 L92 24 L50 62"
        stroke="#C09500" strokeWidth="11"
        strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Arm top highlight */}
      <path d="M162 107 L162 24 L92 24 L50 62"
        stroke="#E0B800" strokeWidth="4"
        strokeLinecap="round" strokeLinejoin="round" fill="none" />

      {/* ══ HYDRAULIC CYLINDER ══════════════════════════════════════════ */}
      {/* Cylinder barrel */}
      <line x1="150" y1="100" x2="98" y2="53"
        stroke="#555" strokeWidth="10" strokeLinecap="round" />
      <line x1="150" y1="100" x2="98" y2="53"
        stroke="#888" strokeWidth="7" strokeLinecap="round" />
      {/* Piston rod (lighter) */}
      <line x1="138" y1="88" x2="98" y2="53"
        stroke="#bbb" strokeWidth="4" strokeLinecap="round" />

      {/* ══ MAIN BODY ═══════════════════════════════════════════════════ */}
      {/* Shadow base */}
      <rect x="84" y="56" width="118" height="56" rx="5" fill="#A07800" />
      {/* Main body */}
      <rect x="84" y="50" width="118" height="56" rx="5" fill="#D4A800" />

      {/* Engine/rear compartment */}
      <rect x="184" y="54" width="18" height="47" rx="3" fill="#B88C00" />
      {/* Grille lines */}
      <line x1="190" y1="61" x2="190" y2="70" stroke="#8a6600" strokeWidth="2" />
      <line x1="195" y1="61" x2="195" y2="70" stroke="#8a6600" strokeWidth="2" />
      <line x1="190" y1="76" x2="190" y2="85" stroke="#8a6600" strokeWidth="2" />
      <line x1="195" y1="76" x2="195" y2="85" stroke="#8a6600" strokeWidth="2" />
      {/* Rear panel lower detail */}
      <rect x="184" y="90" width="18" height="8" rx="2" fill="#A07800" />

      {/* ══ ROPS CANOPY / ROOF ══════════════════════════════════════════ */}
      {/* Shadow */}
      <rect x="84" y="20" width="118" height="35" rx="5" fill="#A07800" />
      {/* ROPS body */}
      <rect x="84" y="16" width="118" height="35" rx="5" fill="#D4A800" />
      {/* Top highlight edge */}
      <rect x="86" y="16" width="114" height="5" rx="2.5" fill="#F0C800" />

      {/* ══ WINDSHIELD (angled front face) ══════════════════════════════ */}
      {/* Glass */}
      <polygon points="84,53 84,88 116,100 116,46" fill="#1A2030" />
      {/* Frame */}
      <line x1="116" y1="46" x2="116" y2="100" stroke="#B88C00" strokeWidth="2.5" />
      <line x1="84" y1="53" x2="116" y2="46" stroke="#B88C00" strokeWidth="2.5" />
      <line x1="84" y1="88" x2="116" y2="100" stroke="#B88C00" strokeWidth="2.5" />
      {/* Glass reflection */}
      <polygon points="87,57 87,73 102,77 102,53" fill="white" opacity="0.07" />
      {/* Wiper blade */}
      <line x1="88" y1="60" x2="113" y2="54" stroke="#333" strokeWidth="1.5" />

      {/* ══ ROPS TOP GLASS ══════════════════════════════════════════════ */}
      <rect x="88" y="20" width="110" height="27" rx="3" fill="#1A2030" />
      {/* Center divider bar */}
      <line x1="143" y1="20" x2="143" y2="47" stroke="#C09500" strokeWidth="2.5" />
      {/* Glass reflection sheen */}
      <rect x="90" y="22" width="48" height="9" rx="2" fill="white" opacity="0.05" />
      {/* Rain channel at top */}
      <line x1="88" y1="20" x2="198" y2="20" stroke="#C09500" strokeWidth="1.5" />

      {/* ══ BODY PANEL DETAILS ══════════════════════════════════════════ */}
      {/* Vertical seam */}
      <line x1="132" y1="50" x2="132" y2="106" stroke="#B88C00" strokeWidth="1.5" opacity="0.7" />
      {/* Horizontal seam */}
      <line x1="84" y1="82" x2="184" y2="82" stroke="#B88C00" strokeWidth="1.5" opacity="0.6" />
      {/* Upper body logo area */}
      <rect x="135" y="56" width="42" height="22" rx="2" fill="#C09500" opacity="0.4" />

      {/* Access steps */}
      <rect x="168" y="86" width="14" height="4" rx="1.5" fill="#B88C00" />
      <rect x="168" y="93" width="14" height="4" rx="1.5" fill="#B88C00" />

      {/* ══ QUICK-ATTACH PLATE ══════════════════════════════════════════ */}
      <rect x="39" y="50" width="16" height="23" rx="2" fill="#4a4a4a" />
      <rect x="41" y="52" width="12" height="19" rx="1" fill="#3a3a3a" />
      {/* Mount pins */}
      <circle cx="47" cy="56" r="2.5" fill="#666" />
      <circle cx="47" cy="68" r="2.5" fill="#666" />

      {/* ══ BUCKET ══════════════════════════════════════════════════════ */}
      {/* Bucket body */}
      <path d="M2 52 L44 52 L52 84 L2 86 Z" fill="#2d2d2d" />
      {/* Bucket interior */}
      <path d="M5 55 L41 55 L48 81 L5 83 Z" fill="#252525" />
      {/* Top lip */}
      <rect x="2" y="50" width="42" height="4" rx="1" fill="#3a3a3a" />
      {/* Cutting edge */}
      <rect x="1" y="83" width="52" height="5" rx="2" fill="#4a4a4a" />
      {/* Cutting edge teeth highlights */}
      <line x1="10" y1="85" x2="10" y2="88" stroke="#666" strokeWidth="2" strokeLinecap="round" />
      <line x1="21" y1="85" x2="21" y2="88" stroke="#666" strokeWidth="2" strokeLinecap="round" />
      <line x1="32" y1="85" x2="32" y2="88" stroke="#666" strokeWidth="2" strokeLinecap="round" />
      <line x1="43" y1="85" x2="43" y2="88" stroke="#666" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * @deprecated Use BobcatColorIcon for large displays, BobcatIcon for small.
 */
export function BobcatHeroIcon({ className, active = false, ...props }: SVGProps<SVGSVGElement> & { className?: string; active?: boolean }) {
  return <BobcatColorIcon className={className} {...props} />;
}
