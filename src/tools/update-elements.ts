import { tool } from "ai";
import { z } from "zod";

// Updates existing elements by id. Like the lesson 2 modifyDiagram tool, the
// updates fields are nullable rather than optional so OpenAI strict mode stays
// on. Null means "leave this field alone." We strip nulls before returning so
// the client only sees fields the agent actually wanted to change.

const updateFields = z.object({
  x: z.number().nullable().describe("New x position, or null to leave unchanged"),
  y: z.number().nullable().describe("New y position, or null"),
  width: z.number().nullable(),
  height: z.number().nullable(),
  text: z.string().nullable().describe("New label text, or null"),
  fontSize: z.number().nullable(),
  textAlign: z.enum(["left", "center", "right"]).nullable(),
  strokeColor: z.string().nullable().describe("Hex stroke color, or null"),
  backgroundColor: z.string().nullable().describe("Hex fill color, or null"),
  fillStyle: z.enum(["solid", "hachure", "cross-hatch"]).nullable(),
  strokeWidth: z.number().nullable(),
  roughness: z.number().nullable(),
  opacity: z.number().nullable(),
});

export const updateElements = tool({
  description: `Update one or more existing elements by id. Pass null for any field you don't want to change. Only use ids that exist on the canvas — call queryCanvas first if you're not sure.

Example: updateElements({ updates: [
  { id: "rect_login", fields: { backgroundColor: "#fa5252", x: null, y: null, width: null, height: null, text: null, fontSize: null, textAlign: null, strokeColor: null, fillStyle: null, strokeWidth: null, roughness: null, opacity: null } }
]})`,
  inputSchema: z.object({
    updates: z
      .array(
        z.object({
          id: z.string().describe("Id of the element to update"),
          fields: updateFields,
        })
      )
      .describe("One entry per element to update"),
  }),
  execute: async ({ updates }) => {
    // Strip nulls before sending to the client. The schema forces the model
    // to mention every field (strict mode), but the client only wants the
    // ones that should actually change.
    const cleaned = updates.map(({ id, fields }) => {
      const filtered: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(fields)) {
        if (value !== null) filtered[key] = value;
      }
      return { id, fields: filtered };
    });
    return { updates: cleaned };
  },

});
