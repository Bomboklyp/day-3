import { createError, defineEventHandler, getRouterParam, readBody } from "h3";
import { randomUUID } from "node:crypto";
import { requestRepository } from "../../utils/repository";
import { validateUpdateRequest } from "../../utils/validation";
import { priorities, statuses } from "../../../shared/utils/request-options";
import { applyApiScenario } from "../../utils/scenario";
export default defineEventHandler(async (event) => {
  await applyApiScenario(event);
  const input = validateUpdateRequest(await readBody<unknown>(event));
  return {
    data: await requestRepository.change((requests) => {
      const request = requests.find(
        (item) => String(item.id) === getRouterParam(event, "id"),
      );
      if (!request)
        throw createError({
          statusCode: 404,
          statusMessage: "Request not found",
        });
      if (
        input.expected_revision !== undefined &&
        input.expected_revision !== (request.revision ?? 1)
      )
        throw createError({
          statusCode: 409,
          statusMessage: "Request changed by another user",
        });
      const status =
        input.status ??
        (input.assignee_id && request.status === "new"
          ? "assigned"
          : request.status);
      if (input.assignee_id !== undefined)
        request.assignee_id = input.assignee_id;
      if (input.priority && input.priority !== request.priority) {
        request.priority = input.priority;
        (request.timeline ??= []).push({
          id: randomUUID(),
          title:
            "Приоритет изменён на «" +
            priorities.find((item) => item.value === input.priority)?.label +
            "»",
          created_at: new Date().toISOString(),
          kind: "status",
        });
      }
      if (status !== request.status) {
        request.status = status;
        (request.timeline ??= []).push({
          id: randomUUID(),
          title:
            "Статус: " + statuses.find((item) => item.value === status)?.label,
          created_at: new Date().toISOString(),
          kind: "status",
        });
      }
      request.revision = (request.revision ?? 1) + 1;
      return request;
    }),
  };
});
