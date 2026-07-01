import { wsClient } from "@/lib/ws";

type Realm = "archive" | "collection";

export function requestItemBarcodeCapture(realm: Realm) {
  wsClient.send("barcode.capture_request", {
    realm,
    from_session: wsClient.sessionId ?? undefined,
  });
}

export function requestItemPhotoLookup(realm: Realm, itemName: string, barcodeCode?: string | null) {
  wsClient.send("photo.request", {
    item_name: (itemName || barcodeCode || "Foto fuer KI").trim(),
    realm,
    purpose: "ai_lookup",
    from_session: wsClient.sessionId ?? undefined,
  });
}

type ItemCreateDeviceSubscriptionOptions = {
  onBarcodeScanned: (payload: { code: string; symbology: string | null }) => void;
  onBarcodeUnavailable: () => void;
  onPhotoUploaded: (tempImageID: string) => void;
};

export function subscribeItemCreateDeviceEvents(options: ItemCreateDeviceSubscriptionOptions) {
  const unsubScanned = wsClient.on("barcode.scanned", (data) => {
    const code = typeof data.code === "string" ? data.code : "";
    const symbology = typeof data.symbology === "string" ? data.symbology : null;
    if (!code) return;
    options.onBarcodeScanned({ code, symbology });
  });

  const unsubUnavailable = wsClient.on("barcode.capture_unavailable", () => {
    options.onBarcodeUnavailable();
  });

  const unsubPhotoUploaded = wsClient.on("photo.uploaded", (data) => {
    const tempImageID = typeof data.temp_image_id === "string" ? data.temp_image_id : "";
    if (!tempImageID) return;
    const purpose = typeof data.purpose === "string" ? data.purpose : "";
    if (purpose && purpose !== "ai_lookup") return;
    options.onPhotoUploaded(tempImageID);
  });

  return () => {
    unsubScanned();
    unsubUnavailable();
    unsubPhotoUploaded();
  };
}
