// Form schema types for the Kertrendező embeddable form.
// Designed to also serve the future editor view.

export type FieldType =
  | "text"
  | "textarea"
  | "slider"
  | "radio"
  | "checkbox"
  | "select"
  | "phone"
  | "date"
  | "image"
  | "label"
  | "post_code"
  | "city"
  | "street"
  | "email"
  | "measurement"
  | "repeater";

export type NotePosition = "above" | "below" | "side";

/** Allowed horizontal width values (percent of available row). */
export type WidthPercent = 25 | 33 | 40 | 50 | 60 | 100;
export const WIDTH_OPTIONS: WidthPercent[] = [25, 33, 40, 50, 60, 100];

export interface FieldOption {
  /** Display name shown to end-user (Hungarian). */
  displayName: string;
  /** Internal data name used for storage / webhooks. */
  dataName: string;
  /** Optional per-option note (used when uniqueNotePerOption is true). */
  note?: { value: string; position: NotePosition };
  /** Optional per-option illustration URL (used when useImages is true). */
  imageUrl?: string;
}

export interface FieldCondition {
  /** Discriminator — present so we can tell field rules from group rules. */
  kind?: "field";
  /** Field id whose answer we evaluate. */
  fieldId: string;
  operator: "is" | "is_not" | "equals" | "greater_than" | "less_than" | "contains" | "answered";
  value: string | number | boolean;
}

/**
 * Group-seen condition rule. Evaluates true when the user has (or hasn't,
 * when `seen === false`) entered the referenced group during the current
 * session. "Seen" is sticky — once entered, the group stays seen.
 */
export interface GroupSeenCondition {
  kind: "group_seen";
  /** Top-level group id or sub-group id whose seen-state we check. */
  groupId: string;
  /** When true: rule passes if group HAS been seen. When false: passes if NOT seen. */
  seen: boolean;
}

export type ConditionRule = FieldCondition | GroupSeenCondition | ConditionGroup;

export interface ConditionGroup {
  combinator: "and" | "or";
  rules: Array<ConditionRule>;
}

export interface BaseField {
  id: string;
  /** Internal "belső név". */
  internalName: string;
  /** External "külső név" shown to end-user. */
  label: string;
  /** Placeholder ("helykitöltő"). */
  placeholder?: string;
  required?: boolean;
  /** "megjegyzés" — note shown with the field. */
  note?: { value: string; position: NotePosition };
  /** Display position number ("elhelyezés"). Lower = earlier. */
  location: number;
  /** Group id this field belongs to (undefined = global / top-level). */
  groupId?: string;
  /** Sub-group id this field belongs to (must belong to groupId). */
  subGroupId?: string;
  /** Optional display condition. If undefined, always shown. */
  condition?: ConditionGroup;
  /** Optional horizontal width as percent of the row. Undefined = 100%. */
  width?: WidthPercent;
  /** When true, hides the field's label entirely (useful for compact rows). */
  hideLabel?: boolean;
}

export interface TextField extends BaseField { type: "text" }
export interface TextAreaField extends BaseField { type: "textarea" }
export interface SliderField extends BaseField {
  type: "slider";
  min: number;
  max: number;
  step?: number;
  unit?: string;
  /**
   * Optional manual break-points between min and max. When set (non-empty),
   * the slider snaps to these stops instead of using `step`. The end-user
   * picks ranges defined by consecutive stops, plus a final "max+" range.
   * Example: min=0, max=100, customStops=[10,40,80] → ranges
   *   0–10, 10–40, 40–80, 80–100, 100+
   */
  customStops?: number[];
  /**
   * How custom stops are spaced visually on the slider track.
   * "equal" (default): each stop occupies an equal segment regardless of value.
   * "proportional": stops sit at their numeric position between min and max.
   */
  customStopsSpacing?: "equal" | "proportional";
}
export interface PhoneField extends BaseField { type: "phone" }
export interface DateField extends BaseField { type: "date"; withTime?: boolean }
export interface ImageField extends BaseField { type: "image"; multiple?: boolean }
export interface PostCodeField extends BaseField { type: "post_code" }
export interface CityField extends BaseField { type: "city" }
export interface StreetField extends BaseField { type: "street" }
export interface EmailField extends BaseField { type: "email" }
/**
 * Display-only "Cím" element. Renders the field's label as a heading and
 * collects no value. Useful for grouping a row of compact unlabeled fields
 * under a single shared title.
 */
