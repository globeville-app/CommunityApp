/**
 * One badge, drawn exactly as docs/BADGE_UI.md §2 says, on a 200 × 200
 * viewBox scaled to `size`. All numbers below are in that viewBox.
 *
 * Growth badges: halo, ring track, ring arc (one fifth per stage), emblem
 * disc and icon, and a stage pip. Keepsakes: a stamp edge instead of the
 * ring. Unearned: the emblem alone, dimmed.
 *
 * Glow: react-native-svg's blur filter isn't reliable on both phones, so we
 * use the doc's fallback: a wider, faint copy drawn underneath. It widens
 * with the stage (blur 0.8 → 4.0).
 */
import { useId } from "react";
import { useTranslation } from "react-i18next";
import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient, Path, Polygon, RadialGradient, Stop } from "react-native-svg";

import { EMBLEMS, STAGE_KEYS, STAGE_PIP_ICONS } from "./emblems";
import { ICON_PARTS } from "./lucideData";

export const BADGE_COLORS = {
  teal: "#2EE6D6",
  purple: "#8B5CF6",
  pink: "#FF3EA5",
  yellow: "#FFF3A3",
  midnight: "#1A0F3D",
  deep: "#4A1D96",
};
const GLOW_BLUR = [0.8, 1.4, 2.2, 3.0, 4.0];
const ROUND = "round" as const;
const NO_FILL = "none" as const;

export type BadgeKind = "growth" | "keepsake";
export type Tier = "large" | "profile" | "list";

export function tierFor(size: number): Tier {
  if (size >= 120) return "large";
  if (size >= 64) return "profile";
  return "list";
}

type Props = {
  badgeKey: string;
  kind: BadgeKind;
  /** 0 = not earned, 1–5 = Seed–Grove. Keepsakes use 1 once earned. */
  stage: number;
  size: number;
  /** Defaults to stage > 0. */
  earned?: boolean;
  /** The count, for the spoken label ("5 cleanups"). */
  count?: number;
  /** Override the spoken label, or set false when the parent speaks for it. */
  label?: string | false;
  /** Normally from the size; the share card always draws the Large tier. */
  tier?: Tier;
};

/** "Clean Sweeper, Bloom stage, 5 cleanups." in the app's language. */
export function useBadgeLabel() {
  const { t } = useTranslation();
  return (badgeKey: string, kind: BadgeKind, stage: number, count = 0, earned = stage > 0) => {
    const badge = t(`badges.${badgeKey}.name`);
    if (!earned) return t("badges.a11y.unearned", { badge, description: t(`badges.${badgeKey}.description`) });
    if (kind === "keepsake") return t("badges.a11y.keepsake", { badge });
    return t("badges.a11y.growth", {
      badge,
      stage: t(`badges.stage.${STAGE_KEYS[stage - 1]}`),
      count,
      units: t(`badges.${badgeKey}.unit`, { count }),
    });
  };
}

/** An icon from lucideData.ts, in Lucide's 24-unit grid. */
function LucideIcon({
  name,
  stroke,
  strokeWidth,
  outline = [],
  fill = [],
  accent,
}: {
  name: string;
  stroke: string;
  strokeWidth: number;
  outline?: number[];
  fill?: number[];
  accent?: string;
}) {
  return (
    <>
      {ICON_PARTS[name].map((part, i) => {
        const filled = accent && fill.includes(i);
        const color = accent && (filled || outline.includes(i)) ? accent : stroke;
        const common = {
          stroke: color,
          strokeWidth,
          strokeLinecap: ROUND,
          strokeLinejoin: ROUND,
          fill: filled ? accent : NO_FILL,
        };
        return "d" in part ? (
          <Path key={i} d={part.d} {...common} />
        ) : (
          <Circle key={i} cx={part.circle[0]} cy={part.circle[1]} r={part.circle[2]} {...common} />
        );
      })}
    </>
  );
}

