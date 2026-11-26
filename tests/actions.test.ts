import assert from "node:assert/strict";
import { test, beforeEach } from "node:test";
import { ref } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { useRequestUiStore } from "../app/stores/requestUi";
import { readProfile } from "../app/stores/preferences";
import { useRequestActions } from "../app/composables/useRequestActions";
import { createApiSeed } from "../server/utils/seed";
import type {
  ApiItem,
  ApiRequest,
  CreateCommentBody,
  UpdateRequestBody,
} from "../shared/types/api";

interface FetchOptions {
  method?: string;
  body?: UpdateRequestBody | CreateCommentBody;
}
let record: ApiRequest;
let fetcher: (
  url: string,
  options?: FetchOptions,
) => Promise<ApiItem<ApiRequest>>;
beforeEach(() => {
  setActivePinia(createPinia());
  record = createApiSeed().find((request) => request.id === 1042)!;
  fetcher = async (_url, options) => {
    const body = options?.body;
    if (options?.method === "PATCH" && body && "expected_revision" in body)
      record = { ...record, ...body, revision: (record.revision ?? 1) + 1 };
    if (options?.method === "POST" && body && "text" in body)
      record = {
        ...record,
        comments: [
          ...(record.comments ?? []),
          {
            id: "new-comment",
            text: body.text,
            created_at: new Date().toISOString(),
          },
        ],
        revision: (record.revision ?? 1) + 1,
      };
    return { data: record };
  };
  Object.assign(globalThis, {
    useWorkflow: () => ({ profile: ref({ name: "Учебный оператор" }) }),
    useRequestCache: () => ({
      find: () => record,
      commit: (next: ApiRequest) => {
        record = next;
      },
    }),
    useRoute: () => ({ query: {} }),
    $fetch: (url: string, options?: FetchOptions) => fetcher(url, options),
  });
});

test("приоритет изменяется до ответа API; ошибка убирает временное значение", async () => {
  let reject: (error: unknown) => void = () => {};
  fetcher = () =>
    new Promise((_resolve, fail) => {
      reject = fail;
    });
  const actions = useRequestActions(),
    ui = useRequestUiStore();
  const operation = actions.updateRequest(1042, { priority: "urgent" });
  assert.equal(ui.priorityChanges[1042]?.after, "urgent");
  assert.equal(record.priority, "high");
  assert.ok(ui.pending[1042]);
  reject({ statusCode: 500 });
  await assert.rejects(operation);
  assert.equal(ui.priorityChanges[1042], undefined);
  assert.equal(ui.pending[1042], undefined);
  assert.equal(record.priority, "high");
  assert.equal(ui.undo, null);
  assert.equal(ui.notice?.kind, "error");
});

test("Undo приоритета не удаляет комментарий, добавленный после изменения", async () => {
  const actions = useRequestActions(),
    ui = useRequestUiStore();
  await actions.updateRequest(1042, { priority: "urgent" });
  assert.equal(record.priority, "urgent");
  await actions.addComment(1042, "После изменения приоритета");
  await actions.undoLastChange();
  assert.equal(record.priority, "high");
  assert.ok(
    record.comments?.some(
      (comment) => comment.text === "После изменения приоритета",
    ),
  );
  assert.equal(record.assignee_id, "user-3");
  assert.equal(ui.undo, null);
});

test("Undo относится к последнему успешному статусу или приоритету", async () => {
  const actions = useRequestActions(),
    ui = useRequestUiStore();
  await actions.updateRequest(1042, { priority: "urgent" });
  await actions.updateRequest(1042, { status: "resolved" });
  await actions.undoLastChange();
  assert.equal(record.status, "in_progress");
  assert.equal(record.priority, "urgent");
  assert.equal(ui.undo, null);
});

test("при ошибке Undo данные не затираются и отмену можно повторить", async () => {
  const actions = useRequestActions(),
    ui = useRequestUiStore();
  await actions.updateRequest(1042, { priority: "urgent" });
  fetcher = async () => {
    throw { statusCode: 500 };
  };
  await actions.undoLastChange();
  assert.equal(record.priority, "urgent");
  assert.equal(ui.priorityChanges[1042], undefined);
  assert.ok(ui.undo);
  assert.equal(ui.notice?.kind, "error");
});

test("параллельное действие по той же заявке не обрывает первое", async () => {
  let resolve: (value: ApiItem<ApiRequest>) => void = () => {};
  fetcher = () =>
    new Promise((done) => {
      resolve = done;
    });
  const actions = useRequestActions(),
    ui = useRequestUiStore();
  const first = actions.updateRequest(1042, { priority: "urgent" });
  await assert.rejects(actions.updateRequest(1042, { status: "waiting" }));
  assert.equal(ui.priorityChanges[1042]?.after, "urgent");
  resolve({ data: { ...record, priority: "urgent", revision: 2 } });
  await first;
  assert.equal(record.priority, "urgent");
});

test("настройки читаются с проверкой типов", () => {
  assert.equal(readProfile({ density: "compact" }).density, "compact");
  assert.equal(
    readProfile({ density: "broken", notifications: "yes" }).density,
    "comfortable",
  );
  assert.equal(readProfile(null).name, "Анна Кузнецова");
});
