
import {
  StorageSharedKeyCredential,
  BlobSASPermissions,
  generateBlobSASQueryParameters
} from "@azure/storage-blob";
import crypto from "crypto";

const CONTAINER = process.env.AZURE_STORAGE_CONTAINER || "jobs";

export default async function (context, req) {
  try {
    const { fileName, contentType } = req.body || {};
    const ext = fileName && fileName.includes(".") ? "." + fileName.split(".").pop() : "";
    const blobName = `u${Date.now()}_${crypto.randomBytes(4).toString("hex")}${ext}`;

    const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
    const accountKey  = process.env.AZURE_STORAGE_ACCOUNT_KEY;
    if (!accountName || !accountKey) {
      context.res = { status: 500, body: { error: "storage_creds_missing" } };
      return;
    }
    const creds = new StorageSharedKeyCredential(accountName, accountKey);
    const startsOn = new Date(Date.now() - 60 * 1000);

    const uploadSas = generateBlobSASQueryParameters({
      containerName: CONTAINER,
      blobName,
      permissions: BlobSASPermissions.parse("cw"),
      startsOn,
      expiresOn: new Date(Date.now() + 10 * 60 * 1000),
      contentType: contentType || undefined
    }, creds).toString();

    const readSas = generateBlobSASQueryParameters({
      containerName: CONTAINER,
      blobName,
      permissions: BlobSASPermissions.parse("r"),
      startsOn,
      expiresOn: new Date(Date.now() + 60 * 60 * 1000)
    }, creds).toString();

    const uploadUrl = `https://${accountName}.blob.core.windows.net/${CONTAINER}/${encodeURIComponent(blobName)}?${uploadSas}`;
    const blobUrl   = `https://${accountName}.blob.core.windows.net/${CONTAINER}/${encodeURIComponent(blobName)}?${readSas}`;

    context.res = { status: 200, body: { uploadUrl, blobUrl, blobName } };
  } catch (e) {
    context.res = { status: 500, body: { error: "sas_failed", detail: String(e?.message || e) } };
  }
}
