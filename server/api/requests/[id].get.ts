import { createError, defineEventHandler, getQuery, getRouterParam } from "h3";
import { requestRepository } from "../../utils/repository";
import { applyApiScenario } from "../../utils/scenario";
export default defineEventHandler(async (event) => {
  await applyApiScenario(event);
  const request = (await requestRepository.list()).find(
    (item) => String(item.id) === getRouterParam(event, "id"),
  );
  if (!request)
    throw createError({ statusCode: 404, statusMessage: "Request not found" });
  if (getQuery(event).scenario === "long") {
    request.title =
      "После обновления корпоративной CRM сотрудники отдела продаж не могут войти в систему и открыть карточки клиентов";
    request.status = "in_progress";
    request.assignee_id = "user-5";
    request.comments = [
      ...(request.comments ?? []).slice(0, 1),
      {
        id: "long-comment-2",
        author_id: "user-3",
        text: "Заявку приняла. Проверяем права доступа.",
        created_at: "2026-10-05T06:25:00.000Z",
      },
      {
        id: "long-comment-3",
        author_id: "user-3",
        text: "Нашла причину: после обновления сбросилась группа доступа.",
        created_at: "2026-10-05T07:05:00.000Z",
      },
    ];
    request.timeline = [
      ...(request.timeline ?? []).slice(0, 1),
      {
        id: "long-event-2",
        title: "Оператор назначил Брунгильду Брунгильдовну",
        created_at: "2026-10-05T06:25:00.000Z",
        kind: "status",
      },
      {
        id: "long-event-3",
        title: "Брунгильда начала работу",
        created_at: "2026-10-05T07:00:00.000Z",
        kind: "status",
      },
    ];
  }
  return { data: request };
});
