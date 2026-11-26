import { createError } from "h3";
import type {
  CreateCommentBody,
  CreateRequestBody,
  UpdateRequestBody,
} from "../../shared/types/api";
import { priorities, statuses } from "../../shared/utils/request-options";
import { createApiCatalogs } from "./seed";

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw createError({ statusCode: 400, statusMessage: "Expected an object" });
  return value as Record<string, unknown>;
}
function text(value: unknown, minimum: number, maximum: number): string {
  if (
    typeof value !== "string" ||
    value.trim().length < minimum ||
    value.trim().length > maximum
  )
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid text length",
    });
  return value.trim();
}
export function validateCreateRequest(value: unknown): CreateRequestBody {
  const body = object(value);
  const priority = priorities.find(
    (item) => item.value === body.priority,
  )?.value;
  const category = createApiCatalogs().categories.find(
    (item) => item.id === body.category_id,
  );
  if (!priority || !category)
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid priority or category",
    });
  return {
    title: text(body.title, 5, 120),
    description: text(body.description, 10, 3000),
    category_id: category.id,
    priority,
    author_name: text(body.author_name, 1, 100),
  };
}
export function validateUpdateRequest(value: unknown): UpdateRequestBody {
  const body = object(value);
  const result: UpdateRequestBody = {};
  if (body.assignee_id !== undefined) {
    if (body.assignee_id === null) result.assignee_id = null;
    else {
      const user = createApiCatalogs().users.find(
        (user) => user.id === body.assignee_id,
      );
      if (!user)
        throw createError({
          statusCode: 400,
          statusMessage: "Unknown assignee",
        });
      result.assignee_id = user.id;
    }
  }
  if (body.priority !== undefined) {
    const priority = priorities.find(
      (item) => item.value === body.priority,
    )?.value;
    if (!priority)
      throw createError({ statusCode: 400, statusMessage: "Invalid priority" });
    result.priority = priority;
  }
  if (body.status !== undefined) {
    const status = statuses.find((item) => item.value === body.status)?.value;
    if (!status)
      throw createError({ statusCode: 400, statusMessage: "Invalid status" });
    result.status = status;
  }
  if (!Object.keys(result).length)
    throw createError({
      statusCode: 400,
      statusMessage: "No fields to update",
    });
  if (body.expected_revision !== undefined) {
    if (
      typeof body.expected_revision !== "number" ||
      !Number.isSafeInteger(body.expected_revision) ||
      body.expected_revision < 1
    )
      throw createError({ statusCode: 400, statusMessage: "Invalid revision" });
    result.expected_revision = body.expected_revision;
  }
  return result;
}
export function validateComment(value: unknown): CreateCommentBody {
  const body = object(value);
  return {
    text: text(body.text, 1, 2000),
    author_name: text(body.author_name, 1, 100),
  };
}
