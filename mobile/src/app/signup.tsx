import * as WebBrowser from "expo-web-browser";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";

import { signup } from "../api";
import { EmailPasswordForm } from "../components/EmailPasswordForm";
import { MINIMUM_AGE, PRIVACY_URL, TERMS_URL } from "../config";
import { useLanguage } from "../language";
import { space } from "../theme";
import { Caption, TextLink } from "../ui";

export default function Signup() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  return (
    <EmailPasswordForm
      title={t("auth.signup_title")}
      buttonTitle={t("auth.signup_button")}
      hint={t("auth.password_hint")}
      screen="join/signup"
      // The language picked before signing up is saved on the new account.
      submit={(email, password) => signup(email, password, language)}
      // Agreeing to the terms and the minimum age (App Store rule for apps
      // where people post; docs/RELEASE_CHECKLIST.md).
      agreement={
        <View>
          <Caption>{t("auth.agreement", { age: MINIMUM_AGE })}</Caption>
          <View style={styles.links}>
            <TextLink label={t("settings.terms_of_use")} onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)} />
            <TextLink label={t("settings.privacy_policy")} onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)} />
          </View>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  links: { flexDirection: "row", flexWrap: "wrap", columnGap: space.m },
});
