import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp } from "node:fs/promises";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { createApiCatalogs, createApiSeed } from "../server/utils/seed";
import { selectRequests } from "../server/utils/request-service";
import { createRepository } from "../server/utils/repository";
import {
  readRequestsQuery,
  requestsUrlQuery,
} from "../shared/utils/request-query";
import { mapApiRequest, apiErrorMessage } from "../app/utils/api";
import {
  validateComment,
  validateCreateRequest,
  validateUpdateRequest,
} from "../server/utils/validation";

test("невалидные и повторяющиеся query не ломают страницу; допустимые параметры восстанавливаются", () => {
  const query = readRequestsQuery({
    page: "-2",
    per_page: "999",
    status: "unknown",
    q: ["a", "b"],
    sort: "oldest",
  });
  assert.equal(query.page, 1);
  assert.equal(query.per_page, 100);
  assert.equal(query.status, "");
  assert.equal(query.q, "");
  const direct = readRequestsQuery({
    q: " CRM ",
    status: "new",
    priority: "high",
    page: "2",
    sort: "priority",
    assignment: "unassigned",
  });
  assert.deepEqual(readRequestsQuery(requestsUrlQuery(direct)), direct);
});
test("сервер применяет поиск, фильтры и пагинацию до отправки данных клиенту", () => {
  const seed = createApiSeed(),
    catalogs = createApiCatalogs();
  const matching = selectRequests(
    seed,
    readRequestsQuery({ q: "CRM", status: "in_progress", priority: "high" }),
    catalogs,
  );
  assert.deepEqual(
    matching.data.map((item) => item.id),
    [1042],
  );
  const first = selectRequests(
    seed,
    readRequestsQuery({ page: "1" }),
    catalogs,
  );
  const second = selectRequests(
    seed,
    readRequestsQuery({ page: "2" }),
    catalogs,
  );
  assert.equal(first.data.length, 12);
  assert.equal(second.data.length, 12);
  assert.equal(first.meta.total, 25);
  assert.ok(first.data.every((a) => !second.data.some((b) => b.id === a.id)));
  const clamped = selectRequests(
    seed,
    readRequestsQuery({ page: "999" }),
    catalogs,
  );
  assert.equal(clamped.meta.page, 3);
  assert.equal(clamped.data.length, 1);
});
test("сортировка API не меняет исходный массив и работает вместе с фильтрами", () => {
  const seed = createApiSeed(),
    before = structuredClone(seed);
  const oldest = selectRequests(
    seed,
    readRequestsQuery({ sort: "oldest", priority: "urgent" }),
    createApiCatalogs(),
  );
  assert.equal(oldest.data[0]?.id, 1021);
  assert.equal(oldest.data.at(-1)?.id, 1043);
  assert.deepEqual(seed, before);
});
test("единый адаптер обрабатывает отсутствующие поля, null и неизвестные связи", () => {
  const record = createApiSeed()[0]!;
  const mapped = mapApiRequest(
    {
      ...record,
      title: null,
      description: undefined,
      customer_id: "missing",
      category_id: null,
      author_id: null,
      assignee_id: null,
      due_at: undefined,
      comments: null,
      timeline: undefined,
    },
    createApiCatalogs(),
  );
  assert.equal(mapped.title, "Без названия");
  assert.equal(mapped.client, "Клиент не указан");
  assert.equal(mapped.category, "Категория не указана");
  assert.equal(mapped.author.name, "Автор не указан");
  assert.equal(mapped.assignee.name, "Не назначен");
  assert.equal(mapped.dueAt, "");
  assert.deepEqual(mapped.comments, []);
  assert.deepEqual(mapped.timeline, []);
});
test("HTTP 429 и 500 имеют разные понятные сообщения", () => {
  assert.match(apiErrorMessage({ statusCode: 429 }), /Слишком много запросов/);
  assert.match(apiErrorMessage({ statusCode: 500 }), /временно недоступен/);
});
test("API отклоняет неправильные поля и не принимает произвольные статусы", () => {
  assert.throws(() => validateCreateRequest({ title: "x" }));
  assert.throws(() => validateUpdateRequest({ status: "broken" }));
  assert.throws(() => validateUpdateRequest({ assignee_id: "not-a-user" }));
  assert.throws(() => validateComment({ text: "  ", author_name: "Анна" }));
  assert.deepEqual(validateUpdateRequest({ priority: "urgent" }), {
    priority: "urgent",
  });
});
test("серверное хранилище выдерживает параллельные изменения и повторное открытие", async () => {
  const base = resolve(".verification");
  await mkdir(base, { recursive: true });
  const directory = await mkdtemp(resolve(base, "repository-"));
  const file = resolve(directory, "workflow.json");
  const repository = createRepository(file);
  await Promise.all(
    Array.from({ length: 8 }, (_, index) =>
      repository.change((records) => {
        const id = Math.max(...records.map((item) => item.id)) + 1;
        records.unshift({
          ...structuredClone(records[0]!),
          id,
          title: `Concurrent ${index}`,
        });
      }),
    ),
  );
  const persisted = await createRepository(file).list();
  assert.equal(persisted.length, 33);
  assert.equal(new Set(persisted.map((item) => item.id)).size, 33);
  await assert.rejects(
    repository.change(() => {
      throw new Error("Rejected mutation");
    }),
  );
  assert.deepEqual(await repository.list(), persisted);
  await repository.change((records) => {
    records[0]!.description = "After failure";
  });
  assert.equal(
    (await createRepository(file).list())[0]?.description,
    "After failure",
  );
});
