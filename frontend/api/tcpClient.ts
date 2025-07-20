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

export async function startClient(port: number, serverAddress: string) {
  const response = await handleResponse(
    await fetch("http://localhost:3000/client/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ port, serverAddress }),
    })
  );
  const msg = await response.text();
  return msg;
}

export async function sendCommand(command: string) {
  const response = await handleResponse(
    await fetch("http://localhost:3000/client/command", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ command }),
    })
  );
  const msg = await response.text();
  return msg;
}

export async function stopClient() {
  await handleResponse(
    await fetch("http://localhost:3000/client/stop", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    })
  );
}
