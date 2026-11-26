<script setup lang="ts">
import type { RequestFilters } from "~/types/workflow";
import { statuses, priorities } from "~/utils/requests";
const model = defineModel<RequestFilters>({ required: true });
withDefaults(defineProps<{ simple?: boolean }>(), { simple: false });
const id = useId();
</script>
<template>
  <div
    class="request-filters"
    :class="{ 'filters-simple': simple }"
    role="search"
    aria-label="Фильтры заявок"
  >
    <label class="field search-field" :for="id + '-search'"
      ><span>Поиск</span
      ><input
        :id="id + '-search'"
        v-model="model.search"
        type="search"
        placeholder="Номер или название заявки" /></label
    ><label class="field" :for="id + '-status'"
      ><span>Статус</span
      ><select :id="id + '-status'" aria-label="Статус" v-model="model.status">
        <option value="">Все статусы</option>
        <option
          v-for="status in statuses"
          :key="status.value"
          :value="status.value"
        >
          {{ status.label }}
        </option>
      </select></label
    ><label class="field" :for="id + '-priority'"
      ><span>Приоритет</span
      ><select
        :id="id + '-priority'"
        aria-label="Приоритет"
        v-model="model.priority"
      >
        <option value="">Все приоритеты</option>
        <option
          v-for="priority in priorities"
          :key="priority.value"
          :value="priority.value"
        >
          {{ priority.label }}
        </option>
      </select></label
    ><label v-if="!simple" class="field" :for="id + '-assignment'"
      ><span>Назначение</span
      ><select
        :id="id + '-assignment'"
        aria-label="Назначение"
        v-model="model.assignment"
      >
        <option value="">Все заявки</option>
        <option value="unassigned">Не назначены</option>
        <option value="mine">Назначены мне</option>
      </select></label
    ><label v-if="!simple" class="field" :for="id + '-sort'"
      ><span>Сортировка</span
      ><select :id="id + '-sort'" aria-label="Сортировка" v-model="model.sort">
        <option value="newest">Сначала новые</option>
        <option value="oldest">Сначала старые</option>
        <option value="priority">По приоритету</option>
      </select></label
    >
  </div>
</template>
