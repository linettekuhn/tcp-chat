import { Link } from "react-router-dom";

function App() {
  return (
    <div className="content">
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
    </div>
  );
}

export default App;
