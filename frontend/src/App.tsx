import { Link } from "react-router-dom";
import "./App.css";

function App() {
  return (
    <>
      <Link to={"/client"}>Join as client</Link>
      <Link to={"/server"}>Join as server</Link>
    </>
  );
}

export default App;
