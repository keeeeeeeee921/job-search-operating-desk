"use server";

import { revalidatePath } from "next/cache";
import {
  createSearchCycle,
  getSearchCycles,
  updateSearchCycle
} from "@/lib/db/repository";
import {
  getSearchCycleDateKey,
  getCurrentSearchCycle,
  previousSearchCycleDateKey
} from "@/lib/search-cycle";
import {
  parseNewSearchCycleForm,
  parseSearchCycleStoryForm,
  validateNewSearchCycleAgainst,
  validateSearchCycleStoryAgainst,
  type SearchCycleFormValues
} from "@/lib/search-cycle-form";
import { getWriteBlock } from "@/lib/server/auth";
import type { SearchCycle } from "@/lib/types";

export type SearchCycleActionResult =
  | { ok: true; cycle: SearchCycle }
  | { ok: false; error: string };

function revalidateSearchCyclePages() {
  for (const path of ["/", "/active", "/rejected", "/search-log"]) {
    revalidatePath(path);
  }
}

export async function saveSearchCycleStory(
  cycleId: number,
  values: SearchCycleFormValues
): Promise<SearchCycleActionResult> {
  const blocked = await getWriteBlock();
  if (blocked) {
    return { ok: false, error: blocked.message };
  }

  if (!Number.isInteger(cycleId) || cycleId <= 0) {
    return { ok: false, error: "Unknown search cycle." };
  }

  const parsed = parseSearchCycleStoryForm(values);
  if (!parsed.ok) {
    return parsed;
  }

  const cycles = await getSearchCycles();
  if (!cycles.some((cycle) => cycle.id === cycleId)) {
    return { ok: false, error: "Unknown search cycle." };
  }

  const conflict = validateSearchCycleStoryAgainst(parsed.value, cycleId, cycles);
  if (conflict) {
    return { ok: false, error: conflict };
  }

  const cycle = await updateSearchCycle(cycleId, parsed.value);
  revalidateSearchCyclePages();
  return { ok: true, cycle };
}

/**
 * Starts a new cycle; it becomes the current working set and new records
 * are assigned to it. The previous cycle, if still open, is closed the day
 * before the new start date.
 */
export async function startSearchCycle(
  values: SearchCycleFormValues
): Promise<SearchCycleActionResult> {
  const blocked = await getWriteBlock();
  if (blocked) {
    return { ok: false, error: blocked.message };
  }

  const parsed = parseNewSearchCycleForm(values);
  if (!parsed.ok) {
    return parsed;
  }

  const cycles = await getSearchCycles();
  const conflict = validateNewSearchCycleAgainst(
    parsed.value,
    cycles,
    getSearchCycleDateKey()
  );
  if (conflict) {
    return { ok: false, error: conflict };
  }

  const previous = getCurrentSearchCycle(cycles);
  if (previous && previous.endDate === null) {
    await updateSearchCycle(previous.id, {
      endDate: previousSearchCycleDateKey(parsed.value.startDate)
    });
  }

  const cycle = await createSearchCycle({
    label: parsed.value.label,
    startDate: parsed.value.startDate,
    endDate: null,
    title: "",
    goals: [],
    note: "",
    imageSrc: null
  });
  revalidateSearchCyclePages();
  return { ok: true, cycle };
}
