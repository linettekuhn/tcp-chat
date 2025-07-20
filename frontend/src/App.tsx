import { Link } from "react-router-dom";
import "./App.css";

function App() {
  return (
    <>
      <h1>Welcome to my TCP chat!</h1>
      <Link to={"/client"}>Join as client</Link>
      <Link to={"/server"}>Join as server</Link>
    </>
  );
}

export default App;
