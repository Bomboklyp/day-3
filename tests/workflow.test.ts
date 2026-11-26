import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { createPinia, setActivePinia } from "pinia";
import { useWorkflow } from "../app/composables/useWorkflow";
beforeEach(() => setActivePinia(createPinia()));
test("профиль и демовход сохраняют функции первого дня, не подменяя данные API", () => {
  const store = useWorkflow();
  store.updateProfile({
    ...store.profile.value,
    name: "Анна Петрова",
    department: "Дизайн",
  });
  assert.equal(store.currentPerson.value.initials, "АП");
  assert.equal(useWorkflow().profile.value.name, "Анна Петрова");
  store.login("test@example.com");
  assert.equal(store.signedIn.value, true);
  assert.equal(store.profile.value.email, "test@example.com");
  store.logout();
  assert.equal(store.signedIn.value, false);
  assert.ok(!("password" in store.profile.value));
  assert.ok(!("requests" in store));
});
