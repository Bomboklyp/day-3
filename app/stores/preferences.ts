import { defineStore } from "pinia";
import type { UserProfile } from "../types/workflow";
import { initials } from "../utils/format";

const storageKey = "workflow-practice-day3-preferences-v1";
export const defaultProfile: UserProfile = {
  name: "Анна Кузнецова",
  email: "0000@mail.demo",
  position: "Оператор",
  department: "",
  about: "",
  notifications: true,
  density: "comfortable",
};
export function readProfile(value: unknown): UserProfile {
  const result = { ...defaultProfile };
  if (!value || typeof value !== "object") return result;
  for (const key of [
    "name",
    "email",
    "position",
    "department",
    "about",
  ] as const) {
    if (key in value) {
      const text = (value as Record<string, unknown>)[key];
      if (typeof text === "string" && text.length <= 500) result[key] = text;
    }
  }
  if ("density" in value && value.density === "compact")
    result.density = "compact";
  if ("notifications" in value && typeof value.notifications === "boolean")
    result.notifications = value.notifications;
  return result;
}
export const usePreferencesStore = defineStore("preferences", {
  state: () => ({
    profile: { ...defaultProfile },
    signedIn: false,
    ready: false,
    persistenceAvailable: true,
  }),
  getters: {
    currentPerson: (state) => ({
      name: state.profile.name,
      initials: initials(state.profile.name),
      color: "purple",
    }),
  },
  actions: {
    hydrate() {
      if (typeof window === "undefined" || this.ready) return;
      try {
        const raw = localStorage.getItem(storageKey);
        const saved: unknown = raw ? JSON.parse(raw) : null;
        if (saved && typeof saved === "object") {
          if ("profile" in saved) this.profile = readProfile(saved.profile);
          this.signedIn = "signedIn" in saved && saved.signedIn === true;
        }
      } catch {
        this.persistenceAvailable = false;
      }
      this.ready = true;
    },
    persist() {
      if (typeof window === "undefined") return;
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({ profile: this.profile, signedIn: this.signedIn }),
        );
        this.persistenceAvailable = true;
      } catch {
        this.persistenceAvailable = false;
      }
    },
    updateProfile(value: UserProfile) {
      this.profile = readProfile(value);
      this.persist();
    },
    login(email?: string) {
      if (email) this.profile.email = email.trim();
      this.signedIn = true;
      this.persist();
    },
    logout() {
      this.signedIn = false;
      this.persist();
    },
  },
});
