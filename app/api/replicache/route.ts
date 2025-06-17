import { NextRequest, NextResponse } from "next/server";
import type { StoredSession } from "@/lib/sessionStorage";

// In a real application, we would use a database to store these, but for this demo,
// we'll use in-memory storage that will be reset when the server restarts
const clientIDs: Record<string, number> = {};
const sessionStore: Record<string, StoredSession> = {};
let version = 0;

// Important: This is just a simple demo for cross-browser syncing
// In production, you should use a proper database with the Replicache sync patterns
// See: https://github.com/rocicorp/replicache-sample-todo

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("Replicache API request:", JSON.stringify(body, null, 2));

    // Support both { method: 'push'/'pull', ... } and { push: {...} }/{ pull: {...} }
    if (body.method === "pull") {
      return handlePull({ pull: body });
    }
    if (body.method === "push") {
      return handlePush({ push: body });
    }
    if (body.pull) {
      return handlePull(body);
    }
    if (body.push) {
      return handlePush(body);
    }

    return NextResponse.json(
      { error: "Unknown request type" },
      { status: 400 },
    );
  } catch (error) {
    console.error("Error processing Replicache request:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

interface PullRequest {
  pull: {
    clientID: string;
  };
}

async function handlePull(pullRequest: PullRequest) {
  const { clientID } = pullRequest.pull;

  // Get the client's last mutation ID, or 0 if it's a new client
  const lastMutationID = clientIDs[clientID] || 0;

  // Get all sessions from the session store
  const cookie = version;
  const patch = [];

  // Add all sessions from the store to the patch
  for (const [key, value] of Object.entries(sessionStore)) {
    patch.push({
      op: "put",
      key,
      value,
    });
  }

  return NextResponse.json({
    lastMutationID,
    cookie,
    patch,
  });
}

interface PushMutation {
  id: number;
  name: string;
  args: {
    date: string;
    session?: StoredSession;
    [key: string]: unknown;
  };
}

interface PushRequest {
  push: {
    clientID: string;
    mutations: PushMutation[];
  };
}

async function handlePush(pushRequest: PushRequest) {
  const { clientID, mutations } = pushRequest.push;

  // Initialize the client's last mutation ID if it doesn't exist
  if (!clientIDs[clientID]) {
    clientIDs[clientID] = 0;
  }

  const expectedMutationID = clientIDs[clientID] + 1;

  // Process each mutation
  for (const mutation of mutations) {
    const { id, name, args } = mutation;

    // Ensure mutations are processed in order
    if (id < expectedMutationID) {
      console.log(`Skipping mutation ${id} - already processed`);
      continue;
    }

    if (id > expectedMutationID) {
      return NextResponse.json(
        { error: `Mutation ID ${id} is from the future` },
        { status: 400 },
      );
    }

    // Process the mutation based on its name
    switch (name) {
      case "saveSession":
        if (args.session && typeof args.date === "string") {
          sessionStore[`session-${args.date}`] = args.session;
        }
        break;

      case "deleteSession":
        if (typeof args.date === "string") {
          delete sessionStore[`session-${args.date}`];
        }
        break;

      case "clearAllSessions":
        // Filter out session entries from the store
        Object.keys(sessionStore).forEach((key) => {
          if (key.startsWith("session-")) {
            delete sessionStore[key];
          }
        });
        break;

      case "updateTimeBoxStatus":
      case "updateTaskStatus":
      case "saveTimerState": {
        const key = `session-${args.date}`;
        const session = sessionStore[key];
        if (session) {
          // In reality, you would implement these mutations more efficiently
          // For simplicity, we'll just let the client handle this and save the result
          // via the saveSession mutator
        }
        break;
      }

      default:
        console.warn(`Unknown mutation: ${name}`);
    }

    // Update the client's last mutation ID and the global version
    clientIDs[clientID] = id;
    version++;
  }

  return NextResponse.json({
    lastMutationID: clientIDs[clientID],
  });
}
