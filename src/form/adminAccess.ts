/**
 * Client-side admin access config: hotkey + password used to open the editor
 * on the public landing page. Stored in localStorage (per browser/device).
 */

const HOTKEY_KEY_LS = "kr_admin_hotkey_key";
const HOTKEY_MOD_LS = "kr_admin_hotkey_mod"; // "ctrl" (cmd on mac too) or "alt" or "shift"
const PASSWORD_LS = "kr_admin_password";

export const DEFAULT_HOTKEY_KEY = "k";
export const DEFAULT_HOTKEY_MOD: HotkeyModifier = "ctrl";
export const DEFAULT_ADMIN_PASSWORD = "aKertrendez0";

export type HotkeyModifier = "ctrl" | "alt" | "shift" | "none";

export function getHotkeyKey(): string {
  if (typeof window === "undefined") return DEFAULT_HOTKEY_KEY;
  return (localStorage.getItem(HOTKEY_KEY_LS) || DEFAULT_HOTKEY_KEY).toLowerCase();
}

export function getHotkeyModifier(): HotkeyModifier {
  if (typeof window === "undefined") return DEFAULT_HOTKEY_MOD;
  const v = localStorage.getItem(HOTKEY_MOD_LS);
  if (v === "ctrl" || v === "alt" || v === "shift" || v === "none") return v;
  return DEFAULT_HOTKEY_MOD;
}

export function setHotkey(key: string, modifier: HotkeyModifier) {
  if (typeof window === "undefined") return;
  localStorage.setItem(HOTKEY_KEY_LS, (key || DEFAULT_HOTKEY_KEY).toLowerCase());
  localStorage.setItem(HOTKEY_MOD_LS, modifier);
}

export function getAdminPassword(): string {
  if (typeof window === "undefined") return DEFAULT_ADMIN_PASSWORD;
  return localStorage.getItem(PASSWORD_LS) || DEFAULT_ADMIN_PASSWORD;
}

export function setAdminPassword(pw: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PASSWORD_LS, pw || DEFAULT_ADMIN_PASSWORD);
}

export function describeHotkey(key: string, mod: HotkeyModifier): string {
  const k = (key || DEFAULT_HOTKEY_KEY).toUpperCase();
  if (mod === "none") return `${k} ${k}`;
  const label = mod === "ctrl" ? "Ctrl/Cmd" : mod === "alt" ? "Alt" : "Shift";
  return `${label}+${k} ${label}+${k}`;
}
