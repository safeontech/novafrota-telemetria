import { SVGProps } from "react";

/**
 * Bobcat skid-steer loader — side profile (facing left, bucket forward).
 * Uses currentColor so it inherits text color from parent.
 * Looks great from 16px up to any size.
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
      {/* ── Track assembly ─────────────────────────────────────────────── */}
      <rect x="2" y="50" width="76" height="12" rx="6" fill="currentColor" opacity="0.95" />

      {/* Rear drive sprocket */}
      <circle cx="72" cy="56" r="5.5" fill="currentColor" />
      <circle cx="72" cy="56" r="2.5" fill="currentColor" opacity="0.25" />

      {/* Front idler wheel */}
      <circle cx="8" cy="56" r="5.5" fill="currentColor" />
      <circle cx="8" cy="56" r="2.5" fill="currentColor" opacity="0.25" />

      {/* Mid rollers */}
      <circle cx="28" cy="56" r="3" fill="currentColor" opacity="0.6" />
      <circle cx="44" cy="56" r="3" fill="currentColor" opacity="0.6" />

      {/* ── Lift arms (iconic over-the-cab Z-bar linkage) ──────────────── */}
      {/* Main arm tube: pivots at rear, goes up the back, over the top, down front */}
      <path
        d="M62 50 L62 17 L28 17 L18 38"
        stroke="currentColor"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.95"
      />

      {/* ── Main cab body ──────────────────────────────────────────────── */}
      <rect x="32" y="19" width="38" height="31" rx="3" fill="currentColor" />

      {/* ── ROPS canopy (rollover protection frame / roof) ─────────────── */}
      <rect x="32" y="13" width="38" height="8" rx="4" fill="currentColor" />

      {/* ── Front windshield glass ─────────────────────────────────────── */}
      <rect x="56" y="21" width="12" height="17" rx="2" fill="currentColor" opacity="0.12" />
      <rect x="56" y="21" width="12" height="17" rx="2" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />

      {/* ── Side door / operator entry glass ──────────────────────────── */}
      <rect x="34" y="21" width="18" height="17" rx="2" fill="currentColor" opacity="0.08" />
      <rect x="34" y="21" width="18" height="17" rx="2" stroke="currentColor" strokeWidth="1" opacity="0.2" />

      {/* ── Quick-attach plate ─────────────────────────────────────────── */}
      <rect x="12" y="34" width="9" height="14" rx="2" fill="currentColor" opacity="0.88" />

      {/* ── Bucket (lowered / working position) ───────────────────────── */}
      <path d="M2 37 L16 37 L21 50 L2 50 Z" fill="currentColor" opacity="0.9" />

      {/* Cutting edge highlight */}
      <rect x="1" y="48.5" width="21" height="3" rx="1.5" fill="currentColor" />
    </svg>
  );
}

/**
 * Larger, two-tone Bobcat icon for card/hero use.
 * Takes `accentColor` for highlights (e.g. "hsl(217 90% 64%)" for blue).
 */
export function BobcatHeroIcon({ className, active = false, ...props }: SVGProps<SVGSVGElement> & { className?: string; active?: boolean }) {
  return (
    <svg
      viewBox="0 0 96 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Bobcat machine"
      {...props}
    >
      {/* Shadow/ground */}
      <ellipse cx="48" cy="77" rx="36" ry="4" fill="currentColor" opacity="0.08" />

      {/* ── Tracks ─────────────────────────────────────────────────────── */}
      <rect x="4" y="60" width="88" height="14" rx="7" fill="currentColor" opacity="0.9" />

      {/* Rear sprocket */}
      <circle cx="85" cy="67" r="6.5" fill="currentColor" />
      <circle cx="85" cy="67" r="3" fill="currentColor" opacity="0.2" />

      {/* Front idler */}
      <circle cx="11" cy="67" r="6.5" fill="currentColor" />
      <circle cx="11" cy="67" r="3" fill="currentColor" opacity="0.2" />

      {/* Road rollers */}
      <circle cx="32" cy="67" r="4" fill="currentColor" opacity="0.55" />
      <circle cx="52" cy="67" r="4" fill="currentColor" opacity="0.55" />

      {/* ── Lift arms ──────────────────────────────────────────────────── */}
      {/* Primary Z-bar linkage: rear pivot → up back → forward over cab → down to bucket */}
      <path
        d="M74 60 L74 20 L34 20 L22 48"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.95"
      />
      {/* Second arm (slight offset for depth) */}
      <path
        d="M70 60 L70 22 L32 22 L20 50"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.25"
      />

      {/* ── Cab / body ─────────────────────────────────────────────────── */}
      <rect x="38" y="22" width="46" height="38" rx="4" fill="currentColor" />

      {/* ROPS / roof bar */}
      <rect x="38" y="15" width="46" height="10" rx="5" fill="currentColor" />

      {/* Front glass – active machines get a subtle highlight */}
      <rect x="68" y="25" width="14" height="20" rx="2.5" fill={active ? "currentColor" : "currentColor"} opacity={active ? 0.25 : 0.1} />
      <rect x="68" y="25" width="14" height="20" rx="2.5" stroke="currentColor" strokeWidth="1.5" opacity={active ? 0.6 : 0.3} />

      {/* Door glass */}
      <rect x="41" y="25" width="22" height="20" rx="2.5" fill="currentColor" opacity="0.08" />
      <rect x="41" y="25" width="22" height="20" rx="2.5" stroke="currentColor" strokeWidth="1" opacity={active ? 0.35 : 0.2} />

      {/* Engine deck vents */}
      <rect x="40" y="48" width="5" height="9" rx="1.5" fill="currentColor" opacity="0.2" />
      <rect x="47" y="48" width="5" height="9" rx="1.5" fill="currentColor" opacity="0.15" />

      {/* ── Bucket assembly ────────────────────────────────────────────── */}
      {/* Quick-attach plate */}
      <rect x="14" y="42" width="11" height="17" rx="2" fill="currentColor" opacity="0.85" />

      {/* Bucket shell */}
      <path d="M2 44 L20 44 L26 60 L2 60 Z" fill="currentColor" opacity="0.9" />

      {/* Cutting edge (bright accent) */}
      <rect x="1" y="58" width="26" height="4" rx="2" fill="currentColor" />
    </svg>
  );
}
