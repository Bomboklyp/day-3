import {
  createError,
  defineEventHandler,
  getRouterParam,
  readBody,
  setResponseStatus,
} from "h3";
import { randomUUID } from "node:crypto";
import { requestRepository } from "../../../utils/repository";
import { validateComment } from "../../../utils/validation";
import { applyApiScenario } from "../../../utils/scenario";
export default defineEventHandler(async (event) => {
  await applyApiScenario(event);
  const input = validateComment(await readBody<unknown>(event));
  const request = await requestRepository.change((requests) => {
    const request = requests.find(
      (item) => String(item.id) === getRouterParam(event, "id"),
    );
    if (!request)
      throw createError({
        statusCode: 404,
        statusMessage: "Request not found",
      });
    const now = new Date().toISOString();
    (request.comments ??= []).push({
      id: randomUUID(),
      text: input.text,
      author_id: "user-1",
      author_name: input.author_name,
      created_at: now,
    });
    (request.timeline ??= []).push({
      id: randomUUID(),
      title: `${input.author_name} добавила комментарий`,
      created_at: now,
      kind: "comment",
    });
    request.revision = (request.revision ?? 1) + 1;
    return request;
  });
  setResponseStatus(event, 201);
  return { data: request };
});
