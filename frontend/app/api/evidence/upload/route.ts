import { google } from "googleapis";
import { NextResponse } from "next/server";
import { Readable } from "node:stream";

function getDriveAuth() {
  const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) {
    throw new Error("Google Drive credentials are not configured.");
  }

  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
}

async function uploadToPinata(file: File) {
  const pinataJwt = process.env.PINATA_JWT;
  if (!pinataJwt) {
    throw new Error("PINATA_JWT is not configured.");
  }

  const form = new FormData();
  form.append("file", file);
  form.append(
    "pinataMetadata",
    JSON.stringify({
      name: file.name,
    }),
  );

  const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${pinataJwt}`,
    },
    body: form,
  });

  if (!response.ok) {
    throw new Error("Pinata upload failed.");
  }

  const payload = (await response.json()) as { IpfsHash: string };

  return {
    provider: "ipfs",
    name: file.name,
    url: `https://gateway.pinata.cloud/ipfs/${payload.IpfsHash}`,
  };
}

async function uploadToDrive(file: File) {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) {
    throw new Error("GOOGLE_DRIVE_FOLDER_ID is not configured.");
  }

  const auth = getDriveAuth();
  const drive = google.drive({ version: "v3", auth });
  const arrayBuffer = await file.arrayBuffer();
  const body = Buffer.from(arrayBuffer);

  const media = {
    mimeType: file.type || "application/octet-stream",
    body: Readable.from(body),
  };

  const requestBody: {
    name: string;
    parents: string[];
    driveId?: string;
  } = {
    name: file.name,
    parents: [folderId],
  };

  const driveId = process.env.GOOGLE_DRIVE_SHARED_DRIVE_ID;

  const created = await drive.files.create({
    requestBody,
    media,
    fields: "id, webViewLink, webContentLink",
    supportsAllDrives: true,
  });

  const fileId = created.data.id;
  if (!fileId) {
    throw new Error("Drive upload failed.");
  }

  await drive.permissions.create({
    fileId,
    requestBody: {
      role: "reader",
      type: "anyone",
    },
    supportsAllDrives: true,
  });

  const targetUrl =
    created.data.webViewLink ||
    created.data.webContentLink ||
    `https://drive.google.com/file/d/${fileId}/view`;

  return {
    provider: driveId ? "drive-shared" : "drive",
    name: file.name,
    url: targetUrl,
  };
}

export async function GET() {
  const ipfsEnabled = Boolean(process.env.PINATA_JWT);
  const driveEnabled = Boolean(
    process.env.GOOGLE_DRIVE_CLIENT_EMAIL &&
      process.env.GOOGLE_DRIVE_PRIVATE_KEY &&
      process.env.GOOGLE_DRIVE_FOLDER_ID,
  );

  let note = "No upload provider is configured on the server yet.";
  if (ipfsEnabled && driveEnabled) {
    note = "IPFS and Google Drive uploads are available.";
  } else if (ipfsEnabled) {
    note = "IPFS upload is available. Google Drive is not configured yet.";
  } else if (driveEnabled) {
    note = "Google Drive upload is available. IPFS is not configured yet.";
  }

  return NextResponse.json({
    ipfsEnabled,
    driveEnabled,
    note,
  });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const provider = String(formData.get("provider") ?? "ipfs");
    const files = formData.getAll("files").filter((item): item is File => item instanceof File);

    if (!files.length) {
      return NextResponse.json({ error: "No files attached." }, { status: 400 });
    }

    const uploads = await Promise.all(
      files.map((file) => {
        if (provider === "drive") {
          return uploadToDrive(file);
        }

        return uploadToPinata(file);
      }),
    );

    return NextResponse.json({ uploads });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Evidence upload failed.",
      },
      { status: 500 },
    );
  }
}
