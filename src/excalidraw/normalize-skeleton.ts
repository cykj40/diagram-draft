// Excalidraw's convertToExcalidrawElements expects shape labels as
// `label: { text: "..." }`, not a top-level `text` field on rectangles.
// The agent schema uses `text` for ergonomics — normalize before conversion.

const LABELED_SHAPES = new Set(["rectangle", "ellipse", "diamond"]);

export function normalizeElementSkeletons(
  skeletons: unknown[]
): unknown[] {
  return skeletons.map((raw) => {
    if (!raw || typeof raw !== "object") return raw;
    const el = { ...(raw as Record<string, unknown>) };
    const type = el.type;
    const text = el.text;

    if (
      typeof type === "string" &&
      LABELED_SHAPES.has(type) &&
      typeof text === "string" &&
      text.trim() &&
      el.label == null
    ) {
      el.label = {
        text,
        ...(typeof el.fontSize === "number" ? { fontSize: el.fontSize } : {}),
        ...(typeof el.fontFamily === "number"
          ? { fontFamily: el.fontFamily }
          : {}),
        ...(typeof el.textAlign === "string"
          ? { textAlign: el.textAlign }
          : {}),
      };
      delete el.text;
    }

    return el;
  });
}
