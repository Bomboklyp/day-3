import { storeToRefs } from "pinia";
import { usePreferencesStore } from "~/stores/preferences";
export function useWorkflow() {
  const store = usePreferencesStore();
  return {
    ...storeToRefs(store),
    hydrate: store.hydrate,
    updateProfile: store.updateProfile,
    login: store.login,
    logout: store.logout,
  };
}
