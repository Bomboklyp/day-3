import type {
  ApiItem,
  ApiRequest,
  CreateCommentBody,
  CreateRequestBody,
  UpdateRequestBody,
} from "../../shared/types/api";
import { useRequestUiStore } from "~/stores/requestUi";
import { apiErrorMessage } from "~/utils/api";
import { priorities, statuses } from "#shared/utils/request-options";

export function useRequestActions() {
  const { profile } = useWorkflow();
  const ui = useRequestUiStore();
  const cache = useRequestCache();
  const route = useRoute();
  const mutationQuery = () =>
    typeof route.query.mutation === "string"
      ? { scenario: route.query.mutation }
      : undefined;
  async function createRequest(input: Omit<CreateRequestBody, "author_name">) {
    return (
      await $fetch<ApiItem<ApiRequest>>("/api/requests", {
        method: "POST",
        body: {
          ...input,
          author_name: profile.value.name,
        } satisfies CreateRequestBody,
        retry: 0,
      })
    ).data;
  }
  async function updateRequest(id: number, input: UpdateRequestBody) {
    const sequence = ui.begin(id);
    if (!sequence) throw new Error("Request mutation already in progress");
    try {
      const before =
        cache.find(id) ??
        (await $fetch<ApiItem<ApiRequest>>(`/api/requests/${id}`, { retry: 0 }))
          .data;
      const oldPriority = before.priority,
        oldStatus = before.status;
      if (input.priority && input.priority !== oldPriority)
        ui.priorityChanges[id] = { before: oldPriority, after: input.priority };
      ui.notice = {
        requestId: id,
        kind: "saving",
        message: input.priority
          ? "Сохраняем приоритет…"
          : "Сохраняем изменения…",
      };
      const response = await $fetch<ApiItem<ApiRequest>>(
        `/api/requests/${id}`,
        {
          method: "PATCH",
          body: { ...input, expected_revision: before.revision ?? 1 },
          query: mutationQuery(),
          retry: 0,
        },
      );
      cache.commit(response.data);
      ui.notice = {
        requestId: id,
        kind: "success",
        message: input.priority
          ? `Приоритет изменён на «${priorities.find((item) => item.value === response.data.priority)?.label}»`
          : input.status
            ? `Статус изменён на «${statuses.find((item) => item.value === response.data.status)?.label}»`
            : "Исполнитель изменён",
      };
      if (input.priority && oldPriority !== response.data.priority)
        ui.remember({
          id,
          sequence,
          field: "priority",
          before: oldPriority,
          after: response.data.priority,
        });
      else if (input.status && oldStatus !== response.data.status)
        ui.remember({
          id,
          sequence,
          field: "status",
          before: oldStatus,
          after: response.data.status,
        });
      return response.data;
    } catch (error: unknown) {
      ui.notice = {
        requestId: id,
        kind: "error",
        message: `Предыдущее значение восстановлено. ${apiErrorMessage(error)}`,
      };
      throw error;
    } finally {
      ui.finish(id, sequence);
    }
  }
  async function addComment(id: number, text: string) {
    const sequence = ui.begin(id);
    if (!sequence) throw new Error("Request mutation already in progress");
    try {
      const result = await $fetch<ApiItem<ApiRequest>>(
        `/api/requests/${id}/comments`,
        {
          method: "POST",
          body: {
            text,
            author_name: profile.value.name,
          } satisfies CreateCommentBody,
          query: mutationQuery(),
          retry: 0,
        },
      );
      cache.commit(result.data);
      return result.data;
    } finally {
      ui.finish(id, sequence);
    }
  }
  async function undoLastChange() {
    const change = ui.undo;
    if (!change) return;
    const sequence = ui.begin(change.id);
    if (!sequence) return;
    try {
      const current =
        cache.find(change.id) ??
        (
          await $fetch<ApiItem<ApiRequest>>(`/api/requests/${change.id}`, {
            retry: 0,
          })
        ).data;
      if (current[change.field] !== change.after) {
        ui.forget(change.sequence);
        throw { statusCode: 409 };
      }
      if (change.field === "priority")
        ui.priorityChanges[change.id] = {
          before: current.priority,
          after: change.before,
        };
      const body: UpdateRequestBody =
        change.field === "priority"
          ? { priority: change.before }
          : { status: change.before };
      const result = await $fetch<ApiItem<ApiRequest>>(
        `/api/requests/${change.id}`,
        {
          method: "PATCH",
          body: { ...body, expected_revision: current.revision ?? 1 },
          query: mutationQuery(),
          retry: 0,
        },
      );
      cache.commit(result.data);
      ui.forget(change.sequence);
      ui.notice = {
        requestId: change.id,
        kind: "success",
        message: "Изменение отменено",
      };
    } catch (error: unknown) {
      ui.notice = {
        requestId: change.id,
        kind: "error",
        message: `Не удалось отменить изменение. ${apiErrorMessage(error)}`,
      };
    } finally {
      ui.finish(change.id, sequence);
    }
  }
  return { createRequest, updateRequest, addComment, undoLastChange };
}
