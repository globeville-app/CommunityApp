import { useTranslation } from "react-i18next";

import { signup } from "../api";
import { EmailPasswordForm } from "../components/EmailPasswordForm";
import { useLanguage } from "../language";

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
    />
  );
}
