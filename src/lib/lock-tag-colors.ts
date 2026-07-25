import type { CSSProperties } from "react";

export const customLockTagColorPattern = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function expandHexColor(value: string) {
  const hex = value.trim();
  if (!customLockTagColorPattern.test(hex)) return null;
  if (hex.length === 4) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`.toLowerCase();
  }
  return hex.toLowerCase();
}

function getRelativeLuminance(hex: string) {
  const color = expandHexColor(hex);
  if (!color) return 0;

  const channels = [1, 3, 5].map((offset) => {
    const value = parseInt(color.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function getReadableTextColor(hex: string) {
  const color = expandHexColor(hex);
  if (!color) return "#0f172a";

  const backgroundLuminance = getRelativeLuminance(color);
  const darkLuminance = getRelativeLuminance("#0f172a");
  const lightLuminance = getRelativeLuminance("#f8fafc");
  const darkContrast = (backgroundLuminance + 0.05) / (darkLuminance + 0.05);
  const lightContrast = (lightLuminance + 0.05) / (backgroundLuminance + 0.05);
  return darkContrast >= lightContrast ? "#0f172a" : "#f8fafc";
}

function getSoftenedSurfaceColor(hex: string) {
  const color = expandHexColor(hex);
  if (!color) return hex;

  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  const whiteMix = brightness < 96 ? 0.24 : brightness < 144 ? 0.16 : 0.06;
  const soften = (channel: number) => Math.round(channel + (255 - channel) * whiteMix);

  return `#${[soften(r), soften(g), soften(b)]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}

export function isCustomLockTagColor(value: string | null | undefined) {
  return !!value && customLockTagColorPattern.test(value.trim());
}

export function normalizeLockTagColor(value: string) {
  return expandHexColor(value) ?? value.trim();
}

export function getLockTagColorClassName(value: string | null | undefined) {
  if (!value || isCustomLockTagColor(value)) return "";
  return value;
}

export function getLockTagColorStyle(value: string | null | undefined): CSSProperties | undefined {
  const color = value ? expandHexColor(value) : null;
  if (!color) return undefined;
  const surfaceColor = getSoftenedSurfaceColor(color);
  return {
    backgroundColor: surfaceColor,
    color: getReadableTextColor(surfaceColor),
    borderColor: surfaceColor,
  };
}

export function getLockTagStripStyle(value: string | null | undefined): CSSProperties | undefined {
  const color = value ? expandHexColor(value) : null;
  if (!color) return undefined;
  return { backgroundColor: color };
}
