import type { MockScenario } from "~/types/workflow";

export function useMockScenario() {
  const scenario = ref<MockScenario>("success");
  let timer: ReturnType<typeof setTimeout> | undefined;

  function selectScenario(value: MockScenario) {
    clearTimeout(timer);
    scenario.value = value;
    if (value === "loading")
      timer = setTimeout(() => {
        scenario.value = "success";
      }, 1800);
  }

  onMounted(() => selectScenario("loading"));
  onBeforeUnmount(() => clearTimeout(timer));
  return { scenario, selectScenario };
}
