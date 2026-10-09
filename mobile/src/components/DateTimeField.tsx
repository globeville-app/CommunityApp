/**
 * A date or a time, with the phone's own picker. Values are Denver
 * wall-clock strings ("2026-10-24", "18:00"); the picker only borrows a JS
 * Date to show them, so the phone's time zone doesn't matter.
 */
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { useLanguage } from "../language";
import { colors, MIN_TOUCH, radius, type } from "../theme";

type Props = { label: string; mode: "date" | "time"; value: string; onChange: (value: string) => void };

const pad = (n: number) => String(n).padStart(2, "0");

// How Android shows the chosen value on its button.
const FORMATS: Record<"date" | "time", Intl.DateTimeFormatOptions> = {
  date: { dateStyle: "medium" },
  time: { timeStyle: "short" },
};

function toDate(mode: "date" | "time", value: string) {
  const now = new Date();
  if (mode === "date") {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y || now.getFullYear(), (m || 1) - 1, d || 1, 12, 0);
  }
  const [h, min] = value.split(":").map(Number);
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), h || 0, min || 0);
}

function fromDate(mode: "date" | "time", date: Date) {
  return mode === "date"
    ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    : `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function DateTimeField({ label, mode, value, onChange }: Props) {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const date = toDate(mode, value);

  function handle(event: DateTimePickerEvent, picked?: Date) {
    setOpen(false);
    if (event.type === "set" && picked) onChange(fromDate(mode, picked));
  }

  const picker = (
    <DateTimePicker
      value={date}
      mode={mode}
      display={Platform.OS === "ios" ? "compact" : "default"}
      onChange={handle}
      locale={`${language}-US`}
      themeVariant="dark"
      accessibilityLabel={label}
      minuteInterval={5}
    />
  );

  return (
    <View style={styles.row}>
      <Text style={[type.label, styles.label]}>{label}</Text>
      {Platform.OS === "ios" ? (
        picker
      ) : (
        <>
          {/* Android opens its picker as a dialog from this button. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={() => setOpen(true)}
            style={styles.button}
          >
            <Text style={[type.body, styles.value]}>
              {new Intl.DateTimeFormat(`${language}-US`, FORMATS[mode]).format(date)}
            </Text>
          </Pressable>
          {open ? picker : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: MIN_TOUCH },
  label: { color: colors.textSoft, flexShrink: 1 },
  button: {
    minHeight: MIN_TOUCH,
    paddingHorizontal: 16,
    justifyContent: "center",
    borderRadius: radius.card,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  value: { color: colors.textPrimary },
});
