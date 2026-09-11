import { createContext, useContext, useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";
import { API_BASE_URL } from "../config";

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
      const token = typeof window !== "undefined" && window.localStorage ? localStorage.getItem("accessToken") : null;
      const newSocket = io(API_BASE_URL, {
        withCredentials: true,
        auth: { token },
      });

      if (newSocket && typeof newSocket.on === "function") {
        const handleSetup = () => {
          if (typeof newSocket.emit === "function") {
            newSocket.emit("setup", userRef.current || user);
          }
        };

        newSocket.on("connect", handleSetup);
        newSocket.on("reconnect", handleSetup);
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
