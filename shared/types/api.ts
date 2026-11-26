import type { RequestPriority, RequestStatus } from "./request";

export interface ApiUser {
  id: string;
  name: string;
  initials?: string;
  color?: string;
}
export interface ApiCustomer {
  id: string;
  name: string;
}
export interface ApiCategory {
  id: string;
  name: string;
}
export interface ApiCatalogs {
  users: ApiUser[];
  customers: ApiCustomer[];
  categories: ApiCategory[];
}
export interface ApiComment {
  id: string;
  text: string;
  author_id?: string | null;
  author_name?: string | null;
  created_at: string;
}
export interface ApiTimelineEvent {
  id: string;
  title: string;
  description?: string | null;
  created_at: string;
  kind: "created" | "status" | "comment";
}
export interface ApiRequest {
  revision?: number;
  id: number;
  title?: string | null;
  description?: string | null;
  status: RequestStatus;
  priority: RequestPriority;
  customer_id?: string | null;
  category_id?: string | null;
  author_id?: string | null;
  author_name?: string | null;
  assignee_id?: string | null;
  created_at: string;
  due_at?: string | null;
  comments?: ApiComment[] | null;
  timeline?: ApiTimelineEvent[] | null;
}
export interface ApiCollection<T> {
  data: T[];
}
export interface ApiItem<T> {
  data: T;
}
export interface ApiStats {
  new: number;
  in_progress: number;
  waiting: number;
  resolved: number;
}
export interface ApiPagination {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}
export interface ApiRequestsResponse extends ApiCollection<ApiRequest> {
  meta: ApiPagination;
  stats: ApiStats;
}
export interface RequestsQuery {
  q: string;
  status: RequestStatus | "";
  priority: RequestPriority | "";
  assignment: "" | "unassigned" | "mine";
  sort: "newest" | "oldest" | "priority";
  page: number;
  per_page: number;
  scenario: string;
}
export interface CreateRequestBody {
  title: string;
  description: string;
  category_id: string;
  priority: RequestPriority;
  author_name: string;
}
export interface UpdateRequestBody {
  assignee_id?: string | null;
  priority?: RequestPriority;
  status?: RequestStatus;
  expected_revision?: number;
}
export interface CreateCommentBody {
  text: string;
  author_name: string;
}
