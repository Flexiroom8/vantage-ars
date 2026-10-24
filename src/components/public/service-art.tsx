import type { ReactNode } from "react";
import type { ServicePage } from "@/lib/site/services";

type ArtSlug = ServicePage["slug"];

const GRID_X = [40, 80, 120, 160, 200, 240, 280, 320, 360, 400, 440];
const GRID_Y = [30, 60, 90, 120, 150, 180, 210, 240];

function Frame({ children }: { children: ReactNode }) {
  return (
    <>
      <rect width="480" height="270" fill="var(--color-surface)" />
      <g stroke="var(--color-border)" strokeWidth="1" opacity="0.38">
        {GRID_X.map((x) => (
          <path key={`x-${x}`} d={`M${x} 0V270`} />
        ))}
        {GRID_Y.map((y) => (
          <path key={`y-${y}`} d={`M0 ${y}H480`} />
        ))}
      </g>
      <ellipse cx="240" cy="136" rx="158" ry="108" fill="var(--color-accent)" opacity="0.055" />
      <g stroke="var(--color-subtle)" strokeWidth="1" opacity="0.55" fill="none">
        <path d="M14 34V14h20" />
        <path d="M446 14h20v20" />
        <path d="M14 236v20h20" />
        <path d="M446 256h20v-20" />
      </g>
      {children}
    </>
  );
}

function VoipScene() {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <ellipse
        cx="240"
        cy="232"
        rx="118"
        ry="13"
        fill="var(--color-fg)"
        opacity="0.05"
        stroke="none"
      />
      <g stroke="var(--color-accent)" opacity="0.6">
        <path d="M342 84c16 10 25 27 25 46" strokeWidth="1.5" />
        <path d="M356 69c25 16 39 42 39 72" strokeWidth="1.5" opacity="0.65" />
        <path d="M370 54c34 22 52 56 52 93" strokeWidth="1.5" opacity="0.35" />
      </g>
      <g stroke="var(--color-border)" strokeDasharray="3 7">
        <path d="M462 86H370" />
        <path d="M462 110H380" />
      </g>
      <circle cx="424" cy="86" r="3" fill="var(--color-accent)" stroke="none" />
      <circle cx="396" cy="110" r="2.5" fill="var(--color-accent)" stroke="none" opacity="0.75" />
      <rect
        x="150"
        y="155"
        width="180"
        height="72"
        rx="16"
        fill="var(--color-raised)"
        stroke="var(--color-fg)"
        strokeOpacity="0.72"
        strokeWidth="1.5"
      />
      <path d="M165 164h150" stroke="var(--color-border)" />
      <rect
        x="146"
        y="92"
        width="188"
        height="42"
        rx="21"
        fill="var(--color-surface)"
        stroke="var(--color-fg)"
        strokeOpacity="0.8"
        strokeWidth="2"
      />
      <rect
        x="158"
        y="101"
        width="26"
        height="24"
        rx="10"
        fill="var(--color-accent)"
        fillOpacity="0.16"
        stroke="var(--color-accent)"
        strokeWidth="1.5"
      />
      <rect
        x="296"
        y="101"
        width="26"
        height="24"
        rx="10"
        fill="var(--color-accent)"
        fillOpacity="0.16"
        stroke="var(--color-accent)"
        strokeWidth="1.5"
      />
      <path
        d="M316 134c17 5 25 15 22 25s-15 14-29 8"
        stroke="var(--color-subtle)"
        strokeWidth="1.5"
      />
      <path d="M309 167c10 4 15 11 13 18" stroke="var(--color-subtle)" strokeWidth="1.5" />
      {[0, 1, 2].map((row) =>
        [0, 1, 2].map((col) => (
          <circle
            key={`${row}-${col}`}
            cx={191 + col * 27}
            cy={181 + row * 14}
            r="4"
            fill="var(--color-surface)"
            stroke="var(--color-subtle)"
            strokeWidth="1"
          />
        )),
      )}
      <circle
        cx="272"
        cy="195"
        r="4.5"
        fill="var(--color-ok)"
        fillOpacity="0.25"
        stroke="var(--color-ok)"
        className="mi-blink"
      />
      <path d="M293 181h20M293 195h20M293 209h12" stroke="var(--color-subtle)" strokeWidth="1.5" />
      <circle cx="424" cy="86" r="8" stroke="var(--color-accent)" opacity="0.3" />
    </g>
  );
}

