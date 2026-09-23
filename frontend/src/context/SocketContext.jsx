import { createContext, useEffect, useState, useRef } from "react";
import { useAuth } from "./AuthContext";
import { API_BASE_URL } from "../config";
import { refreshAccessToken, isAuthHandshakeError } from "../api/refreshToken";

const AWAY_GRACE_MS = 10_000;

export const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const { user } = useAuth();
  const userRef = useRef(user);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    if (!user?._id) {
      setSocket((prevSocket) => {
        if (prevSocket) {
          prevSocket.disconnect();
        }
        return null;
      });
      return undefined;
    }

    // socket.io-client is loaded on demand: logged-out visitors (landing page,
    // login, legal pages) never open a socket, so they shouldn't download it.
    let cancelled = false;
    let newSocket = null;

    import("socket.io-client").then(({ io }) => {
      // The user may have logged out / the provider unmounted while the chunk loaded.
      if (cancelled) return;

      // The handshake authenticates with the httpOnly access cookie
      // (withCredentials), which the refresh flow keeps current.
      newSocket = io(API_BASE_URL, {
        withCredentials: true,
      });

      let retriedAuthRefresh = false;

      if (newSocket && typeof newSocket.on === "function") {
        const handleSetup = () => {
          retriedAuthRefresh = false;
          if (typeof newSocket.emit === "function") {
            // A socket opened in a background tab is connected but not
            // "online"; say so before registering so it's never announced.
            if (document.hidden) newSocket.emit("presence", { active: false });
            newSocket.emit("setup", userRef.current || user);
          }
        };

        newSocket.on("connect", handleSetup);
        newSocket.on("reconnect", handleSetup);

        // A handshake rejected for an expired/invalid token means the access
        // cookie is stale — the automatic reconnect backoff would eventually
        // retry with the same stale cookie and fail again.
        // Refresh once immediately and force a reconnect so chat/presence
        // recover within a second instead of sitting disconnected.
        newSocket.on("connect_error", async (err) => {
          if (retriedAuthRefresh || !isAuthHandshakeError(err)) return;
          retriedAuthRefresh = true;
          try {
            await refreshAccessToken();
            if (typeof newSocket.connect === "function") {
              newSocket.connect();
            }
          } catch {
            // refreshAccessToken already fired "auth-expired" — nothing
            // more to do here.
          }
        });
      }

      setSocket(newSocket);
    });

    // Online = this tab is in the foreground. Going to the background is
    // reported after a grace period, so a quick tab switch doesn't flicker
    // "offline" for contacts; coming back is reported immediately.
    let awayTimer = null;
    const handleVisibility = () => {
      clearTimeout(awayTimer);
      if (document.hidden) {
        awayTimer = setTimeout(() => newSocket?.emit?.("presence", { active: false }), AWAY_GRACE_MS);
      } else {
        newSocket?.emit?.("presence", { active: true });
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      clearTimeout(awayTimer);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (newSocket) newSocket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
};
