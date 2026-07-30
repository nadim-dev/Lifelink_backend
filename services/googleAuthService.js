import { OAuth2Client } from "google-auth-library";

const clientId =process.env.Google_Client_Id;

const client = new OAuth2Client();

export async function verifyIdToken(idToken) {
  const loginTicket = await client.verifyIdToken({
    idToken,
    audience: clientId,
  });

  const userData = loginTicket.getPayload();
  return userData;
}