function NetworkScene() {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <ellipse
        cx="240"
        cy="232"
        rx="132"
        ry="13"
        fill="var(--color-fg)"
        opacity="0.05"
        stroke="none"
      />
      <g stroke="var(--color-subtle)" strokeDasharray="3 7" opacity="0.8">
        <path d="M88 108C126 108 142 140 164 154" />
        <path d="M106 220C140 214 148 192 168 180" />
        <path d="M392 210C362 204 348 190 332 180" />
      </g>
      <g fill="var(--color-accent)" stroke="none">
        <circle cx="122" cy="116" r="2.6" />
        <circle cx="132" cy="198" r="2.3" opacity="0.75" />
        <circle cx="368" cy="198" r="2.6" />
      </g>
      {[
        [88, 108],
        [106, 220],
        [392, 210],
      ].map(([cx, cy]) => (
        <g key={`${cx}-${cy}`}>
          <circle cx={cx} cy={cy} r="11" fill="var(--color-surface)" stroke="var(--color-subtle)" />
          <circle cx={cx} cy={cy} r="3" fill="var(--color-accent)" stroke="none" />
        </g>
      ))}
      <g stroke="var(--color-fg)" strokeOpacity="0.75" strokeWidth="1.5">
        <path d="M185 145V96" />
        <path d="M245 145V82" />
        <path d="M305 145V101" />
      </g>
      <g stroke="var(--color-accent)" opacity="0.65">
        <path d="M173 88c-5-8-5-17 0-25" />
        <path d="M257 73c6-9 6-19 0-28" />
        <path d="M317 92c5-8 5-17 0-25" />
      </g>
      <path
        d="M162 145l26-19h188l-26 19z"
        fill="var(--color-raised)"
        stroke="var(--color-fg)"
        strokeOpacity="0.65"
      />
      <rect
        x="162"
        y="145"
        width="176"
        height="64"
        rx="8"
        fill="var(--color-surface)"
        stroke="var(--color-fg)"
        strokeOpacity="0.8"
        strokeWidth="1.5"
      />
      <g stroke="var(--color-border)">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <rect
            key={index}
            x={176 + index * 25}
            y="168"
            width="16"
            height="12"
            rx="2"
            fill="var(--color-raised)"
          />
        ))}
      </g>
      <g fill="var(--color-ok)" stroke="none">
        <circle cx="180" cy="194" r="2.5" className="mi-blink" />
        <circle cx="192" cy="194" r="2.5" opacity="0.55" />
        <circle cx="319" cy="194" r="2.5" fill="var(--color-accent)" />
      </g>
      <path d="M228 194h32" stroke="var(--color-border)" strokeWidth="2" />
      <g stroke="var(--color-accent)" opacity="0.7" strokeWidth="1.4">
        <path d="M366 78c9 6 14 16 14 27" />
        <path d="M378 66c14 9 22 24 22 39" />
      </g>
    </g>
  );
}

function InfraScene() {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <ellipse
        cx="240"
        cy="244"
        rx="126"
        ry="11"
        fill="var(--color-fg)"
        opacity="0.05"
        stroke="none"
      />
      <path
        d="M180 66c0-8 6-14 14-14h104c8 0 14 6 14 14v172H180z"
        fill="var(--color-surface)"
        stroke="var(--color-fg)"
        strokeOpacity="0.75"
        strokeWidth="1.5"
      />
      <path d="M180 70h132M180 226h132" stroke="var(--color-border)" />
      <g stroke="var(--color-subtle)" opacity="0.7">
        <path d="M190 82v132M302 82v132" strokeDasharray="2 7" />
      </g>
      {[0, 1, 2].map((row) => (
        <g key={row}>
          <rect
            x="196"
            y={91 + row * 46}
            width="100"
            height="34"
            rx="4"
            fill="var(--color-raised)"
            stroke="var(--color-border)"
          />
          <path
            d={`M206 ${101 + row * 46}h34M206 ${108 + row * 46}h22M206 ${115 + row * 46}h28`}
            stroke="var(--color-subtle)"
          />
          <circle
            cx="282"
            cy={103 + row * 46}
            r="3"
            fill={row === 1 ? "var(--color-ok)" : "var(--color-border)"}
            stroke="none"
            className={row === 1 ? "mi-blink" : undefined}
          />
          <rect
            x="206"
            y={112 + row * 46}
            width="18"
            height="4"
            rx="2"
            stroke="none"
            fill="var(--color-accent)"
            opacity={row === 1 ? 0.8 : 0.18}
          />
        </g>
      ))}
      <g stroke="var(--color-accent)" opacity="0.65" strokeWidth="1.4" strokeDasharray="4 5">
        <path d="M312 124h28" />
      </g>
      <rect
        x="338"
        y="96"
        width="104"
        height="92"
        rx="9"
        fill="var(--color-surface)"
        stroke="var(--color-fg)"
        strokeOpacity="0.55"
      />
      <path d="M338 116h104" stroke="var(--color-border)" />
      <g fill="var(--color-subtle)" stroke="none">
        <circle cx="350" cy="106" r="2" />
        <circle cx="359" cy="106" r="2" />
        <circle cx="368" cy="106" r="2" />
      </g>
      <g stroke="var(--color-accent)" strokeWidth="1.6">
        <path d="M352 132l8 8-8 8" />
        <path
          d="M367 148h30M367 158h22M367 168h34"
          stroke="var(--color-subtle)"
          strokeWidth="1.2"
        />
      </g>
      <path d="M302 197c30 0 31 18 53 18h18" stroke="var(--color-subtle)" strokeWidth="1.4" />
      <g fill="var(--color-ok)" stroke="none">
        <circle cx="282" cy="149" r="2.5" opacity="0.55" />
      </g>
    </g>
  );
}

