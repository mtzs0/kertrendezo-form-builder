import type { FormSchema } from "./types";

/**
 * Sample form used for the foundation pass. Will be replaced by editor-built
 * schemas (stored in Lovable Cloud) in a later iteration.
 */
export const sampleSchema: FormSchema = {
  title: "Kerttervező űrlap",
  description:
    "Mondd el, milyen kertet álmodtál meg, és mi felvesszük veled a kapcsolatot.",
  groups: [
    { id: "g_basics", internalName: "alap", label: "Alapok", location: 1 },
    { id: "g_garden", internalName: "kert", label: "A kerted", location: 2 },
    { id: "g_contact", internalName: "kapcsolat", label: "Kapcsolat", location: 3 },
  ],
  subGroups: [
    {
      id: "sg_size",
      groupId: "g_garden",
      internalName: "meret",
      label: "Méret és terület",
      location: 1,
    },
  ],
  fields: [
    {
      id: "f_name",
      internalName: "nev",
      label: "Neved",
      placeholder: "Pl. Kovács Anna",
      required: true,
      type: "text",
      groupId: "g_basics",
      location: 1,
    },
    {
      id: "f_style",
      internalName: "stilus",
      label: "Milyen stílusú kertet szeretnél?",
      type: "radio",
      groupId: "g_basics",
      location: 2,
      columns: 3,
      options: [
        { displayName: "Modern", dataName: "modern" },
        { displayName: "Mediterrán", dataName: "mediterranean" },
        { displayName: "Természetközeli", dataName: "natural" },
      ],
    },
    {
      id: "f_area",
      internalName: "terulet",
      label: "Mekkora a kert területe?",
      type: "slider",
      min: 20,
      max: 2000,
      step: 10,
      unit: "m²",
      groupId: "g_garden",
      subGroupId: "sg_size",
      location: 1,
      note: { value: "Húzd a csúszkát a becsült méret kiválasztásához.", position: "below" },
    },
    {
      id: "f_features",
      internalName: "elemek",
      label: "Milyen elemeket szeretnél?",
      type: "checkbox",
      groupId: "g_garden",
      location: 2,
      columns: 2,
      options: [
        { displayName: "Pihenő terasz", dataName: "terrace" },
        { displayName: "Tűzrakó hely", dataName: "firepit" },
        { displayName: "Vízelem / tó", dataName: "water" },
        { displayName: "Veteményes", dataName: "veggie" },
        { displayName: "Játszó terület", dataName: "playground" },
        { displayName: "Növényágyások", dataName: "beds" },
      ],
    },
    {
      id: "f_budget",
      internalName: "koltsegvetes",
      label: "Tervezett költségvetés",
      type: "select",
      groupId: "g_garden",
      location: 3,
      options: [
        { displayName: "500 000 Ft alatt", dataName: "u500k" },
        { displayName: "500 000 – 1 500 000 Ft", dataName: "500k_1_5m" },
        { displayName: "1 500 000 – 5 000 000 Ft", dataName: "1_5m_5m" },
        { displayName: "5 000 000 Ft felett", dataName: "o5m" },
      ],
    },
    {
      id: "f_notes",
      internalName: "megjegyzes",
      label: "Egyéb megjegyzés",
      placeholder: "Bármi, ami fontos lehet…",
      type: "textarea",
      groupId: "g_garden",
      location: 4,
    },
    {
      id: "f_phone",
      internalName: "telefon",
      label: "Telefonszám",
      placeholder: "+36 ...",
      required: true,
      type: "phone",
      groupId: "g_contact",
      location: 1,
    },
    {
      id: "f_when",
      internalName: "mikor",
      label: "Mikor kezdenéd?",
      type: "date",
      groupId: "g_contact",
      location: 2,
    },
  ],
};
