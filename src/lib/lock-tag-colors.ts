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

function getReadableTextColor(hex: string) {
  const color = expandHexColor(hex);
  if (!color) return "#0f172a";

  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? "#0f172a" : "#f8fafc";
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
  return {
    backgroundColor: color,
    color: getReadableTextColor(color),
    borderColor: color,
  };
}

export function getLockTagStripStyle(value: string | null | undefined): CSSProperties | undefined {
  const color = value ? expandHexColor(value) : null;
  if (!color) return undefined;
  return { backgroundColor: color };
}
