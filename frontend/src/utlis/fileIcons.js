// Each type has a lighter/brighter `dark` shade (reads well on the app's
// near-black surfaces) and a deliberately darker, more saturated `light`
// shade — the same pastel otherwise washes out against a white/cream
// background and a pale tinted chip (see Posts.css's photo/video icon pair
// for the same fix applied elsewhere).
const FILE_ICON_TYPES = {
  link:  { icon: "link",            dark: "#818cf8", light: "#4338ca" },
  image: { icon: "image",           dark: "#22d3ee", light: "#0e7490" },
  video: { icon: "movie",           dark: "#f472b6", light: "#db2777" },
  pdf:   { icon: "picture_as_pdf",  dark: "#f87171", light: "#dc2626" },
  doc:   { icon: "description",     dark: "#60a5fa", light: "#1d4ed8" },
  ppt:   { icon: "slideshow",       dark: "#fb923c", light: "#c2410c" },
  xls:   { icon: "table_chart",     dark: "#4ade80", light: "#047857" },
  zip:   { icon: "folder_zip",      dark: "#facc15", light: "#b45309" },
  txt:   { icon: "article",         dark: "#a78bfa", light: "#6d28d9" },
  other: { icon: "insert_drive_file", dark: "#94a3b8", light: "#475569" },
};

const resolveFileIconType = (fileName, fileType) => {
  if (fileType === "link") return "link";
  const ext = (fileName?.split(".").pop() || fileType || "").toLowerCase();
  if (["jpg","jpeg","png","gif","svg","webp"].includes(ext) || ext.includes("image")) return "image";
  if (["mp4","mkv","avi","mov","webm","ogg"].includes(ext) || ext.includes("video")) return "video";
  if (ext === "pdf") return "pdf";
  if (["doc","docx"].includes(ext)) return "doc";
  if (["ppt","pptx"].includes(ext)) return "ppt";
  if (["xls","xlsx","csv"].includes(ext)) return "xls";
  if (["zip","rar","tar","gz"].includes(ext)) return "zip";
  if (ext === "txt") return "txt";
  return "other";
};

export const getFileIcon = (fileName, fileType, theme = "dark") => {
  const entry = FILE_ICON_TYPES[resolveFileIconType(fileName, fileType)];
  return { icon: entry.icon, color: theme === "light" ? entry.light : entry.dark };
};
