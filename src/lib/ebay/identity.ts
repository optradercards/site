// Read the connected seller's eBay identity (username) via the Commerce
// Identity API. Requires the commerce.identity.readonly scope.
//
// NOTE: in the eBay SANDBOX this endpoint is frequently restricted, so callers
// must treat a null result as non-fatal — the connection is still valid, we
// just won't have a friendly username to display until production.

import { ebayEndpoints } from "./config";

export interface EbayUser {
  userId?: string;
  username?: string;
}

export async function getEbayUser(accessToken: string): Promise<EbayUser | null> {
  try {
    const res = await fetch(`${ebayEndpoints.api}/commerce/identity/v1/user/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { userId?: string; username?: string };
    return { userId: data.userId, username: data.username };
  } catch {
    return null;
  }
}
