import { defineEventHandler } from "h3";
import { createApiCatalogs } from "../../utils/seed";
export default defineEventHandler(() => ({ data: createApiCatalogs().users }));
