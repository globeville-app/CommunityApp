/**
 * A category as a pill in its group's accent color: faint when read-only
 * (event cards, profile interests), filled when selected in a picker.
 */
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { accentFor, categoryLabel } from "../categories";
import { alpha, colors, MIN_TOUCH, type } from "../theme";

type Props = {
  category: string;
  group: string | null;
  otherText?: string | null;
  selected?: boolean;
  /** Makes it a toggle (pickers). Without it, it's just a label. */
  onPress?: () => void;
  small?: boolean;
};

export function CategoryChip({ category, group, otherText, selected, onPress, small }: Props) {
  const { t } = useTranslation();
  const accent = accentFor(group);
  const label = categoryLabel(t, category, otherText);
  const look = [
    styles.chip,
    small && styles.small,
    { backgroundColor: selected ? accent : alpha(accent, 0.22), borderColor: alpha(accent, selected ? 1 : 0.5) },
  ];
  const text = <Text style={[type.label, small && styles.smallText, { color: selected ? colors.base : colors.textPrimary }]}>{label}</Text>;
  if (!onPress) return <View style={look}>{text}</View>;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: !!selected }}
      onPress={onPress}
      style={({ pressed }) => [look, styles.touch, pressed && { opacity: 0.7 }]}
    >
      {text}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    justifyContent: "center",
  },
  touch: { minHeight: MIN_TOUCH },
  small: { paddingHorizontal: 10, paddingVertical: 4 },
  smallText: { fontSize: 12 },
});
