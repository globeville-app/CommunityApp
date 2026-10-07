import { signup } from "../api";
import { EmailPasswordForm } from "../components/EmailPasswordForm";

export default function Signup() {
  return (
    <EmailPasswordForm
      title="Create your account"
      buttonTitle="Sign up"
      hint="At least 8 characters. Avoid common passwords."
      submit={signup}
    />
  );
}
