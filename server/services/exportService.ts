import {
  listFeedback,
  listInteractions,
  type FeedbackRecord,
  type InteractionRecord,
} from "./dataService";

import {
  listUsers,
  type UserRecord,
} from "./userService";

const EXPORT_RECORD_LIMIT = 200;

export interface Level5ExportRow {
  userId: string;
  name: string;
  email: string;
  walletAddress: string;
  joinedAt: string;
  onboardingStatus: string;
  onboardingCompleted: boolean;
  mainAction: string;
  contractFunction: string;
  transactionHash: string;
  transactionStatus: string;
  network: string;
  interactionDate: string;
  lastActiveAt: string;
  rating: number | "";
  feedback: string;
  improvementCategory: string;
}

const LEVEL_5_EXPORT_COLUMNS:
ReadonlyArray<
  readonly [
    keyof Level5ExportRow,
    string,
  ]
> = [
  ["userId", "User ID"],
  ["name", "Name"],
  ["email", "Email"],
  ["walletAddress", "Wallet"],
  ["joinedAt", "Joined Date"],
  [
    "onboardingStatus",
    "Onboarding Status",
  ],
  [
    "onboardingCompleted",
    "Onboarding Completed",
  ],
  ["mainAction", "Main Action"],
  [
    "contractFunction",
    "Contract Function",
  ],
  [
    "transactionHash",
    "Transaction Hash",
  ],
  [
    "transactionStatus",
    "Transaction Status",
  ],
  ["network", "Network"],
  [
    "interactionDate",
    "Interaction Date",
  ],
  ["lastActiveAt", "Last Active"],
  ["rating", "Rating"],
  ["feedback", "Feedback"],
  [
    "improvementCategory",
    "Improvement Category",
  ],
];

function normalizeWalletKey(
  walletAddress: string
): string {
  return walletAddress
    .trim()
    .toUpperCase();
}

function buildLatestInteractionMap(
  interactions:
    readonly InteractionRecord[]
): Map<string, InteractionRecord> {
  const latestByWallet =
    new Map<
      string,
      InteractionRecord
    >();

  for (
    const interaction of interactions
  ) {
    const walletKey =
      normalizeWalletKey(
        interaction.walletAddress
      );

    if (
      !latestByWallet.has(
        walletKey
      )
    ) {
      latestByWallet.set(
        walletKey,
        interaction
      );
    }
  }

  return latestByWallet;
}

function buildLatestFeedbackMap(
  feedbackEntries:
    readonly FeedbackRecord[]
): Map<string, FeedbackRecord> {
  const latestByWallet =
    new Map<
      string,
      FeedbackRecord
    >();

  for (
    const feedback of
    feedbackEntries
  ) {
    if (!feedback.walletAddress) {
      continue;
    }

    const walletKey =
      normalizeWalletKey(
        feedback.walletAddress
      );

    if (
      !latestByWallet.has(
        walletKey
      )
    ) {
      latestByWallet.set(
        walletKey,
        feedback
      );
    }
  }

  return latestByWallet;
}

function buildExportRow(
  user: UserRecord,
  latestInteraction:
    InteractionRecord | undefined,
  latestFeedback:
    FeedbackRecord | undefined
): Level5ExportRow {
  return {
    userId: user.id,
    name: user.name,
    email: user.email,

    walletAddress:
      user.walletAddress,

    joinedAt:
      user.joinedAt,

    onboardingStatus:
      user.onboardingStatus,

    onboardingCompleted:
      user.onboardingCompleted,

    mainAction:
      latestInteraction?.action || "",

    contractFunction:
      latestInteraction
        ?.contractFunction || "",

    transactionHash:
      latestInteraction?.txHash || "",

    transactionStatus:
      latestInteraction?.status || "",

    network:
      latestInteraction?.network || "",

    interactionDate:
      latestInteraction
        ?.createdAt || "",

    lastActiveAt:
      user.lastActiveAt || "",

    rating:
      latestFeedback?.rating || "",

    feedback:
      latestFeedback?.comment || "",

    improvementCategory:
      latestFeedback
        ?.improvementCategory || "",
  };
}

export async function buildLevel5ExportRows():
Promise<Level5ExportRow[]> {
  const [
    users,
    interactions,
    feedbackEntries,
  ] = await Promise.all([
    listUsers(EXPORT_RECORD_LIMIT),

    listInteractions(
      EXPORT_RECORD_LIMIT
    ),

    listFeedback(
      EXPORT_RECORD_LIMIT
    ),
  ]);

  const latestInteractionByWallet =
    buildLatestInteractionMap(
      interactions
    );

  const latestFeedbackByWallet =
    buildLatestFeedbackMap(
      feedbackEntries
    );

  return users.map((user) => {
    const walletKey =
      normalizeWalletKey(
        user.walletAddress
      );

    return buildExportRow(
      user,

      latestInteractionByWallet.get(
        walletKey
      ),

      latestFeedbackByWallet.get(
        walletKey
      )
    );
  });
}

function protectSpreadsheetValue(
  value: string
): string {
  const cleanedValue =
    value.replace(/\u0000/g, "");

  if (
    /^[=+\-@\t\r]/.test(
      cleanedValue
    )
  ) {
    return `'${cleanedValue}`;
  }

  return cleanedValue;
}

function escapeCsvValue(
  value: unknown
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  const protectedValue =
    protectSpreadsheetValue(
      String(value)
    );

  if (
    /[",\r\n]/.test(
      protectedValue
    )
  ) {
    return `"${protectedValue.replace(
      /"/g,
      '""'
    )}"`;
  }

  return protectedValue;
}

export function buildLevel5Csv(
  rows: readonly Level5ExportRow[]
): string {
  const headerLine =
    LEVEL_5_EXPORT_COLUMNS
      .map(([, label]) =>
        escapeCsvValue(label)
      )
      .join(",");

  const dataLines = rows.map(
    (row) =>
      LEVEL_5_EXPORT_COLUMNS
        .map(([key]) =>
          escapeCsvValue(
            row[key]
          )
        )
        .join(",")
  );

  return (
    "\uFEFF" +
    [
      headerLine,
      ...dataLines,
    ].join("\r\n") +
    "\r\n"
  );
}

export async function createLevel5Csv():
Promise<string> {
  const rows =
    await buildLevel5ExportRows();

  return buildLevel5Csv(rows);
}

export function createLevel5ExportFilename(
  date = new Date()
): string {
  const datePart =
    date.toISOString().slice(0, 10);

  return (
    `stellar-chapter-pay-level-5-` +
    `${datePart}.csv`
  );
}
