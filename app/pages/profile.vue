<script setup lang="ts">
import type { UserProfile } from "~/types/workflow";
useHead({ title: "Профиль — WorkFlow" });
const { profile, currentPerson, updateProfile, logout } = useWorkflow();
const { notify } = useToast();
const name = ref(profile.value.name);
const email = ref(profile.value.email);
watch(
  profile,
  (p) => {
    name.value = p.name;
    email.value = p.email;
  },
  { deep: true },
);
function submit() {
  if (!name.value.trim()) return;
  updateProfile({
    ...profile.value,
    name: name.value.trim(),
    email: email.value.trim(),
  });
  notify("Изменения сохранены");
}
function density(event: Event) {
  updateProfile({
    ...profile.value,
    density: (event.target as HTMLSelectElement)
      .value as UserProfile["density"],
  });
}
async function signOut() {
  logout();
  await navigateTo("/login");
}
</script>
<template>
  <div class="page-stack profile-page">
    <h1>Профиль</h1>
    <p class="page-subtitle">Ваши данные и настройки интерфейса</p>
    <form class="panel profile-form stack-16" @submit.prevent="submit">
      <PersonAvatar :person="currentPerson" /><label
        class="field"
        for="profile-name"
        ><span>Имя</span
        ><input
          id="profile-name"
          v-model="name"
          required
          maxlength="80"
          autocomplete="name" /></label
      ><label class="field" for="profile-email"
        ><span>Электронная почта</span
        ><input
          id="profile-email"
          v-model="email"
          type="email"
          required
          maxlength="150"
          autocomplete="email"
      /></label>
      <p class="profile-role">Роль: оператор</p>
      <button class="button button-primary align-start" type="submit">
        Сохранить изменения
      </button>
    </form>
    <section class="panel profile-settings stack-16">
      <h2>Настройки интерфейса</h2>
      <label class="field" for="profile-density"
        ><span>Плотность списка</span
        ><select
          id="profile-density"
          aria-label="Плотность списка"
          :value="profile.density"
          @change="density"
        >
          <option value="comfortable">Комфортная</option>
          <option value="compact">Компактная</option>
        </select></label
      >
    </section>
    <button class="button button-secondary align-start" @click="signOut">
      Выйти из аккаунта
    </button>
  </div>
</template>
