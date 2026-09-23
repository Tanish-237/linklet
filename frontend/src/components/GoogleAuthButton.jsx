import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { apiClient } from "../api/apiClient";
import useAuthStore from "../store/useAuthStore";
import { loadGoogleIdentity } from "../utlis/loadGoogleIdentity";

const GoogleAuthButton = ({ mode = "signin" }) => {
  const navigate = useNavigate();
  const setUser = useAuthStore((state) => state.setUser);
  const buttonContainerRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);

  const clientId = (
    import.meta.env.VITE_GOOGLE_CLIENT_ID ||
    "449590289544-gaec5akha40094k14peo3g98giqedspg.apps.googleusercontent.com"
  )
    .replace(/^["']|["']$/g, "")
    .trim();

  const handleCredentialResponse = async (response) => {
    if (!response || !response.credential) {
      toast.error("Google authentication failed. Please try again.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiClient.post("/auth/google", {
        credential: response.credential,
      });

      if (res.status === 200 || res.status === 201) {
        if (res.data?.user) {
          setUser(res.data.user);
        }
        toast.success(
          mode === "signup"
            ? "Welcome to Linklet!"
            : "Welcome back to Linklet!"
        );
        navigate("/home");
      }
    } catch (error) {
      console.error("Google OAuth API error:", error);
      const serverMessage = error.response?.data?.message;
      let displayMessage =
        "Only official @mnnit.ac.in institutional accounts are allowed. Please sign in using your college email ID.";

      if (
        serverMessage &&
        serverMessage !== "Unauthorized request" &&
        serverMessage !== "Invalid access token"
      ) {
        displayMessage = serverMessage;
      }
      toast.error(displayMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!clientId) return;

    const setupGsi = () => {
      if (window.google?.accounts?.id && buttonContainerRef.current) {
        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true,
          });

          window.google.accounts.id.renderButton(buttonContainerRef.current, {
            type: "standard",
            theme: "outline",
            size: "large",
            text: mode === "signup" ? "signup_with" : "continue_with",
            shape: "rectangular",
            logo_alignment: "left",
            width: buttonContainerRef.current.offsetWidth || 380,
          });
        } catch (err) {
          console.warn("Error rendering Google Sign-In button:", err);
        }
      }
    };

    let cancelled = false;

    if (window.google?.accounts?.id) {
      setupGsi();
    } else {
      // Fetch Google's script only now that a Google button is actually on screen.
      loadGoogleIdentity()
        .then(() => {
          if (!cancelled) setupGsi();
        })
        .catch((err) => console.warn("Google Sign-In unavailable:", err.message));
    }

    return () => {
      cancelled = true;
    };
    // Initialise Google Identity once per client/mode; re-running it on every
    // render (handleCredentialResponse is recreated each time) would re-render
    // Google's button over and over.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, mode]);

  const handleManualPrompt = () => {
    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
    } else {
      // Not loaded yet (or blocked) — kick off / retry the load and ask the user to try again.
      loadGoogleIdentity().catch(() => {});
      toast.info("Connecting to Google Services... please click again in a moment.");
    }
  };

  return (
    <div className="relative w-full mb-6">
      {/* 100% Full-width visual button matching Linklet inputs */}
      <button
        type="button"
        data-testid="google-fallback-btn"
        onClick={handleManualPrompt}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-surface-2 hover:bg-surface-3 border border-line-strong text-fg font-semibold rounded-xl transition-all duration-200 shadow-sm cursor-pointer disabled:opacity-50"
      >
        {isLoading ? (
          <div className="w-5 h-5 border-2 border-fg-muted border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
        )}
        <span>
          {mode === "signup" ? "Sign up with Google" : "Continue with Google"}
        </span>
      </button>

      {/* Invisible GSI overlay capturing clicks across the entire width */}
      <div
        ref={buttonContainerRef}
        data-testid="google-button-container"
        className="absolute inset-0 w-full h-full opacity-[0.001] overflow-hidden cursor-pointer pointer-events-auto flex items-center justify-center [&>div]:w-full [&>div]:h-full [&_iframe]:!w-full [&_iframe]:!h-full [&_iframe]:!scale-150"
      />
    </div>
  );
};

export default GoogleAuthButton;
