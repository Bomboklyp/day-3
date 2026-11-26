import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { ApiRequest } from "../../shared/types/api";
import { createApiSeed } from "./seed";

interface Database {
  version: 1;
  requests: ApiRequest[];
}
export function createRepository(file: string) {
  let queue: Promise<void> = Promise.resolve();
  async function read(): Promise<ApiRequest[]> {
    try {
      const parsed: unknown = JSON.parse(await readFile(file, "utf8"));
      if (
        !parsed ||
        typeof parsed !== "object" ||
        !("version" in parsed) ||
        parsed.version !== 1 ||
        !("requests" in parsed) ||
        !Array.isArray(parsed.requests)
      )
        throw new Error("Invalid WorkFlow database format");
      return parsed.requests as ApiRequest[];
    } catch (error: unknown) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
      )
        return createApiSeed();
      throw error;
    }
  }
  return {
    async list() {
      await queue;
      return read();
    },
    async change<T>(mutate: (requests: ApiRequest[]) => T): Promise<T> {
      const operation = queue.then(async () => {
        const records = await read();
        const result = mutate(records);
        await mkdir(dirname(file), { recursive: true });
        const temporary = `${file}.${process.pid}.tmp`;
        const database: Database = { version: 1, requests: records };
        await writeFile(temporary, JSON.stringify(database, null, 2), "utf8");
        await rename(temporary, file);
        return result;
      });
      queue = operation.then(
        () => undefined,
        () => undefined,
      );
      return operation;
    },
  };
}
const file =
  process.env.WORKFLOW_DATA_FILE ??
  resolve(process.cwd(), ".data/workflow.json");
export const requestRepository = createRepository(file);
