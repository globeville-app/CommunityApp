/** One organization in a list: photo, name and type (and status for its admins). */
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { OrgStatus, OrgSummary } from "../api";
import { colors, space, type } from "../theme";
import { Avatar, Divider } from "../ui";

export function OrgRow({
  org,
  status,
  divider,
  onPress,
}: {
  org: OrgSummary;
  status?: OrgStatus;
  divider?: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View>
      {divider ? <Divider /> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={org.name}
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
      >
        <Avatar uri={org.photo_url} initial={org.name.slice(0, 1).toUpperCase()} size={44} />
        <View style={{ flex: 1 }}>
          <Text style={[type.body, { color: colors.textPrimary }]}>{org.name}</Text>
          <Text style={[type.caption, { color: colors.textSecondary }]}>
            {t(`organizations.types.${org.type}`)}
            {status && status !== "approved" ? ` · ${t(`organizations.status.${status}`)}` : ""}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.s, minHeight: 56, paddingVertical: 6 },
});
