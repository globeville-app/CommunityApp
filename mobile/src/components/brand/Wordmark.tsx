/**
 * The logo: "globeville" in lowercase letter outlines (design/BRAND.md).
 * Drawn from vector paths, not live text, so it never shifts while fonts load.
 * Screen readers read the app name from shared/app_config.json.
 */
import Svg, { Path } from "react-native-svg";

import { APP_NAME } from "../../config";
import { colors } from "../../theme";
import { WORDMARK } from "./logoPaths";

type Props = {
  /** Height in points. Below 18 use <GvMark /> instead. */
  height?: number;
  color?: "white" | "midnight";
};

export function Wordmark({ height = 40, color = "white" }: Props) {
  const width = (height * WORDMARK.width) / WORDMARK.height;
  const fill = color === "white" ? colors.textPrimary : colors.base;
  return (
    <Svg
      width={width}
      height={height}
      viewBox={WORDMARK.viewBox}
      accessible
      accessibilityRole="image"
      accessibilityLabel={APP_NAME}
    >
      {WORDMARK.paths.map((d, i) => (
        <Path key={i} d={d} fill={fill} />
      ))}
    </Svg>
  );
}
