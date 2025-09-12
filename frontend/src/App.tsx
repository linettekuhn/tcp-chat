import { useNavigate } from "react-router-dom";

function App() {
  const navigate = useNavigate();
  return (
    <main>
      <h1>
        Welcome to my <br />
        TCP Chat App!
      </h1>
      <button onClick={() => navigate("/client")}>Connect as Client</button>
      <button onClick={() => navigate("/server")}>Create a Server</button>
    </main>
  );
}

export default App;
