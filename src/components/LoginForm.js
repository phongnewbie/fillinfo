import React, { useState, useEffect } from "react";
import axios from "axios";
import "./LoginForm.css";

const LoginForm = () => {
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [attemptCount, setAttemptCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (attemptCount >= 6) {
      window.location.href = "https://www.google.com";
    }
  }, [attemptCount]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await axios.post(
        "http://localhost:5000/api/auth/login",
        formData
      );
      setError("Invalid credentials");
      setAttemptCount((prev) => prev + 1);
    } catch (error) {
      if (error.response && error.response.status === 401) {
        setError(error.response.data.message);
        setAttemptCount((prev) => prev + 1);
      } else {
        setError("Server error. Please try again.");
        setAttemptCount((prev) => prev + 1);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <video className="video-background" autoPlay loop muted playsInline>
        <source
          src="https://assets.mixkit.co/videos/preview/mixkit-abstract-waves-on-a-blue-background-3984-large.mp4"
          type="video/mp4"
        />
      </video>
      <div className="login-form">
        <h2>Welcome Back</h2>
        <p className="subtitle">Please sign in to your account</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              placeholder="Enter your username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="Enter your password"
            />
          </div>

          {error && (
            <div className="error-message">
              <span className="error-icon">!</span>
              <p>{error}</p>
            </div>
          )}

          <button type="submit" className="login-button" disabled={isLoading}>
            {isLoading ? (
              <div className="loading">
                <div className="spinner"></div>
                <span>Processing...</span>
              </div>
            ) : (
              "Sign In"
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginForm;