function ManagedScene() {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <rect
        x="104"
        y="54"
        width="252"
        height="168"
        rx="13"
        fill="var(--color-surface)"
        stroke="var(--color-fg)"
        strokeOpacity="0.65"
        strokeWidth="1.5"
      />
      <path d="M104 84h252" stroke="var(--color-border)" />
      <g fill="var(--color-subtle)" stroke="none">
        <circle cx="121" cy="69" r="2.4" />
        <circle cx="131" cy="69" r="2.4" />
        <circle cx="141" cy="69" r="2.4" />
      </g>
      <rect x="314" y="62" width="28" height="13" rx="6.5" stroke="var(--color-border)" />
      <g stroke="var(--color-border)" strokeWidth="1" strokeDasharray="2 6" opacity="0.65">
        <path d="M126 112h206M126 144h206M126 176h206" />
      </g>
      <path
        d="M126 188l34-30 27 12 31-44 28 20 28-38 38 24"
        stroke="var(--color-accent)"
        strokeWidth="2.5"
      />
      <path
        d="M126 188l34-30 27 12 31-44 28 20 28-38 38 24v56H126z"
        fill="var(--color-accent)"
        fillOpacity="0.08"
        stroke="none"
      />
      <g fill="var(--color-accent)" stroke="none">
        {[
          [160, 158],
          [187, 170],
          [218, 126],
          [246, 146],
          [274, 108],
          [312, 132],
        ].map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.4" />
        ))}
      </g>
      <g stroke="var(--color-subtle)" strokeWidth="1.4">
        <path d="M126 203h46M126 210h29" />
      </g>
      <circle
        cx="362"
        cy="194"
        r="44"
        fill="var(--color-surface)"
        stroke="var(--color-fg)"
        strokeOpacity="0.6"
      />
      <circle cx="362" cy="194" r="32" stroke="var(--color-border)" strokeDasharray="3 6" />
      <circle cx="362" cy="194" r="21" stroke="var(--color-accent)" opacity="0.75" />
      <path d="M362 194v-13M362 194l10 6" stroke="var(--color-accent)" strokeWidth="2" />
      <g stroke="var(--color-subtle)" strokeWidth="1.2" opacity="0.6">
        <path d="M362 152v5M362 231v5M320 194h5M399 194h5" />
      </g>
      <circle
        cx="394"
        cy="226"
        r="15"
        fill="var(--color-ok)"
        fillOpacity="0.14"
        stroke="var(--color-ok)"
      />
      <path d="M387 226l5 5 9-11" stroke="var(--color-ok)" strokeWidth="2" />
      <g stroke="var(--color-accent)" opacity="0.55">
        <path d="M370 92c9 5 15 14 17 24" />
        <path d="M381 81c14 8 23 21 25 35" />
      </g>
    </g>
  );
}

