import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

const YOUTUBE_ERROR_MESSAGES: Record<string, string> = {
  access_denied: "YouTube connection was cancelled.",
  missing_code_or_state: "YouTube redirected back without the expected parameters.",
  invalid_state: "That connection link expired or was invalid - please try again.",
  session_mismatch: "Please log in and try connecting again.",
  channel_not_found: "Couldn't find that channel.",
  no_refresh_token: "Google didn't return a refresh token - try disconnecting the app at https://myaccount.google.com/permissions and reconnecting.",
  no_youtube_channel_found: "No YouTube channel found on that Google account.",
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
    include: { youtubeConnection: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <main className="mx-auto flex max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your channels</h1>
        <div className="flex items-center gap-4">
          <Link href="/dashboard/billing" className="text-sm underline">
            Billing
          </Link>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button type="submit" className="text-sm text-gray-500 underline">
              Log out
            </button>
          </form>
        </div>
      </div>

      {youtubeError && (
        <p className="rounded border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700">
          {YOUTUBE_ERROR_MESSAGES[youtubeError] ?? `YouTube connection failed: ${youtubeError}`}
        </p>
      )}
      {youtubeConnected && (
        <p className="rounded border border-green-300 bg-green-50 px-4 py-2 text-sm text-green-700">
          YouTube channel connected.
        </p>
      )}

      {channels.length === 0 ? (
        <p className="text-gray-500">No channels yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {channels.map((channel) => (
            <li key={channel.id} className="flex items-center justify-between rounded border px-4 py-3">
              <div>
                <div className="font-medium">{channel.displayName}</div>
                <div className="text-sm text-gray-500">
                  {channel.language} · {channel.aspectRatio === "WIDE" ? "16:9" : "9:16"}
                </div>
              </div>
              {channel.youtubeConnection ? (
                <span className="text-sm text-green-700">YouTube connected</span>
              ) : (
                <a
                  href={`/api/youtube/connect?channelId=${channel.id}`}
                  className="rounded bg-foreground px-3 py-1.5 text-sm text-background"
                >
                  Connect YouTube
                </a>
              )}
            </li>
          ))}
        </ul>
      )}

      <Link
        href="/dashboard/channels/new"
        className="w-fit rounded bg-foreground px-4 py-2 text-background"
      >
        + Add a channel
      </Link>
    </main>
  );
}