/** Host's paper lantern, in 200-unit coordinates (BADGE_UI.md). */
function Lantern({ white }: { white: string }) {
  const line = { stroke: white, strokeWidth: 4.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <>
      <Line x1={100} y1={70} x2={100} y2={78} {...line} />
      <Line x1={90} y1={78} x2={110} y2={78} {...line} />
      <Line x1={90} y1={124} x2={110} y2={124} {...line} />
      <Line x1={100} y1={124} x2={100} y2={132} {...line} />
      <Ellipse cx={100} cy={101} rx={24} ry={22} fill={BADGE_COLORS.yellow} fillOpacity={0.85} />
      <Path
        d="M100 79 C88 86 88 116 100 123 M100 79 C112 86 112 116 100 123"
        stroke={BADGE_COLORS.midnight}
        strokeOpacity={0.5}
        strokeWidth={2.5}
        fill="none"
      />
    </>
  );
}

/** The emblem disc and icon. `scale` is 1 at r 50. */
function Emblem({ badgeKey, scale, gradientId, glow }: { badgeKey: string; scale: number; gradientId: string; glow: number }) {
  const emblem = EMBLEMS[badgeKey];
  const radius = 50 * scale;
  // Around the center: scale the 64.8-unit icon box with the disc.
  const around = `translate(100 100) scale(${scale}) translate(-100 -100)`;
  return (
    <>
      <Circle cx={100} cy={100} r={radius} fill={`url(#${gradientId})`} stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={2} />
      <G transform={around}>
        {emblem.icon === "lantern" ? (
          <Lantern white="#FFFFFF" />
        ) : (
          <G transform="translate(67.6 67.6) scale(2.7)">
            {glow > 0 ? (
              <G opacity={0.3}>
                <LucideIcon name={emblem.icon} stroke={BADGE_COLORS.teal} strokeWidth={1.7 + (2 * glow) / 2.7} />
              </G>
            ) : null}
            <LucideIcon
              name={emblem.icon}
              stroke="#FFFFFF"
              strokeWidth={1.7}
              outline={emblem.outline}
              fill={emblem.fill}
              accent={BADGE_COLORS.yellow}
            />
            {emblem.coin ? <Circle cx={15.6} cy={3.4} r={2.8} fill={BADGE_COLORS.yellow} /> : null}
          </G>
        )}
      </G>
    </>
  );
}

/** A 48-point stamp edge: outer and inner radius alternating. */
function stampPoints(outer: number, inner: number) {
  const points: string[] = [];
  for (let i = 0; i < 96; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI * 2 * i) / 96 - Math.PI / 2;
    points.push(`${(100 + r * Math.cos(angle)).toFixed(2)},${(100 + r * Math.sin(angle)).toFixed(2)}`);
  }
  return points.join(" ");
}

