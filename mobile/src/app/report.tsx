/**
 * Report a problem (docs/SETTINGS.md). Reachable from Settings and from the
 * "Having trouble?" link on the join screens.
 *
 * PRIVACY: this screen sends only what's typed here, an optional
 * screenshot, and a few technical details (src/report.ts). It never sees
 * other screens' fields: the screen it came from passes just its route name
 * (e.g. "join/address"), never what was typed there.
 */
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Image, View } from "react-native";

import { ApiError, newFormKey, sendProblemReport } from "../api";
import { useAuth } from "../auth";
import { errorMessage } from "../i18n/errors";
import { useLanguage } from "../language";
import { deviceDetails } from "../report";
import { BackButton, Button, Caption, ErrorMessage, Field, Notice, Screen, Title, TextLink } from "../ui";

const MAX_LENGTH = 1000;
const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
// How long "Thanks! We got it." shows before going back.
const THANKS_MS = 1800;

type Screenshot = { uri: string; mimeType: string };

export default function Report() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const { language } = useLanguage();
  const { from = "unknown" } = useLocalSearchParams<{ from?: string }>();
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  // Sent with the report: a retry after a lost reply doesn't send it twice.
  const [formKey] = useState(newFormKey);
  const [screenshot, setScreenshot] = useState<Screenshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [sent, setSent] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function pickScreenshot() {
    setError(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7, // makes iPhone HEIC screenshots arrive as JPEG
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      exif: false, // the server strips EXIF anyway
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > MAX_SCREENSHOT_BYTES) {
      setError(new ApiError("bad_image"));
      return;
    }
    setScreenshot({ uri: asset.uri, mimeType: asset.mimeType === "image/png" ? "image/png" : "image/jpeg" });
  }

  async function onSend() {
    const text = message.trim();
    if (!text) {
      setError(new ApiError("message_required"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await sendProblemReport(token, {
        message: text,
        // Members don't need this: the team has their account email.
        contact_email: token ? undefined : email.trim() || undefined,
        screenshot,
        ...deviceDetails(),
        language,
        screen: from,
      }, formKey);
      setSent(true);
      timer.current = setTimeout(() => router.back(), THANKS_MS);
    } catch (e) {
      setError(e as ApiError);
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: "center" }}>
          <Notice message={t("report.sent")} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <BackButton />
      <Title>{t("report.title")}</Title>
      <Field
        label={t("report.message_label")}
        placeholder={t("report.message_placeholder")}
        value={message}
        onChangeText={setMessage}
        multiline
        maxLength={MAX_LENGTH}
      />
      <Caption>{t("report.characters_left", { count: MAX_LENGTH - message.length })}</Caption>

      {screenshot ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Image
            source={{ uri: screenshot.uri }}
            style={{ width: 56, height: 56, borderRadius: 12 }}
            accessibilityLabel={t("report.screenshot_added")}
          />
          <View style={{ flex: 1 }}>
            <TextLink label={t("report.remove_screenshot")} onPress={() => setScreenshot(null)} />
          </View>
        </View>
      ) : null}
      <Button
        title={screenshot ? t("report.change_screenshot") : t("report.add_screenshot")}
        variant="secondary"
        onPress={pickScreenshot}
      />

      {token ? null : (
        <Field
          label={t("report.email_label")}
          icon="mail-outline"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
        />
      )}

      <Caption>{t("report.what_we_send")}</Caption>
      <ErrorMessage message={errorMessage(t, error)} />
      <Button title={t("report.send_button")} onPress={onSend} busy={busy} disabled={!message.trim()} />
    </Screen>
  );
}
