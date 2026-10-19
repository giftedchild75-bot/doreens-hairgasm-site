/** Swatch colours for the shades the owner actually sells; anything else falls back to a neutral dot. */
const SWATCH: Record<string, string> = {
  black: "#1b1714", burgundy: "#6d1029", wine: "#5a0f24", brown: "#6b3f25", "chestnut brown": "#7a3f1d",
  "tea brown": "#8a5a3b", blonde: "#d9b26f", orange: "#e0702a", green: "#3f6b3a", cajun: "#9b3b1f",
  "brown with blonde highlight": "linear-gradient(135deg, #6b3f25 50%, #d9b26f 50%)",
};

export const swatch = (colour: string) => SWATCH[colour.toLowerCase()] ?? "#c9b8b0";
