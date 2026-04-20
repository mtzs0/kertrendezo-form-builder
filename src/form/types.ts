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
  | "image";

export type NotePosition = "above" | "below" | "side";

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
  /** Field id whose answer we evaluate. */
  fieldId: string;
  operator: "is" | "is_not" | "equals" | "greater_than" | "less_than" | "contains";
  value: string | number | boolean;
}

export interface ConditionGroup {
  combinator: "and" | "or";
  rules: Array<FieldCondition | ConditionGroup>;
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
}

export interface TextField extends BaseField { type: "text" }
export interface TextAreaField extends BaseField { type: "textarea" }
export interface SliderField extends BaseField {
  type: "slider";
  min: number;
  max: number;
  step?: number;
  unit?: string;
}
export interface PhoneField extends BaseField { type: "phone" }
export interface DateField extends BaseField { type: "date"; withTime?: boolean }
export interface ImageField extends BaseField { type: "image"; multiple?: boolean }

export interface OptionField extends BaseField {
  type: "radio" | "checkbox" | "select";
  options: FieldOption[];
  /** "egyedi megjegyzés mindegyik opcióhoz" */
  uniqueNotePerOption?: boolean;
  /** "illusztrációk használata" */
  useImages?: boolean;
  /** "oszlopok száma" */
  columns?: number;
}

export type FormField =
  | TextField
  | TextAreaField
  | SliderField
  | PhoneField
  | DateField
  | ImageField
  | OptionField;

export interface FormGroup {
  id: string;
  internalName: string;
  label: string;
  location: number;
}

export interface FormSubGroup {
  id: string;
  groupId: string;
  internalName: string;
  label: string;
  location: number;
}

export interface FormSchema {
  title: string;
  description?: string;
  groups: FormGroup[];
  subGroups: FormSubGroup[];
  fields: FormField[];
}

export type FieldValue =
  | string
  | number
  | boolean
  | string[]
  | Date
  | File[]
  | undefined;

export type FormValues = Record<string, FieldValue>;
