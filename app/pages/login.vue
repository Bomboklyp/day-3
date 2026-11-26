<script setup lang="ts">
definePageMeta({ layout: "public" });
useHead({ title: "Вход — WorkFlow" });
const { login } = useWorkflow();
const email = ref("");
const password = ref("");
const busy = ref(false);
const error = ref("");
async function submit() {
  if (busy.value) return;
  if (!email.value.trim() || !password.value.trim()) {
    error.value = "Заполните электронную почту и пароль";
    return;
  }
  busy.value = true;
  login(email.value);
  password.value = "";
  await navigateTo("/dashboard");
  busy.value = false;
}
</script>
<template>
  <section class="login-section">
    <form class="panel login-card" @submit.prevent="submit">
      <h1>С возвращением</h1>
      <p class="page-subtitle">Войдите для работы с заявками</p>
      <label class="field" for="login-email"
        ><span>Электронная почта</span
        ><input
          id="login-email"
          v-model="email"
          type="email"
          required
          autocomplete="username"
          placeholder="0000@mail.demo" /></label
      ><label class="field" for="login-password"
        ><span>Пароль</span
        ><input
          id="login-password"
          v-model="password"
          type="password"
          required
          autocomplete="current-password"
          placeholder="••••••••••"
      /></label>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <button
        class="button button-primary align-start"
        :disabled="busy"
        type="submit"
      >
        Войти</button
      ><a
        href="#login-email"
        class="login-registration"
        @click.prevent="
          error =
            'На этом этапе используется демонстрационный вход: укажите любую корректную почту и вымышленный пароль.'
        "
        >Нет аккаунта? Зарегистрироваться</a
      >
    </form>
  </section>
</template>
