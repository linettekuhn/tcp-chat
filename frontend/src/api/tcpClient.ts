import { BASEURL } from "./config";

async function handleResponse(res: Response) {
  if (!res.ok) {
    const errorBody = await res.text();
    let alertMessage = `HTTP error! Status: ${res.status}`;
    try {
      const errorJson = JSON.parse(errorBody);
      alertMessage = errorJson.message || alertMessage || errorJson.error;
    } catch (error: unknown) {
      console.log(error);
      alertMessage = errorBody || alertMessage;
    }
    throw new Error(`Failed to fetch: ${res.status} - ${alertMessage}`);
  }
  return res;
}

export async function startClient(port: number, serverAddress: string, clientId: string) {
  const response = await handleResponse(
    await fetch(`${BASEURL}/client/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ port, serverAddress, clientId }),
    })
  );
  const msg = await response.text();
  return msg;
}

export async function sendCommand(command: string, clientId: string) {
  const url = `${BASEURL}/client/command`;
  console.log("FETCHING:", url, command);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ command, clientId }),
    });
  } catch (err) {
    console.error("FETCH failed:", err);
    throw err;
  }
  console.log("RESPONSE status:", response.status);
  const handled = await handleResponse(response);
  const msg = await handled.text();
  console.log("RESPONSE body:", msg);
  return msg;
}

export async function stopClient(clientId: string) {
  await handleResponse(
    await fetch(`${BASEURL}/client/stop`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ clientId }),
    })
  );
}
