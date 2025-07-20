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

export async function startServer(
  port: number,
  capacity: number,
  commandChar: string
) {
  await handleResponse(
    await fetch("http://localhost:3000/server/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ port, capacity, commandChar }),
    })
  );
}

export async function stopServer(port: number, serverAddress: string) {
  await handleResponse(
    await fetch("http://localhost:3000/server/stop", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ port, serverAddress }),
    })
  );
}

export async function getHostIP() {
  const response = await handleResponse(
    await fetch("http://localhost:3000/server/host-ip", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })
  );
  const ip = response.text();
  return ip;
}