function CloudScene() {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <ellipse
        cx="240"
        cy="225"
        rx="144"
        ry="12"
        fill="var(--color-fg)"
        opacity="0.04"
        stroke="none"
      />
      <path
        d="M174 170c-17 0-31-14-31-31 0-16 12-29 28-31 4-25 25-44 51-44 23 0 43 15 50 36 4-2 9-3 14-3 19 0 35 16 35 35 0 2 0 4-1 6 12 5 20 17 20 30 0 18-15 32-33 32H174z"
        fill="var(--color-surface)"
        stroke="var(--color-fg)"
        strokeOpacity="0.75"
        strokeWidth="1.5"
      />
      <path
        d="M174 170c-17 0-31-14-31-31 0-16 12-29 28-31 4-25 25-44 51-44 23 0 43 15 50 36 4-2 9-3 14-3 19 0 35 16 35 35 0 2 0 4-1 6"
        stroke="var(--color-accent)"
        strokeOpacity="0.32"
      />
      <rect
        x="201"
        y="91"
        width="80"
        height="54"
        rx="6"
        fill="var(--color-raised)"
        stroke="var(--color-accent)"
        strokeWidth="1.5"
      />
      <path d="M201 96l40 27 40-27M201 139l29-25M281 139l-29-25" stroke="var(--color-accent)" />
      <g stroke="var(--color-subtle)" strokeDasharray="3 7" opacity="0.85">
        <path d="M206 169c-25 10-44 26-58 45" />
        <path d="M240 171v45" />
        <path d="M274 169c25 10 44 24 58 42" />
      </g>
      <g>
        {[
          [106, 223],
          [240, 233],
          [370, 219],
        ].map(([cx, cy]) => (
          <g key={`${cx}-${cy}`}>
            <circle
              cx={cx}
              cy={cy}
              r="11"
              fill="var(--color-surface)"
              stroke="var(--color-subtle)"
            />
            <circle cx={cx} cy={cy} r="3" fill="var(--color-accent)" stroke="none" />
          </g>
        ))}
      </g>
      <g fill="var(--color-accent)" stroke="none">
        <circle cx="166" cy="195" r="2.3" />
        <circle cx="304" cy="192" r="2.3" />
        <circle cx="240" cy="214" r="2.3" />
      </g>
      <g stroke="var(--color-accent)" opacity="0.55">
        <path d="M357 82c10 6 16 16 18 28" />
        <path d="M369 70c15 9 25 24 27 40" />
      </g>
      <circle cx="360" cy="118" r="3" fill="var(--color-ok)" stroke="none" className="mi-blink" />
    </g>
  );
}

function SecurityScene() {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <g stroke="var(--color-border)" strokeDasharray="2 8" opacity="0.6">
        <circle cx="240" cy="142" r="112" />
        <circle cx="240" cy="142" r="88" />
      </g>
      <g stroke="var(--color-accent)" opacity="0.35">
        <path d="M126 142h16M338 142h16M240 28v16M240 240v16" />
      </g>
      <g fill="var(--color-accent)" stroke="none" opacity="0.7">
        <circle cx="146" cy="94" r="2.2" />
        <circle cx="334" cy="94" r="2.2" />
        <circle cx="146" cy="190" r="2.2" />
        <circle cx="334" cy="190" r="2.2" />
      </g>
      <path
        d="M240 48l68 26v65c0 48-28 83-68 99-40-16-68-51-68-99V74z"
        fill="var(--color-surface)"
        stroke="var(--color-fg)"
        strokeOpacity="0.8"
        strokeWidth="1.8"
      />
      <path
        d="M240 64l53 20v55c0 39-22 68-53 83-31-15-53-44-53-83V84z"
        stroke="var(--color-accent)"
        strokeOpacity="0.5"
        strokeWidth="1.3"
      />
      <path
        d="M219 137v-13c0-12 9-21 21-21s21 9 21 21v13"
        stroke="var(--color-accent)"
        strokeWidth="2.5"
      />
      <rect
        x="205"
        y="137"
        width="70"
        height="58"
        rx="9"
        fill="var(--color-raised)"
        stroke="var(--color-accent)"
        strokeWidth="2"
      />
      <circle cx="240" cy="160" r="7" stroke="var(--color-accent)" strokeWidth="2" />
      <path d="M240 167v12" stroke="var(--color-accent)" strokeWidth="2.5" />
      <g stroke="var(--color-ok)" strokeWidth="2">
        <path d="M315 208l7 7 13-16" />
      </g>
      <circle
        cx="323"
        cy="207"
        r="21"
        fill="var(--color-ok)"
        fillOpacity="0.1"
        stroke="var(--color-ok)"
        strokeOpacity="0.5"
      />
      <g stroke="var(--color-subtle)" strokeWidth="1.2" opacity="0.55">
        <path d="M96 58h24M96 58v24M384 58h-24M384 58v24" />
      </g>
    </g>
  );
}

