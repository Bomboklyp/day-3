import assert from "node:assert/strict";
import { test } from "node:test";
import { createMockRequests } from "../app/data/requests";
import {
  ensureProjectRequest,
  projectRequestTitle,
} from "../app/data/project-request";
import { filterRequests, priorities, statuses } from "../app/utils/requests";
import { formatDate, initials, requestLabel } from "../app/utils/format";
import type { RequestFilters } from "../app/types/workflow";

const defaults: RequestFilters = {
  search: "",
  status: "",
  priority: "",
  sort: "newest",
};

test("mock-набор содержит не менее 12 уникальных полных заявок и все варианты фильтров", () => {
  const requests = createMockRequests();
  assert.ok(requests.length >= 12);
  assert.equal(new Set(requests.map((item) => item.id)).size, requests.length);
  for (const status of statuses)
    assert.ok(requests.some((item) => item.status === status.value));
  for (const priority of priorities)
    assert.ok(requests.some((item) => item.priority === priority.value));
  for (const item of requests) {
    assert.ok(
      item.title && item.description && item.author.name && item.assignee.name,
    );
    assert.ok(item.timeline.some((event) => event.kind === "created"));
    assert.ok(!Number.isNaN(new Date(item.createdAt).getTime()));
    assert.ok(new Date(item.dueAt) > new Date(item.createdAt));
  }
});

test("статус и приоритет применяются одновременно", () => {
  const result = filterRequests(createMockRequests(), {
    ...defaults,
    status: "in_progress",
    priority: "urgent",
  });
  assert.equal(result.length, 2);
  assert.ok(
    result.every(
      (item) => item.status === "in_progress" && item.priority === "urgent",
    ),
  );
});

test("поиск находит номер заявки и не зависит от регистра и пробелов", () => {
  const requests = createMockRequests();
  assert.equal(
    filterRequests(requests, { ...defaults, search: " #1042 " })[0]?.id,
    1042,
  );
  assert.equal(
    filterRequests(requests, { ...defaults, search: "ДОСТУП К CRM" })[0]?.id,
    1042,
  );
  assert.ok(
    filterRequests(requests, { ...defaults, search: "Мария Смирнова" }).every(
      (item) => item.author.name === "Мария Смирнова",
    ),
  );
});

test("несуществующий запрос возвращает пустой список; сброс восстанавливает все заявки", () => {
  const requests = createMockRequests();
  assert.deepEqual(
    filterRequests(requests, {
      ...defaults,
      search: "несуществующий космолёт",
    }),
    [],
  );
  assert.equal(filterRequests(requests, defaults).length, requests.length);
});

test("сортировка по датам и приоритету не изменяет исходный массив", () => {
  const requests = createMockRequests();
  const original = requests.map((item) => item.id);
  const newest = filterRequests(requests, defaults);
  const oldest = filterRequests(requests, { ...defaults, sort: "oldest" });
  const urgentFirst = filterRequests(requests, {
    ...defaults,
    sort: "priority",
  });
  assert.ok(
    new Date(newest[0]!.createdAt) >= new Date(newest.at(-1)!.createdAt),
  );
  assert.ok(
    new Date(oldest[0]!.createdAt) <= new Date(oldest.at(-1)!.createdAt),
  );
  assert.equal(urgentFirst[0]?.priority, "urgent");
  assert.equal(urgentFirst.at(-1)?.priority, "low");
  assert.deepEqual(
    requests.map((item) => item.id),
    original,
  );
});

test("новый mock-набор не получает комментарии и события от предыдущего", () => {
  const first = createMockRequests();
  const original = first.find((request) => request.id === 1042)!;
  original.title = "Изменено";
  original.comments.splice(0);
  original.timeline.splice(0);
  const second = createMockRequests();
  const restored = second.find((request) => request.id === 1042)!;
  assert.notEqual(restored.title, "Изменено");
  assert.ok(restored.comments.length > 0);
  assert.ok(restored.timeline.length > 0);
});

test("заявка пользователя добавляется в старый набор без изменения остальных данных", () => {
  const legacy = createMockRequests().filter((request) => request.id !== 1043);
  const before = structuredClone(legacy);
  const updated = ensureProjectRequest(legacy);
  assert.deepEqual(legacy, before);
  assert.deepEqual(updated.slice(1), before);
  assert.equal(updated[0]?.id, 1043);
  assert.equal(updated[0]?.title, projectRequestTitle);
  assert.equal(updated[0]?.description, "Витя не работает");
  assert.equal(updated[0]?.priority, "urgent");
  assert.equal(ensureProjectRequest(updated), updated);
});

test("повторная загрузка сохраняет уже созданную заявку, комментарии и даты", () => {
  const saved = createMockRequests();
  const request = saved.find((item) => item.id === 1043)!;
  request.title = "  НЕ РАБОТАЕТ ПЕРЧИК  ";
  request.createdAt = "2026-11-20T10:00:00.000Z";
  request.status = "in_progress";
  request.comments.push({
    id: "user-comment",
    author: { ...request.author },
    text: "Мой комментарий",
    createdAt: request.createdAt,
  });
  const before = structuredClone(saved);
  assert.equal(ensureProjectRequest(saved), saved);
  assert.deepEqual(saved, before);
});

test("занятый номер не приводит к перезаписи другой заявки или дубликату ID", () => {
  const saved = createMockRequests().filter((request) => request.id !== 1043);
  saved[0]!.id = 1043;
  const before = structuredClone(saved);
  const updated = ensureProjectRequest(saved);
  assert.equal(updated[0]?.id, 1044);
  assert.deepEqual(updated.slice(1), before);
  assert.equal(
    new Set(updated.map((request) => request.id)).size,
    updated.length,
  );
});

test("форматирование корректно обрабатывает инициалы и московскую дату", () => {
  assert.equal(initials("  Анна   Петрова "), "АП");
  assert.equal(initials(""), "Я");
  assert.equal(requestLabel(1042), "#1042");
  assert.match(formatDate("2026-11-14T22:00:00Z"), /15/);
});
