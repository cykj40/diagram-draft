import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import {
  convertToExcalidrawElements,
  CaptureUpdateAction,
  newElementWith,
} from "@excalidraw/excalidraw";
import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import Canvas from "./components/Canvas";
import ChatPanel from "./components/chat/ChatPanel";
import { serializeCanvasState } from "./context/canvas-state";
import { normalizeElementSkeletons } from "./excalidraw/normalize-skeleton";
import "./App.css";

// One agent instance per page load. The canvas state lives only in the
// browser, so persisting chat history across refreshes would leave a dead
// conversation referencing diagrams that no longer exist. Generated at the
// module level so React StrictMode's double mount doesn't change it.
const sessionId = crypto.randomUUID();


export default function App() {
  const [excalidrawAPI, setExcalidrawAPI] =
    useState<ExcalidrawImperativeAPI | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Track which tool calls we've already applied so we don't double-apply
  // when messages re-render.
  const appliedToolCalls = useRef<Set<string>>(new Set());

  // Hold the latest excalidrawAPI in a ref so the onToolCall callback (which
  // is captured once at hook init time) can always read the live API instead
  // of a stale closure copy.
  const excalidrawAPIRef = useRef<ExcalidrawImperativeAPI | null>(null);
  useEffect(() => {
    excalidrawAPIRef.current = excalidrawAPI;
  }, [excalidrawAPI]);

  const handleApiReady = useCallback((api: ExcalidrawImperativeAPI) => {
    setExcalidrawAPI(api);
  }, []);

  const agent = useAgent({ agent: "design-agent", name: sessionId });

  // useAgentChat's onToolCall `addToolOutput` resumes the stream before
  // addToolResult finishes, which races AI SDK's activeResponse and throws.
  // The hook's `addToolResult` sends the output then resumes in the right order.
  const addToolResultRef = useRef<
    (args: {
      tool: string;
      toolCallId: string;
      output: unknown;
    }) => void | PromiseLike<void>
  >(() => { });

  const { messages, sendMessage, status, addToolResult } = useAgentChat({
    agent,
    onToolCall: async ({ toolCall }) => {
      if (toolCall.toolName !== "queryCanvas") return;
      const api = excalidrawAPIRef.current;
      const elements = api?.getSceneElements() ?? [];
      await addToolResultRef.current({
        tool: toolCall.toolName,
        toolCallId: toolCall.toolCallId,
        output: { summary: serializeCanvasState(elements as unknown[]) },
      });
    },
  });
  addToolResultRef.current = addToolResult;

  const sendWithCanvas = useMemo(
    () => (msg: { role: "user"; parts: { type: "text"; text: string }[] }) => {
      const elements = excalidrawAPIRef.current?.getSceneElements() ?? [];
      sendMessage({
        ...msg,
        parts: [
          ...msg.parts,
          { type: "data-canvas-state", data: { elements } } as never,
        ],
      });
    },
    [sendMessage]
  );

  // Watch messages for the three mutating server tools and apply them to the
  // live canvas. The worker side just relays intent — actual scene mutation
  // is the browser's job, since only the browser owns the Excalidraw store.
  useEffect(() => {
    if (!excalidrawAPI) return;

    for (const message of messages) {
      if (message.role !== "assistant") continue;
      for (const part of message.parts ?? []) {
        const type = (part as { type?: string }).type;
        if (
          type !== "tool-addElements" &&
          type !== "tool-updateElements" &&
          type !== "tool-removeElements"
        ) {
          continue;
        }
        const p = part as {
          type: string;
          toolCallId: string;
          state: string;
          output: unknown;
        };
        if (p.state !== "output-available") continue;
        if (appliedToolCalls.current.has(p.toolCallId)) continue;
        appliedToolCalls.current.add(p.toolCallId);

        if (p.type === "tool-addElements") {
          const output = p.output as { elements?: unknown };
          const skeletons = output?.elements;
          if (Array.isArray(skeletons) && skeletons.length > 0) {
            // Convert skeletons into full Excalidraw elements. regenerateIds
            // false so the agent's chosen ids survive — otherwise later
            // updateElements/removeElements calls (which use those ids) miss.
            const newOnes = convertToExcalidrawElements(
              normalizeElementSkeletons(skeletons) as never,
              { regenerateIds: false }
            );
            const current = excalidrawAPI.getSceneElements();
            const next = [...current, ...newOnes];
            excalidrawAPI.updateScene({
              elements: next,
              captureUpdate: CaptureUpdateAction.IMMEDIATELY,
            });
            excalidrawAPI.scrollToContent(next, { fitToContent: true });
          }
        } else if (p.type === "tool-updateElements") {
          const output = p.output as {
            updates?: { id: string; fields: Record<string, unknown> }[];
          };
          const updates = output?.updates;
          if (Array.isArray(updates) && updates.length > 0) {
            const byId = new Map(updates.map((u) => [u.id, u.fields]));
            const current = excalidrawAPI.getSceneElements();
            const next = current.map((el) => {
              const fields = byId.get(el.id);
              return fields ? newElementWith(el, fields as never) : el;
            });
            excalidrawAPI.updateScene({
              elements: next,
              captureUpdate: CaptureUpdateAction.IMMEDIATELY,
            });
          }
        } else if (p.type === "tool-removeElements") {
          const output = p.output as { ids?: string[] };
          const ids = new Set(output?.ids ?? []);
          if (ids.size > 0) {
            const current = excalidrawAPI.getSceneElements();
            const next = current.filter((el) => !ids.has(el.id));
            excalidrawAPI.updateScene({
              elements: next,
              captureUpdate: CaptureUpdateAction.IMMEDIATELY,
            });
          }
        }
      }
    }
  }, [messages, excalidrawAPI]);

  return (
    <div className={`app ${theme}`}>
      <div className="canvas-container">
        <Canvas onApiReady={handleApiReady} onThemeChange={setTheme} />
      </div>
      <ChatPanel
        messages={messages}
        sendMessage={sendWithCanvas}
        status={status}
      />
      <a href="#viewer" className="viewer-launch" title="Open diagram viewer for human scoring">
        viewer
      </a>
    </div>
  );
}