function BackupScene() {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <ellipse
        cx="240"
        cy="238"
        rx="130"
        ry="11"
        fill="var(--color-fg)"
        opacity="0.05"
        stroke="none"
      />
      <g stroke="var(--color-ok)" opacity="0.25" strokeWidth="7">
        <path d="M338 80C305 51 254 49 216 70c-52 29-70 96-41 147 19 34 54 55 93 55 45 0 84-28 100-68" />
      </g>
      <path
        d="M338 80C305 51 254 49 216 70c-52 29-70 96-41 147 19 34 54 55 93 55 45 0 84-28 100-68"
        stroke="var(--color-ok)"
        strokeWidth="2"
        opacity="0.8"
      />
      <path d="M326 58l14 23-27 4" stroke="var(--color-ok)" strokeWidth="2" />
      <g stroke="var(--color-fg)" strokeOpacity="0.75" strokeWidth="1.5">
        <ellipse cx="226" cy="102" rx="66" ry="19" fill="var(--color-raised)" />
        <path d="M160 102v33c0 10 30 19 66 19s66-9 66-19v-33" fill="var(--color-surface)" />
        <path d="M160 135v33c0 10 30 19 66 19s66-9 66-19v-33" fill="var(--color-surface)" />
        <path d="M160 168v32c0 10 30 19 66 19s66-9 66-19v-32" fill="var(--color-surface)" />
      </g>
      <g stroke="var(--color-accent)" opacity="0.75">
        <ellipse cx="226" cy="135" rx="66" ry="19" />
        <ellipse cx="226" cy="168" rx="66" ry="19" />
      </g>
      <g fill="var(--color-ok)" stroke="none">
        <circle cx="212" cy="102" r="2.7" className="mi-blink" />
        <circle cx="226" cy="135" r="2.4" opacity="0.65" />
        <circle cx="240" cy="168" r="2.4" opacity="0.65" />
      </g>
      <g stroke="var(--color-subtle)" strokeWidth="1.2" strokeDasharray="3 6">
        <path d="M294 174h30" />
      </g>
      <g>
        <rect
          x="326"
          y="156"
          width="58"
          height="38"
          rx="7"
          fill="var(--color-surface)"
          stroke="var(--color-subtle)"
        />
        <path d="M338 167h34M338 175h22" stroke="var(--color-subtle)" strokeWidth="1.4" />
        <circle cx="374" cy="184" r="2.5" fill="var(--color-ok)" stroke="none" />
      </g>
      <g stroke="var(--color-accent)" opacity="0.5">
        <path d="M121 81c-8 7-14 16-18 26M108 69c-12 10-21 23-27 37" />
      </g>
    </g>
  );
}

function AutomationScene() {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <g stroke="var(--color-border)" strokeWidth="2">
        <path d="M120 135h58M302 135h58M240 103v-30M240 167v34" />
      </g>
      <g stroke="var(--color-accent)" strokeWidth="1.5">
        <rect x="48" y="105" width="72" height="60" rx="10" fill="var(--color-raised)" />
        <rect x="178" y="103" width="124" height="64" rx="12" fill="var(--color-surface)" />
        <rect x="360" y="105" width="72" height="60" rx="10" fill="var(--color-raised)" />
        <path d="M240 202l36 20-36 20-36-20z" fill="var(--color-surface)" />
      </g>
      <g fill="var(--color-fg)" fontFamily="monospace" fontSize="10" textAnchor="middle">
        <text x="84" y="139">
          INPUT
        </text>
        <text x="240" y="132">
          ASSISTANT
        </text>
        <text x="240" y="147" fill="var(--color-subtle)">
          bounded
        </text>
        <text x="396" y="139">
          REVIEW
        </text>
        <text x="240" y="226">
          HUMAN GATE
        </text>
      </g>
      <g fill="var(--color-ok)">
        <circle cx="240" cy="84" r="4" />
        <circle cx="148" cy="135" r="3" />
        <circle cx="332" cy="135" r="3" />
      </g>
      <path d="M214 220h-42v-42" stroke="var(--color-subtle)" strokeDasharray="4 6" />
      <path d="M266 220h42v-42" stroke="var(--color-subtle)" strokeDasharray="4 6" />
    </g>
  );
}

const SCENES: Record<ArtSlug, () => ReactNode> = {
  voip: VoipScene,
  networking: NetworkScene,
  "it-infrastructure": InfraScene,
  "ai-automation": AutomationScene,
  "managed-support": ManagedScene,
  "cloud-email": CloudScene,
  security: SecurityScene,
  "backup-recovery": BackupScene,
};

export function ServiceArt({ slug, className }: { slug: ArtSlug; className?: string }) {
  const Scene = SCENES[slug];

  return (
    <svg
      viewBox="0 0 480 270"
      className={className}
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      <Frame>
        <Scene />
      </Frame>
    </svg>
  );
}