export interface LabelField extends BaseField { type: "label" }

/** Where the option's text label is rendered relative to its image. */
export type OptionLabelPosition = "above" | "below";

/** Where the select-field's preview image is rendered relative to the dropdown. */
export type FieldImagePosition = "above" | "below" | "left" | "right";

export interface OptionField extends BaseField {
  type: "radio" | "checkbox" | "select";
  options: FieldOption[];
  /** "egyedi megjegyzés mindegyik opcióhoz" */
  uniqueNotePerOption?: boolean;
  /** "illusztrációk használata" */
  useImages?: boolean;
  /** "oszlopok száma" */
  columns?: number;
  /** Position of each option's text label relative to its image (radio/checkbox). */
  optionLabelPosition?: OptionLabelPosition;
  /** Position of the preview image relative to the dropdown (select). */
  fieldImagePosition?: FieldImagePosition;
  /** Placeholder image shown until an option with an image is picked (select). */
  placeholderImageUrl?: string;
  /** Optional placeholder note shown alongside the placeholder image (select). */
  placeholderNote?: { value: string; position: NotePosition };
}

/**
 * Repeater field — lets the end-user add multiple "instances" (e.g. gardening
 * areas), each filled out via a modal sub-form. The repeater owns its own
 * list of child fields. Child fields are NOT rows in `form_fields`; they live
 * entirely inside this object (and are persisted in the `repeater_config`
 * JSONB column on the parent row).
 *
 * Submission shape: `values[repeaterId] = Array<Record<childInternalName, FieldValue>>`.
 */
export interface RepeaterField extends BaseField {
  type: "repeater";
  /** Singular noun used in buttons / empty state, e.g. "Terület". */
  itemLabel?: string;
  /** Override for the add-button label. Defaults to `Új ${itemLabel} hozzáadása`. */
  addButtonLabel?: string;
  /** Minimum required instances. `required` implies min ≥ 1 at validation time. */
  minInstances?: number;
  /** Maximum allowed instances; users can't add beyond this. */
  maxInstances?: number;
  /** Id of a child field whose value becomes the card title. Falls back to "${itemLabel} #N". */
  titleChildId?: string;
  /** Child fields rendered inside the per-instance modal. */
  children: FormField[];
}

/**
 * Measurement field — a single numeric input paired with a unit dropdown.
 * The author defines the available units (e.g. "hour", "day", "week"); the
 * end-user types a number and picks one unit. Stored as
 * `{ amount: number; unit: string }` (unit = the chosen option's `dataName`).
 */
export interface MeasurementField extends BaseField {
  type: "measurement";
  /** Available unit options (uses the same shape as radio/checkbox/select). */
  options: FieldOption[];
}

export type FormField =
  | TextField
  | TextAreaField
  | SliderField
  | PhoneField
  | DateField
  | ImageField
  | OptionField
  | LabelField
  | PostCodeField
  | CityField
  | StreetField
  | EmailField
  | MeasurementField
  | RepeaterField;

export interface FormGroup {
  id: string;
  internalName: string;
  label: string;
  location: number;
  width?: WidthPercent;
  /** Optional CSS color (hex) used for the group's rectangle on the visual canvas. */
  color?: string;
}

export interface FormSubGroup {
  id: string;
  groupId: string;
  internalName: string;
  label: string;
  location: number;
  width?: WidthPercent;
}

export interface FormSchema {
  title: string;
  description?: string;
  groups: FormGroup[];
  subGroups: FormSubGroup[];
  fields: FormField[];
}

/** A single repeater instance: child internalName → its value. */
export type RepeaterInstance = Record<string, FieldValue>;

/** Stored value of a measurement field. */
export interface MeasurementValue {
  amount: number | "";
  unit: string;
}

export type FieldValue =
  | string
  | number
  | boolean
  | string[]
  | Date
  | File[]
  | Array<{ name: string; url: string }>
  | RepeaterInstance[]
  | MeasurementValue
  | undefined;

export type FormValues = Record<string, FieldValue>;
