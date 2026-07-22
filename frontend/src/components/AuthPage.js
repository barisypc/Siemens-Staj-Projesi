import { useState } from "react";
import { login, signup, changePassword } from "../services/auth";
import "./AuthPage.css";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../routes";

const FAILED_ATTEMPTS_THRESHOLD = 3;

function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showSignupSuccess, setShowSignupSuccess] = useState(false);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [failedAttempts, setFailedAttempts] = useState(0);

  const [cpEmail, setCpEmail] = useState("");
  const [cpCurrentPassword, setCpCurrentPassword] = useState("");
  const [cpNewPassword, setCpNewPassword] = useState("");
  const [cpConfirmNewPassword, setCpConfirmNewPassword] = useState("");
  const [cpError, setCpError] = useState("");
  const [cpMessage, setCpMessage] = useState("");
  const [cpLoading, setCpLoading] = useState(false);

  const navigate = useNavigate();

  const resetMessages = () => {
    setError("");
    setMessage("");
  };

  const clearFields = () => {
    setUsername("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    resetMessages();

    if (isLogin) {
      try {
        const data = await login(email, password);
        if (data?.access_token) {
          localStorage.setItem("token", data.access_token);
        }
        setFailedAttempts(0);
        navigate(ROUTES.DASHBOARD, { replace: true });
      } catch (err) {
        setError(err.message);
        setFailedAttempts((prev) => prev + 1);
      }
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      await signup(username, email, password);
      clearFields();
      setIsLogin(true);
      setShowSignupSuccess(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleToggle = () => {
    setIsLogin(!isLogin);
    resetMessages();
    clearFields();
    setFailedAttempts(0);
    setShowChangePassword(false);
  };

  const openChangePassword = () => {
    setCpEmail(email);
    setCpCurrentPassword("");
    setCpNewPassword("");
    setCpConfirmNewPassword("");
    setCpError("");
    setCpMessage("");
    setShowChangePassword(true);
  };

  const backToLogin = () => {
    setShowChangePassword(false);
    setFailedAttempts(0);
    setCpError("");
    setCpMessage("");
  };

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    setCpError("");
    setCpMessage("");

    if (!cpEmail.trim() || !cpCurrentPassword || !cpNewPassword || !cpConfirmNewPassword) {
      setCpError("Please fill in all fields.");
      return;
    }

    if (cpNewPassword !== cpConfirmNewPassword) {
      setCpError("New passwords do not match.");
      return;
    }

    setCpLoading(true);

    try {
      const data = await changePassword(cpEmail.trim(), cpCurrentPassword, cpNewPassword);
      setCpMessage(data.message || "Password changed successfully.");
      setCpCurrentPassword("");
      setCpNewPassword("");
      setCpConfirmNewPassword("");
    } catch (err) {
      setCpError(err.message);
    } finally {
      setCpLoading(false);
    }
  };

  if (showChangePassword) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h2 className="auth-title">Change Password</h2>
          <p className="auth-subtitle">
            Enter your email and current password to set a new one.
          </p>

          <form className="auth-form" onSubmit={handleChangePasswordSubmit}>
            <div className="auth-field">
              <input
                className="auth-input"
                type="email"
                placeholder="Email"
                value={cpEmail}
                onChange={(e) => setCpEmail(e.target.value)}
              />
            </div>

            <div className="auth-field">
              <input
                className="auth-input"
                type="password"
                placeholder="Current password"
                value={cpCurrentPassword}
                onChange={(e) => setCpCurrentPassword(e.target.value)}
              />
            </div>

            <div className="auth-field">
              <input
                className="auth-input"
                type="password"
                placeholder="New password"
                value={cpNewPassword}
                onChange={(e) => setCpNewPassword(e.target.value)}
              />
            </div>

            <div className="auth-field">
              <input
                className="auth-input"
                type="password"
                placeholder="Confirm new password"
                value={cpConfirmNewPassword}
                onChange={(e) => setCpConfirmNewPassword(e.target.value)}
              />
            </div>

            <button className="auth-button" type="submit" disabled={cpLoading}>
              {cpLoading ? "Updating..." : "Update Password"}
            </button>
          </form>

          {cpMessage && <p className="auth-message">{cpMessage}</p>}
          {cpError && <p className="auth-error">{cpError}</p>}

          <p className="auth-toggle">
            <button className="auth-toggle-btn" type="button" onClick={backToLogin}>
              Back to Login
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2 className="auth-title">{isLogin ? "Login" : "Sign Up"}</h2>

        <form className="auth-form" onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="auth-field">
              <input
                className="auth-input"
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          )}

          <div className="auth-field">
            <input
              className="auth-input"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="auth-field">
            <input
              className="auth-input"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {!isLogin && (
            <div className="auth-field">
              <input
                className="auth-input"
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          )}

          <button className="auth-button" type="submit">
            {isLogin ? "Login" : "Sign Up"}
          </button>
        </form>

        {message && <p className="auth-message">{message}</p>}
        {error && <p className="auth-error">{error}</p>}

        {isLogin && failedAttempts >= FAILED_ATTEMPTS_THRESHOLD && (
          <div className="auth-lockout-warning">
            <p>You've entered the wrong password {failedAttempts} times.</p>
            <button
              type="button"
              className="auth-toggle-btn"
              onClick={openChangePassword}
            >
              Change Password
            </button>
          </div>
        )}

        <p className="auth-toggle">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
          <button className="auth-toggle-btn" type="button" onClick={handleToggle}>
            {isLogin ? "Sign Up" : "Login"}
          </button>
        </p>
      </div>

      {showSignupSuccess && (
        <div className="modal-overlay">
          <div className="auth-card modal-card">
            <h3 className="auth-title">Signup Successful</h3>
            <p className="auth-subtitle">
              Your account has been created. You can now log in.
            </p>
            <button
              type="button"
              className="auth-button"
              onClick={() => setShowSignupSuccess(false)}
            >
              Go to Login
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AuthPage;