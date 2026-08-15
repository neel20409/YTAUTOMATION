import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Card } from "@/components/ui";
import { StageTimeline } from "@/components/StageTimeline";

const YOUTUBE_ERROR_MESSAGES: Record<string, string> = {
  access_denied: "YouTube connection was cancelled.",
  missing_code_or_state: "YouTube redirected back without the expected parameters.",
  invalid_state: "That connection link expired or was invalid - please try again.",
  session_mismatch: "Please log in and try connecting again.",
  channel_not_found: "Couldn't find that channel.",
  no_refresh_token: "Google didn't return a refresh token - try disconnecting the app at https://myaccount.google.com/permissions and reconnecting.",
  no_youtube_channel_found: "No YouTube channel found on that Google account.",
};

const FORMAT_LABEL: Record<string, string> = { WIDE: "16:9", TALL: "9:16" };

const RUN_STATUS_STYLE: Record<string, string> = {
  QUEUED: "border-standby/40 bg-standby-dim/40 text-standby",
  RUNNING: "border-signal/40 bg-signal-dim/40 text-signal",
  SUCCEEDED: "border-phosphor/40 bg-phosphor-dim/40 text-phosphor",
  FAILED: "border-fault/40 bg-fault-dim/40 text-fault",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ youtube_error?: string; youtube_connected?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { youtube_error: youtubeError, youtube_connected: youtubeConnected } = await searchParams;

  const channels = await prisma.channel.findMany({
    where: { userId: session.user.id },
    include: {
      youtubeConnection: true,
      runs: { orderBy: { createdAt: "desc" }, take: 1, include: { topic: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-6 py-12">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="h-2 w-2 rounded-full bg-signal" aria-hidden />
          <span className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-dim">
            Production Desk
          </span>
        </div>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/dashboard/billing" className="text-dim hover:text-paper">
            Billing
          </Link>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button type="submit" className="text-dim hover:text-paper">
              Log out
            </button>
          </form>
        </nav>
      </header>

      <div>
        <h1 className="font-display text-3xl font-semibold text-paper">Your channels</h1>
        <p className="mt-1 text-sm text-dim">
          {channels.length === 0
            ? "Nothing running yet."
            : `${channels.length} channel${channels.length === 1 ? "" : "s"} on the desk.`}
        </p>
      </div>

      {youtubeError && (
        <p className="rounded-lg border border-fault/40 bg-fault-dim/40 px-4 py-3 text-sm text-fault">
          {YOUTUBE_ERROR_MESSAGES[youtubeError] ?? `YouTube connection failed: ${youtubeError}`}
        </p>
      )}
      {youtubeConnected && (
        <p className="rounded-lg border border-phosphor/40 bg-phosphor-dim/40 px-4 py-3 text-sm text-phosphor">
          YouTube channel connected.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {channels.map((channel) => {
          const run = channel.runs[0];
          return (
            <Card key={channel.id} className="flex flex-col gap-5 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold text-paper">{channel.displayName}</h2>
                  <p className="mt-0.5 font-mono text-xs uppercase tracking-wide text-dim">
                    {channel.language} · {FORMAT_LABEL[channel.aspectRatio]}
                  </p>
                </div>
                {channel.youtubeConnection ? (
                  <span className="flex items-center gap-1.5 rounded-full border border-phosphor/40 bg-phosphor-dim/40 px-2.5 py-1 text-xs font-medium text-phosphor">
                    <span className="h-1.5 w-1.5 rounded-full bg-phosphor" aria-hidden />
                    Connected
                  </span>
                ) : (
                  <a
                    href={`/api/youtube/connect?channelId=${channel.id}`}
                    className="rounded-full border border-line px-2.5 py-1 text-xs font-medium text-dim hover:border-signal hover:text-signal"
                  >
                    Connect YouTube
                  </a>
                )}
              </div>

              {run ? (
                <div className="flex flex-col gap-3 border-t border-line pt-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="line-clamp-1 text-sm text-paper" title={run.topic.title}>
                      {run.topic.title}
                    </p>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide ${RUN_STATUS_STYLE[run.status]}`}
                    >
                      {run.status}
                    </span>
                  </div>
                  <StageTimeline status={run.status} stage={run.stage} />
                  {run.status === "SUCCEEDED" && run.videoUrl && (
                    <a
                      href={run.videoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-signal hover:underline"
                    >
                      Watch on YouTube ↗
                    </a>
                  )}
                  {run.status === "FAILED" && run.errorMessage && (
                    <p className="line-clamp-2 text-xs text-fault" title={run.errorMessage}>
                      {run.errorMessage}
                    </p>
                  )}
                </div>
              ) : (
                <p className="border-t border-line pt-4 text-sm text-dim">No runs yet.</p>
              )}
            </Card>
          );
        })}

        <Link
          href="/dashboard/channels/new"
          className="flex min-h-[9rem] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line text-dim transition-colors hover:border-signal hover:text-signal"
        >
          <span className="text-2xl leading-none">+</span>
          <span className="text-sm font-medium">Add a channel</span>
        </Link>
      </div>
    </main>
  );
}
