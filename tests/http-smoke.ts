import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import type {
  ApiCollection,
  ApiItem,
  ApiRequest,
  ApiRequestsResponse,
} from "../shared/types/api";

export async function verifyHttp(base: string) {
  async function list(query = ""): Promise<ApiRequestsResponse> {
    const response = await fetch(`${base}/api/requests${query}`);
    assert.equal(response.status, 200);
    return (await response.json()) as ApiRequestsResponse;
  }
  for (const name of ["users", "customers", "categories"]) {
    const response = await fetch(`${base}/api/${name}`);
    assert.equal(response.status, 200);
    const result = (await response.json()) as ApiCollection<{
      id: string;
      name: string;
    }>;
    assert.ok(result.data.length > 0);
    assert.ok(result.data.every((item) => item.id && item.name));
  }
  const all = await list();
  assert.ok(all.meta.total >= 25);
  assert.equal(all.data.length, 12);
  const signature = (await (
    await fetch(`${base}/api/requests/1043`)
  ).json()) as ApiItem<ApiRequest>;
  assert.equal(signature.data.title, "не работает перчик");
  assert.equal(signature.data.description, "Витя не работает");
  const filtered = await list(
    "?q=CRM&status=in_progress&priority=high&sort=oldest",
  );
  assert.deepEqual(
    filtered.data.map((item) => item.id),
    [1042],
  );
  const page2 = await list("?page=2");
  assert.equal(page2.meta.page, 2);
  assert.ok(page2.data.every((a) => !all.data.some((b) => b.id === a.id)));
  assert.equal((await list("?q=unfindable-123456789")).meta.total, 0);
  assert.equal((await list("?page=-2&status=wrong")).meta.page, 1);
  const partial = await list("?scenario=missing-fields");
  assert.ok(
    partial.data.some(
      (item) =>
        item.id === 1038 &&
        item.title === undefined &&
        item.customer_id === undefined,
    ),
  );
  for (const code of [429, 500]) {
    const response = await fetch(`${base}/api/requests?scenario=${code}`);
    assert.equal(response.status, code);
    if (code === 429) assert.equal(response.headers.get("retry-after"), "1");
    assert.equal(
      (await fetch(`${base}/api/requests/1042?scenario=${code}`)).status,
      code,
    );
  }
  assert.equal((await fetch(`${base}/api/requests/999999`)).status, 404);
  const invalid = await fetch(`${base}/api/requests`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "x" }),
  });
  assert.equal(invalid.status, 400);
  for (const path of [
    "/",
    "/login",
    "/dashboard",
    "/requests",
    "/requests/1043",
    "/profile",
  ]) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.ok(html.includes("WorkFlow"));
    if (path === "/requests/1043") assert.ok(html.includes("Витя не работает"));
  }
  const direct = await (
    await fetch(`${base}/requests?q=CRM&status=in_progress&priority=high`)
  ).text();
  assert.ok(direct.includes("Не работает доступ к CRM"));
  console.log(
    "OK HTTP: four catalogs/list routes, detail, SSR, filters, pagination, empty, optional fields, 429, 500, 404 and validation",
  );
  return {
    total: all.meta.total,
    endpoints: 5,
    statuses: [200, 400, 404, 429, 500],
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await verifyHttp(process.env.WORKFLOW_BASE_URL ?? "http://127.0.0.1:3002");
