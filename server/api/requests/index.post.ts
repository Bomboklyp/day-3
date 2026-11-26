import { defineEventHandler, readBody, setResponseStatus } from "h3";
import { randomUUID } from "node:crypto";
import type { ApiRequest } from "../../../shared/types/api";
import { requestRepository } from "../../utils/repository";
import { validateCreateRequest } from "../../utils/validation";
export default defineEventHandler(async (event) => {
  const input = validateCreateRequest(await readBody<unknown>(event));
  const request = await requestRepository.change((requests) => {
    const now = new Date().toISOString();
    const record: ApiRequest = {
      id: Math.max(1043, ...requests.map((request) => request.id)) + 1,
      title: input.title,
      description: input.description,
      category_id: input.category_id,
      priority: input.priority,
      status: "new",
      customer_id: "customer-1",
      author_id: "user-1",
      author_name: input.author_name,
      assignee_id: null,
      created_at: now,
      due_at: new Date(Date.now() + 86400000).toISOString(),
      comments: [],
      timeline: [
        {
          id: randomUUID(),
          title: `${input.author_name} создала заявку`,
          created_at: now,
          kind: "created",
        },
      ],
    };
    requests.unshift(record);
    return record;
  });
  setResponseStatus(event, 201);
  return { data: request };
});
