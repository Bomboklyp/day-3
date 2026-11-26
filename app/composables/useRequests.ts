import type { MaybeRefOrGetter } from "vue";
import type {
  ApiItem,
  ApiRequest,
  ApiRequestsResponse,
  RequestsQuery,
} from "../../shared/types/api";
import { mapApiRequest } from "~/utils/api";
import { useRequestUiStore } from "~/stores/requestUi";

export function useRequests(query: MaybeRefOrGetter<RequestsQuery>) {
  const ui = useRequestUiStore();
  const catalogs = useCatalogs();
  const response = useFetch<ApiRequestsResponse>("/api/requests", {
    key: computed(() => "workflow-requests:" + JSON.stringify(toValue(query))),
    query: computed(() => toValue(query)),
    lazy: true,
    retry: 0,
  });
  const error = computed(() => response.error.value ?? catalogs.error.value);
  const pending = computed(
    () =>
      response.status.value === "pending" ||
      catalogs.status.value === "pending",
  );
  const requests = computed(() =>
    catalogs.data.value
      ? (response.data.value?.data ?? []).map((request) =>
          mapApiRequest(
            {
              ...request,
              priority:
                ui.priorityChanges[request.id]?.after ?? request.priority,
            },
            catalogs.data.value!,
          ),
        )
      : [],
  );
  return {
    requests,
    meta: computed(() => response.data.value?.meta),
    stats: computed(() => response.data.value?.stats),
    error,
    pending,
    refresh: () => Promise.all([response.refresh(), catalogs.refresh()]),
  };
}
export function useRequest(
  id: MaybeRefOrGetter<string>,
  scenario: MaybeRefOrGetter<string>,
) {
  const ui = useRequestUiStore();
  const catalogs = useCatalogs();
  const response = useFetch<ApiItem<ApiRequest>>(
    () => `/api/requests/${toValue(id)}`,
    {
      key: computed(
        () => `workflow-request:${toValue(id)}:${toValue(scenario)}`,
      ),
      query: computed(() => ({ scenario: toValue(scenario) || undefined })),
      lazy: true,
      retry: 0,
    },
  );
  return {
    request: computed(() =>
      response.data.value?.data && catalogs.data.value
        ? mapApiRequest(
            {
              ...response.data.value.data,
              priority:
                ui.priorityChanges[response.data.value.data.id]?.after ??
                response.data.value.data.priority,
            },
            catalogs.data.value,
          )
        : undefined,
    ),
    users: computed(() => catalogs.data.value?.users ?? []),
    error: computed(() => response.error.value ?? catalogs.error.value),
    pending: computed(
      () =>
        response.status.value === "pending" ||
        catalogs.status.value === "pending",
    ),
    refresh: () => Promise.all([response.refresh(), catalogs.refresh()]),
  };
}
