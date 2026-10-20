import { router } from "expo-router";
import { useTranslation } from "react-i18next";

import { login } from "../api";
import { EmailPasswordForm } from "../components/EmailPasswordForm";
import { TextLink } from "../ui";

export default function Login() {
  const { t } = useTranslation();
  return (
    <EmailPasswordForm
      title={t("auth.login_title")}
      buttonTitle={t("auth.login_button")}
      screen="join/login"
      submit={login}
      links={<TextLink label={t("auth.forgot_link")} onPress={() => router.push("/forgot-password")} />}
    />
  );
}
