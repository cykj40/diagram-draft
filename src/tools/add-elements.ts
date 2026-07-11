import { tool } from "ai";
import { z } from "zod";
import { elementSchema } from "./element-schema";

// Adds new elements to the canvas. The execute function is a passthrough —
// the actual scene mutation happens in the browser when App.tsx sees the
// tool-addElements part on a message and applies it via excalidrawAPI.
//
// Why passthrough on the worker: the worker doesn't have access to the live
// Excalidraw scene. It just relays the agent's intent. The browser is the
// source of truth for what's actually on the canvas.

export const addElements = tool({
  description: `Add new elements to the canvas. Use this for creating diagrams or adding to an existing one. Each element needs an id, type, position, and size.

Example: addElements({ elements: [
  { id: "rect_start", type: "rectangle", x: 100, y: 100, width: 160, height: 80, text: "Start" },
  { id: "rect_end", type: "rectangle", x: 360, y: 100, width: 160, height: 80, text: "End" },
  { id: "arrow_start_end", type: "arrow", x: 260, y: 140, width: 100, height: 0, startBinding: { elementId: "rect_start", focus: 0, gap: 8 }, endBinding: { elementId: "rect_end", focus: 0, gap: 8 } }
]})`,
  inputSchema: z.object({
    elements: z.array(elementSchema).describe("Array of new elements to add to the canvas"),
  }),
  execute: async ({ elements }) => {
    return { elements };
  },

});
