import React from "react";

const DateSeparator = ({ dateLabel }) => {
  if (!dateLabel) return null;

  return (
    <div className="date-separator">
      <span className="date-separator-badge">{dateLabel}</span>
    </div>
  );
};

export default DateSeparator;
