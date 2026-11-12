<!-- One facet with a list of values (group, colour, material): a checkbox per value with its count. -->
<script setup lang="ts">
import type { FacetValue } from "#shared/types/site";

defineProps<{
  legend: string;
  name: string;
  values: FacetValue[];
  labelOf: (value: string) => string;
  /** A colour facet: the swatch of a value, a CSS colour from the PIM. */
  swatchOf?: (value: string) => string | undefined;
}>();
</script>

<template>
  <fieldset v-if="values.length" class="facet">
    <legend>{{ legend }}</legend>
    <label v-for="v in values" :key="v.value" class="facet__option">
      <!-- No hit with the other filters: stays listed (the list never changes), but cannot be chosen. -->
      <input type="checkbox" :name="name" :value="v.value" :checked="v.selected" :disabled="v.count === 0 && !v.selected">
      <span v-if="swatchOf" class="swatch" :style="{ '--swatch': swatchOf(v.value) }" aria-hidden="true" />
      <span>{{ labelOf(v.value) }}</span>
      <span class="facet__count">{{ v.count }}</span>
    </label>
  </fieldset>
</template>
