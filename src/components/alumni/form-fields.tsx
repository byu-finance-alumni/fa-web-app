"use client";

/**
 * Alumni form primitives — now a thin re-export of the app-wide shared set.
 *
 * The implementations moved to `@/components/shared/form-fields` (#611) so the
 * events add/edit forms are built from the SAME components as the alumni ones
 * instead of a lookalike copy that drifts. Nothing about the alumni forms
 * changed; this path is kept so their imports (AlumniForm, FocusedEditForm, the
 * six edit-section forms, Combobox, RegionSelect) stay put.
 */
export {
  Field,
  FieldLabel,
  SelectField,
  Checkbox,
  TextareaField,
  Section,
} from "@/components/shared/form-fields";
