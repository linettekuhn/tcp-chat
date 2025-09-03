import { Link } from "react-router-dom";

function App() {
  return (
    <main>
      <h1>
        Welcome to my <br />
        TCP Chat App!
      </h1>
      <button>
        <Link to={"/client"}>Connect as Client</Link>
      </button>
      <button>
        <Link to={"/server"}>Create a Server</Link>
      </button>
    </main>
  );
}

export default App;
