import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import linkletLogo from "../assets/linklet-logo.webp";
import { apiClient } from "../api/apiClient";
import { isStrongPassword, PASSWORD_POLICY_MESSAGE, PASSWORD_POLICY_HINT } from "../utlis/passwordPolicy";
import SEO from "../components/SEO";
import ThemeToggle from "../theme/ThemeToggle";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState(1); // 1: request OTP, 2: enter OTP & new pass
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!email || !email.toLowerCase().endsWith("@mnnit.ac.in")) {
      toast.error("Please enter a valid @mnnit.ac.in institutional email");
      return;
    }

    try {
      setIsLoading(true);
      const res = await apiClient.post("/auth/forgot-password-otp", { email: email.trim() });
      if (res.data?.success) {
        toast.success(res.data.message || "Reset OTP sent to your email!");
        setStep(2);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to send reset code");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!otp.trim()) {
      toast.error("Please enter the 6-digit OTP code");
      return;
    }

    if (!isStrongPassword(newPassword)) {
      toast.error(PASSWORD_POLICY_MESSAGE);
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    try {
      setIsLoading(true);
      const res = await apiClient.post("/auth/reset-password", {
        email: email.trim(),
        otp: otp.trim(),
        newPassword,
      });

      if (res.data?.success) {
        toast.success("Password reset successfully! You can now log in.");
        navigate("/login");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to reset password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 w-full h-full overflow-y-auto bg-canvas text-fg">
      {/* Sign-in screens have no search value; noindex keeps them out of results. */}
      <SEO title="Reset your password | Linklet" description="Reset your Linklet password using your MNNIT email address." path="/forgot-password" noindex />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-surface/80 backdrop-blur-md shadow-soft border-b border-line">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-3">
              <img src={linkletLogo} alt="Linklet Logo" className="h-10 w-10" />
              <span className="text-2xl font-semibold tracking-tight text-fg">
                Linklet
              </span>
            </Link>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Link
                to="/login"
                className="px-4 py-2 rounded-lg hover:bg-accent-soft transition-all border border-accent/30 hover:border-accent text-fg-secondary hover:text-fg"
              >
                Back to Login
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="w-full min-h-screen pt-16 flex items-center justify-center p-4">
        <div className="w-full max-w-md mx-auto">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent-soft border border-accent/30 text-accent-fg mb-3">
              <span className="material-icons text-3xl">lock_reset</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-fg mb-2">
              {step === 1 ? "Forgot Password?" : "Set New Password"}
            </h1>
            <p className="text-sm text-fg-secondary">
              {step === 1
                ? "Enter your @mnnit.ac.in email address to receive a secure password reset code."
                : `Enter the 6-digit code sent to ${email} and your new password.`}
            </p>
          </div>

          <div className="bg-surface/70 backdrop-blur-xl rounded-2xl border border-line p-6 sm:p-8 shadow-pop">
            {step === 1 ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label htmlFor="reset-email" className="block text-sm font-medium text-fg-secondary mb-1">
                    MNNIT Institutional Email
                  </label>
                  <input
                    id="reset-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="student.20231111@mnnit.ac.in"
                    className="w-full px-4 py-3 bg-surface-2 border border-line-strong focus:border-accent focus:ring-2 focus:ring-accent/20 rounded-xl outline-none text-fg transition-all text-sm"
                  />
                </div>

                <button
                  id="send-reset-code-btn"
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white rounded-xl font-medium tracking-wide shadow-sm transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isLoading ? "Sending Code..." : "Send Reset Code"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label htmlFor="reset-otp" className="block text-sm font-medium text-fg-secondary mb-1">
                    6-Digit Verification Code
                  </label>
                  <input
                    id="reset-otp"
                    type="text"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    required
                    placeholder="123456"
                    className="w-full px-4 py-3 bg-surface-2 border border-line-strong focus:border-accent focus:ring-2 focus:ring-accent/20 rounded-xl outline-none text-fg text-center font-mono tracking-widest text-lg transition-all"
                  />
                </div>

                <div>
                  <label htmlFor="reset-new-password" className="block text-sm font-medium text-fg-secondary mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      id="reset-new-password"
                      type={showPassword ? "text" : "password"}
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      placeholder={PASSWORD_POLICY_HINT}
                      className="w-full px-4 py-3 bg-surface-2 border border-line-strong focus:border-accent focus:ring-2 focus:ring-accent/20 rounded-xl outline-none text-fg transition-all text-sm pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg cursor-pointer"
                      aria-label="Toggle password visibility"
                    >
                      <span className="material-icons text-base">
                        {showPassword ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="reset-confirm-password" className="block text-sm font-medium text-fg-secondary mb-1">
                    Confirm New Password
                  </label>
                  <input
                    id="reset-confirm-password"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Re-type new password"
                    className="w-full px-4 py-3 bg-surface-2 border border-line-strong focus:border-accent focus:ring-2 focus:ring-accent/20 rounded-xl outline-none text-fg transition-all text-sm"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="w-1/3 py-3 px-3 bg-surface-2 hover:bg-surface-3 text-fg-secondary rounded-xl font-medium text-sm transition cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    id="reset-password-submit-btn"
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 py-3 px-4 bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white rounded-xl font-medium tracking-wide shadow-sm transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer text-sm"
                  >
                    {isLoading ? "Resetting..." : "Reset Password"}
                  </button>
                </div>
              </form>
            )}

            <div className="mt-6 pt-4 border-t border-line text-center">
              <Link to="/login" className="text-sm text-accent-fg hover:text-accent-fg font-medium">
                Remember your password? Log in
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
