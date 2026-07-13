import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import styles from "./sign-out-button.module.scss";

export function SignOutButton() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  function onSignOut() {
    logout();
    navigate("/login");
  }

  return (
    <Button type="button" variant="ghost" className={styles.btn} onClick={onSignOut}>
      Sign out
    </Button>
  );
}
