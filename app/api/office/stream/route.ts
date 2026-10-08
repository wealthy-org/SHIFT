import { live } from "@/lib/engine/store";
import { officeScene } from "@/lib/engine/office3d";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Server-sent events: one authoritative snapshot per second. Each message carries
// a monotonic `seq`, so a client that reconnects can tell what it already applied.
export async function GET(req: Request) {
  const enc = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream({
    async start(controller) {
      const send = async () => {
        try {
          const { s, now } = await live();
          controller.enqueue(enc.encode(`event: snapshot\ndata: ${JSON.stringify(officeScene(s, now))}\n\n`));
        } catch {
          controller.enqueue(enc.encode(`event: error\ndata: {"error":"SNAPSHOT_FAILED"}\n\n`));
        }
      };
      controller.enqueue(enc.encode("retry: 2000\n\n"));
      await send();
      timer = setInterval(send, 1000);
      req.signal.addEventListener("abort", () => {
        clearInterval(timer);
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      clearInterval(timer);
    },
  });
  return new Response(stream, {
    headers: { "content-type": "text/event-stream", "cache-control": "no-store, no-transform", connection: "keep-alive", "x-accel-buffering": "no" },
  });
}
