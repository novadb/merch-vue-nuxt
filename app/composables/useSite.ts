/** The region of the page and what every page of it needs: texts, navigation, the shop's settings (`GET /api/site/{region}`). */
import type { SiteData } from "#shared/types/site";
import { regionOfPath, type Region } from "#shared/utils/regions";
import { t, type Texts } from "#shared/utils/texts";

/** The region of the URL (`de`, `uk`, `us`); `us` on an error page outside them. It stays the same for the life of a document: the region switch is a document load. */
export const useRegion = (): Region => regionOfPath(useRoute().path);

/** The key of a region's site data: `useTexts()` finds the data again by it. */
const siteKey = (region: Region) => `site:${region}`;

/** Loads the site data of the page's region once per document: a page the visitor navigates to takes it from the one before. */
export function useSite() {
  const region = useRegion();
  return useAsyncData(siteKey(region), () => $fetch<SiteData>(`/api/site/${region}`), {
    getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
  });
}

/** The UI texts of the page's region. Needs `useSite()` to have run first: it reads that data by its key. */
export function useTexts(): ComputedRef<Texts> {
  const { data } = useNuxtData<SiteData>(siteKey(useRegion()));
  return computed(() => {
    if (!data.value) throw new Error("useTexts() before useSite() has loaded the site data");
    return t(data.value.labels, data.value.region);
  });
}
