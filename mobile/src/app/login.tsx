import { login } from "../api";
import { EmailPasswordForm } from "../components/EmailPasswordForm";

export default function Login() {
  return <EmailPasswordForm title="Welcome back" buttonTitle="Log in" submit={login} />;
}
