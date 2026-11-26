import type {
  ApiCatalogs,
  ApiRequest,
  ApiRequestsResponse,
  RequestsQuery,
} from "../../shared/types/api";
import { priorities } from "../../shared/utils/request-options";

export function selectRequests(
  records: ApiRequest[],
  query: RequestsQuery,
  catalogs: ApiCatalogs,
): ApiRequestsResponse {
  const lower = (value: string) => value.toLocaleLowerCase("ru-RU");
  const weight = (request: ApiRequest) =>
    priorities.find((item) => item.value === request.priority)?.weight ?? 0;
  const selected = records
    .filter((request) => {
      const customer =
        catalogs.customers.find((item) => item.id === request.customer_id)
          ?.name ?? "";
      const matchesSearch =
        !query.q ||
        [
          request.title ?? "",
          request.description ?? "",
          `#${request.id}`,
          customer,
        ].some((text) => lower(text).includes(lower(query.q)));
      return (
        matchesSearch &&
        (!query.status || request.status === query.status) &&
        (!query.priority || request.priority === query.priority) &&
        (!query.assignment ||
          (query.assignment === "unassigned"
            ? !request.assignee_id
            : request.assignee_id === "user-1"))
      );
    })
    .sort((a, b) =>
      query.sort === "priority"
        ? weight(b) - weight(a) || b.id - a.id
        : query.sort === "oldest"
          ? Date.parse(a.created_at) - Date.parse(b.created_at) || a.id - b.id
          : Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id,
    );
  const total = query.scenario === "empty" ? 0 : selected.length;
  const totalPages = Math.max(1, Math.ceil(total / query.per_page));
  const page = Math.min(query.page, totalPages);
  return {
    data: total
      ? selected.slice((page - 1) * query.per_page, page * query.per_page)
      : [],
    meta: { page, per_page: query.per_page, total, total_pages: totalPages },
    stats: {
      new: records.filter((r) => r.status === "new").length,
      in_progress: records.filter((r) => r.status === "in_progress").length,
      waiting: records.filter((r) => r.status === "waiting").length,
      resolved: records.filter((r) => r.status === "resolved").length,
    },
  };
}
