import React from "react";

/**
 * Material Symbols Rounded icon (the font is loaded in index.html).
 *   <Icon name="chat" />            outlined
 *   <Icon name="chat" filled />     solid — use for active / "on" states
 * Decorative by default (aria-hidden); pass `label` when the icon is the only
 * content of a control and needs a name of its own.
 */
export default function Icon({ name, size, filled = false, className = "", label, style }) {
  return (
    <span
      className={`material-icons ${filled ? "icon-filled" : ""} ${className}`}
      style={size ? { fontSize: size, ...style } : style}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
    >
      {name}
    </span>
  );
}
