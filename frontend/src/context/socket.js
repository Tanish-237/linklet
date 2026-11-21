import { createContext } from "react";

// Kept apart from SocketProvider so SocketContext.jsx exports only components (fast refresh).
export const SocketContext = createContext();
