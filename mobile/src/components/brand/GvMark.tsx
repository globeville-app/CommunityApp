/**
 * The small "gv" mark (for globeville) for tight spaces such as a tab bar (design/BRAND.md).
 */
import Svg, { Path } from "react-native-svg";

import { APP_NAME } from "../../config";
import { colors } from "../../theme";
import { MONOGRAM } from "./logoPaths";

export function GvMark({ height = 20 }: { height?: number }) {
  const width = (height * MONOGRAM.width) / MONOGRAM.height;
  return (
    <Svg
      width={width}
      height={height}
      viewBox={MONOGRAM.viewBox}
      accessible
      accessibilityRole="image"
      accessibilityLabel={APP_NAME}
    >
      {MONOGRAM.paths.map((d, i) => (
        <Path key={i} d={d} fill={colors.textPrimary} />
      ))}
    </Svg>
  );
}
