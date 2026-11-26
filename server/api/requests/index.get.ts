import { defineEventHandler, getQuery } from "h3";
import { readRequestsQuery } from "../../../shared/utils/request-query";
import { requestRepository } from "../../utils/repository";
import { createApiCatalogs } from "../../utils/seed";
import { selectRequests } from "../../utils/request-service";
import { applyApiScenario } from "../../utils/scenario";

export default defineEventHandler(async (event) => {
  await applyApiScenario(event);
  const query = readRequestsQuery(getQuery(event));
  const records = await requestRepository.list();
  if (query.scenario === "missing-fields") {
    const record = records.find((request) => request.id === 1038);
    if (record) {
      delete record.title;
      delete record.description;
      delete record.customer_id;
      delete record.category_id;
      delete record.due_at;
      delete record.comments;
      delete record.timeline;
    }
  }
  if (query.scenario === "long") {
    const record = records.find((request) => request.id === 1042);
    if (record)
      record.title =
        "Настроить автоматическую выгрузку данных из CRM в корпоративную систему аналитики для всех подразделений компании";
  }
  return selectRequests(records, query, createApiCatalogs());
});
