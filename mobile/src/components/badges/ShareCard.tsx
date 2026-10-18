/**
 * The share card (docs/BADGE_UI.md §3), laid out in design units on a
 * 360 × 360 card and scaled to `size`. The exported image is 1080 × 1080
 * with square corners; the on-screen preview has rounded corners.
 *
 * PRIVACY: only the first name, the badge, and (if the member keeps it on)
 * the neighborhood. Never a last name, photo, address, event or other
 * member.
 */
import { forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import type { BadgeData } from "../../apiTypes";
import { badgeName, countLine, stageName } from "../../badges";
import { INVITE_URL } from "../../config";
import { fonts } from "../../theme";
import { Wordmark } from "../brand/Wordmark";
import { Badge, BADGE_COLORS } from "./Badge";

const BACKGROUND = "#160B33";
// [color, opacity, center x %, center y %, width %, height %]
const GLOWS: [string, number, number, number, number, number][] = [
  [BADGE_COLORS.teal, 0.35, 15, 10, 60, 45],
  [BADGE_COLORS.pink, 0.3, 90, 25, 55, 45],
  [BADGE_COLORS.purple, 0.55, 50, 100, 70, 55],
  [BADGE_COLORS.yellow, 0.18, 80, 90, 40, 30],
];

type Props = {
  badge: BadgeData;
  firstName: string;
  /** null when "Show my neighborhood" is off. */
  neighborhood: string | null;
  size: number;
  rounded?: boolean;
};

/** The invite link without "https://", as printed on the card. */
export const INVITE_HOST = INVITE_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");

export const ShareCard = forwardRef<View, Props>(function ShareCard({ badge, firstName, neighborhood, size, rounded }, ref) {
  const { t } = useTranslation();
  const u = size / 360; // one design unit
  const name = badgeName(t, badge.key);
  const growth = badge.kind === "growth";
  const units = countLine(t, badge.key, badge.count);
  const countText = neighborhood ? t("share.count_in", { amount: units, neighborhood }) : units;
  const cta = t("share.cta", { url: "|" }).split("|");

  return (
    <View
      ref={ref}
      collapsable={false}
      testID="share-card"
      style={{ width: size, height: size, borderRadius: rounded ? 22 * u : 0, overflow: "hidden", backgroundColor: BACKGROUND }}
    >
      <Svg width={size} height={size} viewBox="0 0 360 360" style={StyleSheet.absoluteFill}>
        <Defs>
          {GLOWS.map(([color, opacity, x, y, w, h], i) => (
            <RadialGradient
              key={i}
              id={`glow${i}`}
              cx={(x / 100) * 360}
              cy={(y / 100) * 360}
              rx={(w / 100) * 180}
              ry={(h / 100) * 180}
              fx={(x / 100) * 360}
              fy={(y / 100) * 360}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor={color} stopOpacity={opacity} />
              <Stop offset="0.7" stopColor={color} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {GLOWS.map((_, i) => (
          <Rect key={i} x={0} y={0} width={360} height={360} fill={`url(#glow${i})`} />
        ))}
        <Rect x={0.5} y={0.5} width={359} height={359} rx={rounded ? 22 : 0} fill="none" stroke="#FFFFFF" strokeOpacity={0.1} strokeWidth={1} />
      </Svg>

      <View style={{ flex: 1, paddingTop: 20 * u, paddingBottom: 20 * u, paddingHorizontal: 22 * u }}>
        <Wordmark height={18 * u} />
        <View style={{ alignItems: "center", marginTop: 4 * u }}>
          <Badge badgeKey={badge.key} kind={badge.kind} stage={badge.stage} count={badge.count} size={150 * u} tier="large" label={false} />
          <Text style={{ fontFamily: fonts.medium, fontSize: 14 * u, color: BADGE_COLORS.yellow }}>
            {t("share.earned", { name: firstName })}
          </Text>
          <Text
            style={{ fontFamily: fonts.semibold, fontSize: 27 * u, letterSpacing: -0.27 * u, color: "#FFFFFF", textAlign: "center" }}
            numberOfLines={2}
            adjustsFontSizeToFit
          >
            {name}
          </Text>
          {growth ? (
            <>
              <View
                style={{
                  marginTop: 7 * u,
                  paddingVertical: 3 * u,
                  paddingHorizontal: 11 * u,
                  borderRadius: 999,
                  backgroundColor: "rgba(46,230,214,0.16)",
                  borderWidth: Math.max(1, u),
                  borderColor: "rgba(46,230,214,0.55)",
                }}
              >
                <Text style={{ fontFamily: fonts.medium, fontSize: 12 * u, color: "#8FF3EA" }}>{stageName(t, badge.stage)}</Text>
              </View>
              <Text style={{ marginTop: 6 * u, fontFamily: fonts.regular, fontSize: 15 * u, color: "#D9D0F5" }}>{countText}</Text>
            </>
          ) : (
            <Text style={{ marginTop: 6 * u, fontFamily: fonts.regular, fontSize: 15 * u, color: "#D9D0F5", textAlign: "center" }}>
              {t(`badges.${badge.key}.description`)}
            </Text>
          )}
        </View>
        <Text
          style={{
            position: "absolute",
            bottom: 16 * u,
            left: 22 * u,
            right: 22 * u,
            textAlign: "center",
            fontFamily: fonts.regular,
            fontSize: 11.5 * u,
            color: "rgba(255,255,255,0.9)",
          }}
        >
          {cta[0]}
          <Text style={{ fontFamily: fonts.semibold }}>{INVITE_HOST}</Text>
          {cta[1]}
        </Text>
      </View>
    </View>
  );
});
