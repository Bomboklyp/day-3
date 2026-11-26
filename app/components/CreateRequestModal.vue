<script setup lang="ts">
import type { RequestPriority } from "~/types/workflow";
import { priorities } from "~/utils/requests";
import { apiErrorMessage } from "~/utils/api";
const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();
const { createRequest } = useRequestActions();
const {
  data: catalogs,
  error: catalogsError,
  refresh: reloadCatalogs,
} = useCatalogs();
const categories = computed(() => catalogs.value?.categories ?? []);
const { notify } = useToast();
const form = reactive({
  title: "",
  description: "",
  category: "category-1",
  priority: "medium" as RequestPriority,
});
const busy = ref(false);
const error = ref("");
const id = useId();
watch(
  () => props.open,
  (open) => {
    if (open) {
      form.title = "";
      form.description = "";
      form.category = categories.value[0]?.id ?? "category-1";
      form.priority = "medium";
      error.value = "";
    }
  },
);

async function submit() {
  if (busy.value) return;
  if (form.title.trim().length < 5 || form.description.trim().length < 10) {
    error.value = "Укажите название от 5 символов и описание от 10 символов.";
    return;
  }
  busy.value = true;
  try {
    const request = await createRequest({
      title: form.title,
      description: form.description,
      priority: form.priority,
      category_id: form.category,
    });
    emit("close");
    notify(`Заявка #${request.id} создана`);
    await navigateTo(`/requests/${request.id}`);
  } catch (cause: unknown) {
    error.value = apiErrorMessage(cause);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <AppModal :open="open" title="Новая заявка" @close="emit('close')">
    <form class="form-stack" @submit.prevent="submit">
      <label class="field" :for="`${id}-title`"
        ><span>Название заявки <span class="required">*</span></span
        ><input
          :id="`${id}-title`"
          v-model="form.title"
          autofocus
          required
          minlength="5"
          maxlength="120"
          placeholder="Например, настроить корпоративную почту"
      /></label>
      <label class="field" :for="`${id}-description`"
        ><span>Описание <span class="required">*</span></span
        ><textarea
          :id="`${id}-description`"
          v-model="form.description"
          required
          minlength="10"
          maxlength="3000"
          rows="4"
          placeholder="Что нужно сделать? Добавьте подробности и ожидаемый результат."
        /><span class="field-hint"
          >{{ form.description.length }} / 3000</span
        ></label
      >
      <div class="form-grid">
        <label class="field" :for="`${id}-category`"
          ><span>Категория</span
          ><select :id="`${id}-category`" v-model="form.category">
            <option
              v-for="category in categories"
              :key="category.id"
              :value="category.id"
            >
              {{ category.name }}
            </option>
          </select></label
        ><label class="field" :for="`${id}-priority`"
          ><span>Приоритет</span
          ><select :id="`${id}-priority`" v-model="form.priority">
            <option
              v-for="priority in priorities"
              :key="priority.value"
              :value="priority.value"
            >
              {{ priority.label }}
            </option>
          </select></label
        >
      </div>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <div v-if="catalogsError" class="form-error" role="alert">
        {{ apiErrorMessage(catalogsError) }}
        <button
          type="button"
          class="button button-secondary"
          @click="reloadCatalogs()"
        >
          Повторить загрузку
        </button>
      </div>
      <div class="modal-footer">
        <button
          class="button button-secondary"
          type="button"
          :disabled="busy"
          @click="emit('close')"
        >
          Отмена</button
        ><button
          class="button button-primary"
          type="submit"
          :disabled="busy || !categories.length || !!catalogsError"
        >
          <AppIcon name="plus" :size="18" />{{
            busy ? "Создаём…" : "Создать заявку"
          }}
        </button>
      </div>
    </form>
  </AppModal>
</template>
