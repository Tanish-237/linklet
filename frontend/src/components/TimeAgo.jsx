import React, { useState, useEffect } from "react";
import { format } from "timeago.js";

const TimeAgo = ({ date, className = "" }) => {
  const [, setTick] = useState(0);

  useEffect(() => {
    // Tick every 10 seconds to update relative time in real-time
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 10000);

    return () => clearInterval(timer);
  }, []);

  if (!date) return null;

  return <span className={className}>{format(date)}</span>;
};

export default TimeAgo;
