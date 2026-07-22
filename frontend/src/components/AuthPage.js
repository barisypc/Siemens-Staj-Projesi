import { useState } from "react";
import { login, signup } from "../services/auth";
import "./AuthPage.css";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../routes"; 

function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const navigate = useNavigate();

  const resetMessages = () => {
    setError("");
    setMessage("");
  };

  const clearFields = () => {
    setUsername("");
    setEmail("");
    setPassword("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    resetMessages();

    try {
      if (isLogin) {
        const data = await login(email, password);
        if (data?.access_token) {
          localStorage.setItem("token", data.access_token);
        }
        navigate(ROUTES.DASHBOARD, { replace: true }); // ✅ Using ROUTES constant
        return;
      } else {
        await signup(username, email, password);
        setMessage("Signup successful. Please login.");
        setIsLogin(true);
      }

      clearFields();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleToggle = () => {
    setIsLogin(!isLogin);
    resetMessages();
    clearFields();
  };

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

          <button className="auth-button" type="submit">
            {isLogin ? "Login" : "Sign Up"}
          </button>
        </form>

        {message && <p className="auth-message">{message}</p>}
        {error && <p className="auth-error">{error}</p>}

        <p className="auth-toggle">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
          <button className="auth-toggle-btn" type="button" onClick={handleToggle}>
            {isLogin ? "Sign Up" : "Login"}
          </button>
        </p>
      </div>
    </div>
  );
}

export default AuthPage;