export function Badge({ badgeKey, kind, stage, size, earned = stage > 0, count = 0, label, tier: forcedTier }: Props) {
  const spoken = useBadgeLabel();
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const tier = forcedTier ?? tierFor(size);
  const small = tier !== "large";
  const accessibility =
    label === false
      ? { accessible: false, importantForAccessibility: "no-hide-descendants" as const }
      : {
          accessible: true,
          accessibilityRole: "image" as const,
          accessibilityLabel: label ?? spoken(badgeKey, kind, stage, count, earned),
        };

  const discGradient = (
    <RadialGradient id={`disc${id}`} cx="35%" cy="30%" r="80%">
      <Stop offset="0" stopColor={BADGE_COLORS.deep} />
      <Stop offset="1" stopColor={BADGE_COLORS.midnight} />
    </RadialGradient>
  );

  if (!earned) {
    const stampRadii = small ? [90, 82] : [84, 76];
    return (
      <Svg width={size} height={size} viewBox="0 0 200 200" testID={`badge-${badgeKey}`} {...accessibility}>
        <Defs>{discGradient}</Defs>
        {kind === "keepsake" ? (
          <Polygon
            points={stampPoints(stampRadii[0], stampRadii[1])}
            fill="none"
            stroke={BADGE_COLORS.yellow}
            strokeOpacity={0.25}
            strokeWidth={small ? 4 : 2.5}
          />
        ) : null}
        <G opacity={0.35}>
          <Emblem
            badgeKey={badgeKey}
            scale={kind === "keepsake" && small ? 56 / 50 : small ? 1.08 : 1}
            gradientId={`disc${id}`}
            glow={0}
          />
        </G>
      </Svg>
    );
  }

  if (kind === "keepsake") {
    return (
      <Svg width={size} height={size} viewBox="0 0 200 200" testID={`badge-${badgeKey}`} {...accessibility}>
        <Defs>{discGradient}</Defs>
        <Polygon
          points={small ? stampPoints(90, 82) : stampPoints(84, 76)}
          fill={BADGE_COLORS.midnight}
          stroke={BADGE_COLORS.yellow}
          strokeWidth={small ? 4 : 2.5}
        />
        {!small ? (
          <Circle
            cx={100}
            cy={100}
            r={66}
            fill="none"
            stroke={BADGE_COLORS.yellow}
            strokeOpacity={0.5}
            strokeWidth={1.5}
            strokeDasharray="2 4"
          />
        ) : null}
        <Emblem badgeKey={badgeKey} scale={small ? 56 / 50 : 1} gradientId={`disc${id}`} glow={0} />
      </Svg>
    );
  }

  // Growth, earned.
  const level = Math.min(Math.max(stage, 1), 5);
  const grove = level === 5;
  const ring = small ? { r: 70, width: 9 } : { r: 72, width: 7 };
  const circumference = 2 * Math.PI * ring.r;
  const arc = grove ? undefined : `${(circumference * level) / 5} ${circumference}`;
  const ringColor = grove ? `url(#prism${id})` : BADGE_COLORS.teal;
  const blur = GLOW_BLUR[level - 1];
  const pip = tier === "large" ? { cy: 172, r: 15, stroke: 2.5, icon: 20, iconStroke: 2.4 } : { cy: 170, r: 21, stroke: 3.2, icon: 29, iconStroke: 2.3 };
  const arcProps = {
    cx: 100,
    cy: 100,
    r: ring.r,
    fill: "none",
    strokeLinecap: "round" as const,
    strokeDasharray: arc,
    // Start at the bottom and fill clockwise.
    transform: "rotate(90 100 100)",
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" testID={`badge-${badgeKey}`} {...accessibility}>
      <Defs>
        <RadialGradient id={`halo${id}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={BADGE_COLORS.purple} stopOpacity={0.15 + 0.08 * (level - 1)} />
          <Stop offset="1" stopColor={BADGE_COLORS.purple} stopOpacity={0} />
        </RadialGradient>
        <LinearGradient id={`prism${id}`} x1="0" y1="0" x2="200" y2="200" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={BADGE_COLORS.teal} />
          <Stop offset="0.35" stopColor={BADGE_COLORS.purple} />
          <Stop offset="0.7" stopColor={BADGE_COLORS.pink} />
          <Stop offset="1" stopColor={BADGE_COLORS.yellow} />
        </LinearGradient>
        {discGradient}
      </Defs>
      <Circle cx={100} cy={100} r={96} fill={`url(#halo${id})`} />
      <Circle cx={100} cy={100} r={ring.r} fill="none" stroke="#FFFFFF" strokeOpacity={0.12} strokeWidth={ring.width} />
      <Circle {...arcProps} stroke={ringColor} strokeOpacity={0.3} strokeWidth={ring.width + 2 * blur} />
      <Circle {...arcProps} stroke={ringColor} strokeWidth={ring.width} testID={`badge-arc-${level}`} />
      <Emblem badgeKey={badgeKey} scale={small ? 1.08 : 1} gradientId={`disc${id}`} glow={blur} />
      {tier !== "list" ? (
        <G testID="badge-pip">
          <Circle cx={100} cy={pip.cy} r={pip.r} fill={BADGE_COLORS.midnight} stroke={ringColor} strokeWidth={pip.stroke} />
          <G transform={`translate(${100 - pip.icon / 2} ${pip.cy - pip.icon / 2}) scale(${pip.icon / 24})`}>
            <LucideIcon name={STAGE_PIP_ICONS[level - 1]} stroke={BADGE_COLORS.yellow} strokeWidth={pip.iconStroke} />
          </G>
        </G>
      ) : null}
    </Svg>
  );
}
