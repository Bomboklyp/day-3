<script setup lang="ts">
import type { WorkflowRequest } from "~/types/workflow";
const props = defineProps<{ request: WorkflowRequest }>();
const { addComment } = useRequestActions();
const { notify } = useToast();
const busy = ref(false);
const ui = useRequestUiStore();
const locked = computed(() => busy.value || !!ui.pending[props.request.id]);
const error = ref("");
const text = ref("");
const id = useId();
const time = (value: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Moscow",
  }).format(new Date(value));
async function submit() {
  if (locked.value || !text.value.trim()) return;
  busy.value = true;
  error.value = "";
  try {
    await addComment(props.request.id, text.value);
    text.value = "";
    notify("Комментарий отправлен");
  } catch {
    error.value =
      "Не удалось отправить комментарий. Текст сохранён — попробуйте ещё раз.";
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <section class="panel comments-panel stack-16">
    <h2>Комментарии · {{ request.comments.length }}</h2>
    <article
      v-for="comment in request.comments"
      :key="comment.id"
      class="comment"
    >
      <p class="comment-author">
        {{ comment.author.name }} · {{ time(comment.createdAt) }}
      </p>
      <p>{{ comment.text }}</p>
    </article>
    <form class="stack-16" @submit.prevent="submit">
      <label class="field textarea-field" :for="id"
        ><span>Ваш комментарий</span
        ><textarea
          :id="id"
          v-model="text"
          maxlength="2000"
          :disabled="locked"
          placeholder="Напишите сообщение…"
          @keydown.ctrl.enter.prevent="submit"
        />
      </label>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <button
        class="button button-primary align-start"
        type="submit"
        :disabled="locked || !text.trim()"
      >
        {{
          busy
            ? "Отправляем…"
            : error
              ? "Повторить отправку"
              : "Отправить комментарий"
        }}
      </button>
      <p v-if="busy" class="field-hint" role="status">
        Отправляем комментарий…
      </p>
    </form>
  </section>
</template>
