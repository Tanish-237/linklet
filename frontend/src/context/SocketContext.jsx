import { createContext, useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";
import { API_BASE_URL } from "../config";
import { readAccessToken, refreshAccessToken, isAuthHandshakeError } from "../api/refreshToken";

export const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const { user } = useAuth();
  const userRef = useRef(user);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    if (user?._id) {
      // `auth` as a function (rather than a static object) is re-invoked by
      // socket.io-client on every connection AND reconnection attempt, so a
      // token refreshed by the axios interceptor mid-session is picked up
      // automatically instead of the socket being stuck with the token it
      // had when it first connected.
      const newSocket = io(API_BASE_URL, {
        withCredentials: true,
        auth: (cb) => cb({ token: readAccessToken() }),
      });

      let retriedAuthRefresh = false;

      if (newSocket && typeof newSocket.on === "function") {
        const handleSetup = () => {
          retriedAuthRefresh = false;
          if (typeof newSocket.emit === "function") {
            newSocket.emit("setup", userRef.current || user);
          }
        };

        newSocket.on("connect", handleSetup);
        newSocket.on("reconnect", handleSetup);

        // A handshake rejected for an expired/invalid token means the access
        // token in localStorage is stale — the automatic reconnect backoff
        // would eventually retry with the same stale token and fail again.
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
            // refreshAccessToken already cleared the token and fired
            // "auth-expired" — nothing more to do here.
          }
        });
      }

      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
      };
    } else {
      setSocket((prevSocket) => {
        if (prevSocket) {
          prevSocket.disconnect();
        }
        return null;
      });
    }
  }, [user?._id]);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
};
