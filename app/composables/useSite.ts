/** The region of the page and what every page of it needs: texts, navigation, the shop's settings (`GET /api/site/{region}`). */
import type { SiteData } from "#shared/types/site";
import { regionOfPath, type Region } from "#shared/utils/regions";
import { t, type Texts } from "#shared/utils/texts";

/** The region of the URL (`de`, `uk`, `us`); `us` on an error page outside them. */
export const useRegion = (): Region => regionOfPath(useRoute().path);

/** Loads the site data of the page's region, once per document: on the server, the browser takes it from the payload. */
export const useSite = () => {
  const region = useRegion();
  return useAsyncData("site", () => $fetch<SiteData>(`/api/site/${region}`));
};

/** The UI texts of the page's region. The page has loaded them (`useSite`) before any component asks. */
export function useTexts(): ComputedRef<Texts> {
  const { data } = useNuxtData<SiteData>("site");
  return computed(() => {
    if (!data.value) throw new Error("useTexts() before useSite() has loaded the site data");
    return t(data.value.labels, data.value.region);
  });
}
