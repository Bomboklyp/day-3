<script setup lang="ts">
import type { RequestPriority, RequestStatus } from "~/types/workflow";
import { priorities, statuses } from "~/utils/requests";
import { useRequestUiStore } from "~/stores/requestUi";
import { apiErrorMessage, apiErrorStatus } from "~/utils/api";
const route = useRoute();
const router = useRouter();
const { request, users, error, pending, refresh } = useRequest(
  () => String(route.params.id),
  () => (typeof route.query.scenario === "string" ? route.query.scenario : ""),
);
const { updateRequest } = useRequestActions();
const ui = useRequestUiStore();
const busy = computed(() => !!ui.pending[Number(route.params.id)]);
const statusOpen = ref(false);
const selectedStatus = ref<RequestStatus>("in_progress");
const selectedAssignee = ref<string | null>(null);
const assignee = computed({
  get: () =>
    selectedAssignee.value ??
    users.value.find((person) => person.name === request.value?.assignee.name)
      ?.id ??
    "",
  set: (value: string) => {
    selectedAssignee.value = value;
  },
});
watch(
  () => route.params.id,
  () => {
    selectedAssignee.value = null;
  },
);
useHead(() => ({
  title: request.value
    ? request.value.title + " — WorkFlow"
    : "Страница не найдена — WorkFlow",
}));
const created = computed(() =>
  request.value
    ? new Intl.DateTimeFormat("ru-RU", {
        day: "numeric",
        month: "long",
        timeZone: "Europe/Moscow",
      }).format(new Date(request.value.createdAt)) +
      ", " +
      new Intl.DateTimeFormat("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Moscow",
      }).format(new Date(request.value.createdAt))
    : "",
);
async function assign() {
  if (!request.value || busy.value) return;
  try {
    await updateRequest(request.value.id, {
      assignee_id: assignee.value || null,
    });
  } catch {
  } finally {
    selectedAssignee.value = null;
  }
}
async function priority(event: Event) {
  if (!request.value || busy.value) return;
  try {
    await updateRequest(request.value.id, {
      priority: (event.target as HTMLSelectElement).value as RequestPriority,
    });
  } catch {}
}
function openStatus() {
  if (!request.value) return;
  selectedStatus.value = request.value.status;
  statusOpen.value = true;
}
async function saveStatus() {
  if (!request.value || busy.value) return;
  try {
    await updateRequest(request.value.id, { status: selectedStatus.value });
    statusOpen.value = false;
  } catch {
    statusOpen.value = false;
  }
}
async function retry() {
  if (["error", "500", "429"].includes(String(route.query.scenario))) {
    const { scenario: _scenario, ...query } = route.query;
    await router.replace({ query });
  } else await refresh();
}
</script>
<template>
  <div class="page-stack request-detail-page" :aria-busy="pending">
    <NuxtLink to="/requests" class="button button-tertiary align-start"
      >← К списку заявок</NuxtLink
    >
    <RequestDetailLoading v-if="pending" />
    <ErrorContent v-else-if="apiErrorStatus(error) === 404" />
    <RequestState
      v-else-if="error"
      state="error"
      title="Не удалось загрузить заявку"
      :message="
        apiErrorStatus(error) === 429
          ? apiErrorMessage(error)
          : 'Проверьте соединение и повторите загрузку.'
      "
      @retry="retry"
    />
    <template v-else-if="request">
      <h1>{{ request.title }}</h1>
      <RequestFeedback :request-id="request.id" @refresh="refresh" />
      <p class="page-subtitle">#{{ request.id }} · Создана {{ created }}</p>
      <div class="detail-badges">
        <StatusBadge :status="request.status" /><PriorityBadge
          :priority="request.priority"
        />
      </div>
      <div class="detail-columns">
        <div class="detail-main">
          <section class="panel stack-16">
            <h2>Описание проблемы</h2>
            <p>{{ request.description }}</p>
          </section>
          <RequestComments :request="request" />
          <section class="panel stack-16">
            <h2>История заявки</h2>
            <RequestTimeline :events="request.timeline" />
          </section>
        </div>
        <form class="panel parameter-panel stack-16" @submit.prevent="assign">
          <h2>Параметры</h2>
          <span class="parameter-label">Клиент</span>
          <p class="parameter-value">{{ request.client }}</p>
          <span class="parameter-label">Категория</span>
          <p class="parameter-value">{{ request.category }}</p>
          <label class="field field-tight" for="detail-assignee"
            ><span>Исполнитель</span
            ><select
              id="detail-assignee"
              aria-label="Исполнитель"
              v-model="assignee"
              @change="assign"
              required
              :disabled="busy"
            >
              <option value="">Не назначен</option>
              <option
                v-for="person in users.filter(
                  (p) => p.name !== 'Мария Смирнова',
                )"
                :key="person.id"
                :value="person.id"
              >
                {{ person.name }}
              </option>
            </select></label
          ><label class="field field-tight" for="detail-priority"
            ><span>Приоритет</span
            ><select
              id="detail-priority"
              aria-label="Приоритет"
              :value="request.priority"
              :disabled="busy"
              @change="priority"
            >
              <option
                v-for="item in priorities"
                :key="item.value"
                :value="item.value"
              >
                {{ item.label }}
              </option>
            </select></label
          ><span class="parameter-label">Срок решения</span>
          <p class="deadline">
            {{
              request.dueAt
                ? new Intl.DateTimeFormat("ru-RU", {
                    day: "numeric",
                    month: "long",
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Europe/Moscow",
                  }).format(new Date(request.dueAt))
                : "Не указан"
            }}
          </p>
          <button
            class="button button-primary"
            type="button"
            :disabled="busy"
            @click="openStatus"
          >
            Изменить статус
          </button>
        </form>
      </div>
      <AppModal
        :open="statusOpen"
        title="Изменить статус"
        @close="statusOpen = false"
      >
        <form class="form-stack" @submit.prevent="saveStatus">
          <label class="field" for="request-status"
            ><span>Статус</span
            ><select
              id="request-status"
              aria-label="Статус"
              v-model="selectedStatus"
              :disabled="busy"
            >
              <option
                v-for="item in statuses"
                :key="item.value"
                :value="item.value"
              >
                {{ item.label }}
              </option>
            </select></label
          >
          <div class="modal-footer">
            <button
              class="button button-secondary"
              type="button"
              :disabled="busy"
              @click="statusOpen = false"
            >
              Отмена</button
            ><button
              class="button button-primary"
              type="submit"
              :disabled="busy || selectedStatus === request.status"
            >
              {{ busy ? "Сохраняем…" : "Сохранить изменения" }}
            </button>
          </div>
        </form>
      </AppModal>
    </template>
  </div>
</template>
